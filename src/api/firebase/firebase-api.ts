import { AppError } from '@/core/errors/app-error';

import type {
  ApiClient,
  AuthApi,
  CreatedShop,
  SessionApi,
  SessionState,
  ShopApi,
} from '../contract';

import { guard } from './error-map';
import type { FirebaseServices } from './client';
import { createFirebaseOps, type FirebaseOps } from './ops';

const unavailable = () => Promise.reject(new AppError('AUTH_SERVICE_UNAVAILABLE'));

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
        return {
          uid: user.uid,
          email: user.email ?? input.email.trim(),
          emailVerified: user.emailVerified,
          hasShop: (await ops.readShopId(user.uid)) !== null,
        };
      }),
    // Đăng nhập Apple/Google chưa làm (O-15); khôi phục mật khẩu chờ O-22 (hướng B): không giả vờ thành công.
    signInWithProvider: unavailable,
    requestPasswordRecovery: unavailable,
    verifyRecoveryCode: unavailable,
    resetPassword: unavailable,
  };

  const shop: ShopApi = {
    createShop: (input) => guard(() => ops.callShop('createShop', input)),
    updateShop: (input) => guard(() => ops.callShop('updateShop', input)),
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
  };

  return { auth, shop, session };
}

export type { CreatedShop };
