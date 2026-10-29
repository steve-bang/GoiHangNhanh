import { useCallback, useEffect, useRef } from 'react';

import { subscribeAppActive, useIsOffline } from '@/platform';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';

/** Khoảng tối thiểu giữa hai lần thử nạp danh tính (tránh dồn dập khi app chuyển nền/trước liên tục hoặc mạng chập chờn). */
export const HYDRATE_MIN_RETRY_INTERVAL_MS = 10_000;

/**
 * Nạp danh tính vào `SessionProvider` khi app vào khu có thanh tab mà phiên trong bộ nhớ còn trống
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
  const signedIn = session.state.status === 'signed_in';

  // Giá trị mới nhất cho các callback dài hạn (đăng ký một lần khi gắn).
  const latest = useRef({ account, begin });
  useEffect(() => {
    latest.current = { account, begin };
  });
  // `done`: đã có câu trả lời dứt khoát hoặc phiên từng đăng nhập: không thử nữa.
  const done = useRef(signedIn);
  useEffect(() => {
    if (signedIn) done.current = true;
  }, [signedIn]);
  const inFlight = useRef(false);
  const lastAttemptAt = useRef<number | null>(null);
  const mounted = useRef(true);

  const attempt = useCallback(() => {
    if (done.current || inFlight.current || !mounted.current) return;
    const now = Date.now();
    if (
      lastAttemptAt.current !== null &&
      now - lastAttemptAt.current < HYDRATE_MIN_RETRY_INTERVAL_MS
    ) {
      return;
    }
    lastAttemptAt.current = now;
    inFlight.current = true;
    void latest.current.account.getSessionIdentity().then(
      (identity) => {
        inFlight.current = false;
        // Đăng nhập giữa chừng (hoặc đã rời): bỏ kết quả, không thay phiên đang hợp lệ.
        if (done.current || !mounted.current) return;
        done.current = true;
        if (!identity) return;
        latest.current.begin(
          { uid: identity.uid, email: identity.email, displayName: identity.displayName },
          identity.shopId,
        );
      },
      () => {
        // Lỗi tạm thời: giữ nguyên chưa nạp, lần kích hoạt sau (foreground / có mạng) thử lại.
        inFlight.current = false;
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    attempt();
    const unsubscribe = subscribeAppActive(attempt);
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [attempt]);

  // Mạng có lại (offline -> online): thử lại. Lần gắn đầu đã thử ở trên.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) attempt();
    wasOffline.current = offline;
  }, [offline, attempt]);

  return null;
}
