import { useEffect, useRef } from 'react';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';

/**
 * Nạp danh tính vào `SessionProvider` khi app vào khu có thanh tab mà phiên trong bộ nhớ còn trống
 * (phiên được khôi phục lúc mở app: `SessionGateway.restore` của Splash chỉ trả trạng thái, không
 * trả danh tính nên không có `beginSession`). Không đổi Splash (đã được khách xác nhận). Không hiển
 * thị gì. Danh tính lấy từ `getSessionIdentity` (Firebase Auth + `userShops/{uid}`, Q-20m; không chờ mạng
 * khi đã có bộ nhớ đệm). Chỉ chạy một lần khi gắn; lỗi hoặc chưa đăng nhập thì giữ nguyên, không suy đoán
 * phiên. Đăng nhập xong giữa chừng thì bỏ kết quả.
 */
export function SessionHydrator() {
  const { account } = usePersonalGateways();
  const session = useSession();
  const statusRef = useRef(session.state.status);
  useEffect(() => {
    statusRef.current = session.state.status;
  });
  const begin = session.beginSession;
  const alreadyHydrated = session.state.status === 'signed_in';

  useEffect(() => {
    if (alreadyHydrated) return;
    let cancelled = false;
    void account.getSessionIdentity().then(
      (identity) => {
        if (cancelled || statusRef.current === 'signed_in' || !identity) return;
        begin(
          { uid: identity.uid, email: identity.email, displayName: identity.displayName },
          identity.shopId,
        );
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
    // Chỉ khi gắn: không nạp lại sau khi người dùng đã đăng xuất.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
