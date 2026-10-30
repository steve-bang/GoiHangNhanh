import { AppError } from '@/core/errors/app-error';

import type {
  AccountSignInMethod,
  ApiClient,
  AuthApi,
  CreatedShop,
  SessionApi,
  SessionIdentity,
  SessionState,
  ShopApi,
} from '../contract';

import { guard } from './error-map';
import type { FirebaseServices } from './client';
import { createFirebaseOps, type FirebaseOps } from './ops';

/** Nhà cung cấp Auth -> cách đăng nhập. Nhà cung cấp lạ/không có thì `null` (không đoán, O-15). */
function signInMethodOf(providerIds: readonly string[]): AccountSignInMethod | null {
  if (providerIds.includes('password')) return 'password';
  if (providerIds.includes('apple.com')) return 'apple';
  if (providerIds.includes('google.com')) return 'google';
  return null;
}

const unavailable = () => Promise.reject(new AppError('AUTH_SERVICE_UNAVAILABLE'));

/**
 * Chờ bao lâu mới cho gửi lại thư đặt lại mật khẩu (giây). Firebase không báo; giới hạn thật nằm ở
 * Firebase (`auth/too-many-requests`), con số này chỉ để người dùng không bấm liên tục.
 */
export const PASSWORD_RESET_RESEND_SECONDS = 60;

/** `auth/user-not-found`: chỉ có khi dự án TẮT chống dò email của Firebase. App vẫn trả trung tính. */
const isUserNotFound = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === 'auth/user-not-found';

/**
 * Hiện thực `ApiClient` bằng Firebase: Auth cho tài khoản, Cloud Function callable cho shop,
 * Firestore (`userShops/{uid}`) để biết đã có shop chưa. Mọi lỗi SDK được đổi thành `AppError`.
 */
export function createFirebaseApi(services: FirebaseServices): ApiClient {
  const ops: FirebaseOps = createFirebaseOps(services);

  const auth: AuthApi = {
    signUpWithEmail: (input) =>
      guard(async () => {
        const user = await ops.createUser(input.email.trim(), input.password);
        return {
          uid: user.uid,
          email: user.email ?? input.email.trim(),
          emailVerified: user.emailVerified,
        };
      }),
    signInWithPassword: (input) =>
      guard(async () => {
        const user = await ops.signIn(input.email.trim(), input.password);
        let shopId: string | null;
        try {
          shopId = await ops.readShopId(user.uid);
        } catch (error) {
          // Auth đã đăng nhập nhưng chưa biết shop: UI sẽ báo lỗi, nên không để lại phiên "nửa đăng nhập"
          // (lần mở sau Splash sẽ khôi phục thành đã đăng nhập dù người dùng thấy lỗi). Thoát cho sạch rồi
          // báo lỗi gốc; thoát lỗi thì bỏ qua (người dùng đăng nhập lại là xong).
          await ops.signOut().catch(() => undefined);
          throw error;
        }
        return {
          uid: user.uid,
          email: user.email ?? input.email.trim(),
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          hasShop: shopId !== null,
          shopId,
        };
      }),
    // Đăng nhập Apple/Google chưa làm (O-15): không giả vờ thành công.
    signInWithProvider: unavailable,
    // D-14 v1: thư đặt lại của Firebase (PASSWORD_RECOVERY_MODE = 'email_link'). TRUNG TÍNH: email
    // không có tài khoản cũng resolve như nhau. Mã 6 số (hướng B của O-22) để sau: hai hàm dưới vẫn
    // `AUTH_SERVICE_UNAVAILABLE` và không có lối vào ở chế độ email.
    requestPasswordRecovery: (email) =>
      guard(async () => {
        try {
          await ops.sendPasswordReset(email.trim());
        } catch (error) {
          if (!isUserNotFound(error)) throw error;
        }
        return { retryAfterSeconds: PASSWORD_RESET_RESEND_SECONDS };
      }),
    verifyRecoveryCode: unavailable,
    resetPassword: unavailable,
    signOut: () => guard(() => ops.signOut()),
  };

  const shop: ShopApi = {
    createShop: (input) => guard(() => ops.callShop('createShop', input)),
    updateShop: (input) => guard(() => ops.callShop('updateShop', input)),
    getShop: (shopId) =>
      guard(async () => {
        const user = await ops.restoreUser();
        return user ? ops.readShopDetails(shopId, user.uid) : null;
      }),
  };

  const session: SessionApi = {
    restore: (): Promise<SessionState> =>
      guard(async () => {
        const user = await ops.restoreUser();
        if (!user) return 'signed_out';
        return (await ops.readShopIdForRestore(user.uid)) !== null
          ? 'signed_in'
          : 'signed_in_no_shop';
      }),
    // Không bịa ID: `readShopIdForRestore` thử bộ nhớ đệm rồi máy chủ; lỗi (offline, chưa có đệm) thì
    // ném lên để bên gọi giữ trạng thái "chưa biết" thay vì coi là không có shop.
    identity: (): Promise<SessionIdentity | null> =>
      guard(async () => {
        const user = await ops.restoreUser();
        if (!user) return null;
        // Tài khoản email/mật khẩu luôn có email. Thiếu thì không bịa chuỗi rỗng làm email thật: coi là
        // chưa xác định được danh tính (các nhà cung cấp khác có thể không có email: xem O-15).
        if (!user.email) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          signInMethod: signInMethodOf(user.providerIds),
          shopId: await ops.readShopIdForRestore(user.uid),
        };
      }),
  };

  return { auth, shop, session };
}

export type { CreatedShop };
