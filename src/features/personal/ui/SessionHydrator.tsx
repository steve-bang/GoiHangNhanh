import { useCallback, useEffect, useRef } from 'react';

import { subscribeAppActive, useIsOffline } from '@/platform';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';

/** Khoảng tối thiểu giữa hai lần thử nạp danh tính (tránh dồn dập khi app chuyển nền/trước liên tục hoặc mạng chập chờn). */
export const HYDRATE_MIN_RETRY_INTERVAL_MS = 10_000;

/**
 * Lần nạp danh tính chưa trả lời sau khoảng này thì báo "lỗi" để cổng phiên chuyển từ "Đang nạp" sang
 * "Chưa kết nối được cửa hàng" (có Thử lại, Đăng xuất) thay vì quay mãi (V1-06). Kết quả đến muộn vẫn
 * được dùng nếu là danh tính (nạp phiên); lỗi đến muộn của lần đã quá hạn bị bỏ.
 */
export const HYDRATE_TIMEOUT_MS = 15_000;

/**
 * Nạp danh tính vào `SessionProvider` khi mở app (gắn ở gốc `AppProviders`, V1-06, để cả liên kết sâu
 * tới màn ngoài nhóm tab cũng được nạp) mà phiên trong bộ nhớ còn trống
 * (phiên được khôi phục lúc mở app: `SessionGateway.restore` của Splash chỉ trả trạng thái, không
 * trả danh tính nên không có `beginSession`). Không đổi Splash (đã được khách xác nhận). Không hiển
 * thị gì. Danh tính lấy từ `getSessionIdentity` (Firebase Auth + `userShops/{uid}`, Q-20m; không chờ mạng
 * khi đã có bộ nhớ đệm).
 *
 * Thử ngay khi gắn. Lỗi (ví dụ mất mạng và chưa có bộ nhớ đệm) thì KHÔNG nuốt rồi bỏ: thử lại khi app
 * trở lại foreground và khi mạng có lại, tối đa một lần mỗi `HYDRATE_MIN_RETRY_INTERVAL_MS`, không chạy
 * chồng. Dừng hẳn khi có câu trả lời dứt khoát (có danh tính hoặc chưa đăng nhập) hoặc khi phiên đã
 * đăng nhập (kể cả đăng nhập giữa chừng: bỏ kết quả, không thay phiên hợp lệ). Sau khi đã đăng nhập
 * một lần thì không nạp lại nữa, nên đăng xuất xong không bị nạp lại danh tính cũ.
 */
export function SessionHydrator() {
  const { account } = usePersonalGateways();
  const session = useSession();
  const offline = useIsOffline();
  const begin = session.beginSession;
  const report = session.reportHydration;
  const registerRetry = session.registerHydrationRetry;
  const signedIn = session.state.status === 'signed_in';

  // Giá trị mới nhất cho các callback dài hạn (đăng ký một lần khi gắn).
  const latest = useRef({ account, begin, report });
  useEffect(() => {
    latest.current = { account, begin, report };
  });
  // `done`: đã có câu trả lời dứt khoát hoặc phiên từng đăng nhập: không thử nữa.
  const done = useRef(signedIn);
  useEffect(() => {
    if (signedIn) done.current = true;
  }, [signedIn]);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttemptAt = useRef<number | null>(null);
  const mounted = useRef(true);

  /** `force`: người dùng bấm Thử lại, bỏ qua khoảng tối thiểu (vẫn không chạy chồng). */
  const attempt = useCallback((force = false) => {
    if (done.current || inFlight.current || !mounted.current) return;
    const now = Date.now();
    if (
      !force &&
      lastAttemptAt.current !== null &&
      now - lastAttemptAt.current < HYDRATE_MIN_RETRY_INTERVAL_MS
    ) {
      return;
    }
    lastAttemptAt.current = now;
    inFlight.current = true;
    const gen = (generation.current += 1);
    const isCurrent = () => generation.current === gen;
    // Người dùng bấm Thử lại: hiện "đang nạp" thay cho thông báo lỗi cũ trong lúc chờ.
    if (force) latest.current.report('pending');
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    const timer = setTimeout(() => {
      if (!isCurrent() || done.current || !mounted.current) return;
      // Quá hạn: coi như lỗi, cho phép thử lại (lần cũ thành "cũ", không chặn lần mới).
      generation.current += 1;
      inFlight.current = false;
      latest.current.report('failed');
    }, HYDRATE_TIMEOUT_MS);
    timeoutTimer.current = timer;
    void latest.current.account.getSessionIdentity().then(
      (identity) => {
        clearTimeout(timer);
        if (isCurrent()) inFlight.current = false;
        // Đăng nhập giữa chừng (hoặc đã rời): bỏ kết quả, không thay phiên đang hợp lệ.
        if (done.current || !mounted.current) return;
        done.current = true;
        if (!identity) {
          latest.current.report('settled');
          return;
        }
        latest.current.begin(
          { uid: identity.uid, email: identity.email, displayName: identity.displayName },
          identity.shopId,
        );
      },
      () => {
        clearTimeout(timer);
        // Lỗi của lần đã quá hạn (đã báo "lỗi", có thể đang có lần mới): bỏ.
        if (!isCurrent()) return;
        // Lỗi tạm thời: giữ nguyên chưa nạp, lần kích hoạt sau (foreground / có mạng / Thử lại) thử lại.
        inFlight.current = false;
        if (done.current || !mounted.current) return;
        latest.current.report('failed');
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    attempt();
    const unsubscribe = subscribeAppActive(() => attempt());
    const unregister = registerRetry(() => attempt(true));
    return () => {
      mounted.current = false;
      unsubscribe();
      unregister();
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    };
  }, [attempt, registerRetry]);

  // Mạng có lại (offline -> online): thử lại. Lần gắn đầu đã thử ở trên. Báo kết quả qua
  // `reportHydration` (`settled` khi có câu trả lời dứt khoát, `failed` khi lỗi) cho cổng phiên.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) attempt();
    wasOffline.current = offline;
  }, [offline, attempt]);

  return null;
}
