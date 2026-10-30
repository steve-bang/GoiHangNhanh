import { AppError } from '@/core/errors/app-error';

import type { AuthApi, ApiClient, SessionApi, ShopApi } from '../contract';

/**
 * Cổng "chưa kết nối": dùng ở bản build thường khi chưa có máy chủ thật. Mọi lời gọi đều trả lỗi
 * nghiệp vụ `AUTH_SERVICE_UNAVAILABLE`; KHÔNG BAO GIỜ báo đã tạo tài khoản/shop khi chưa có máy chủ
 * xác nhận (CLAUDE.md #3, #11).
 */
const unavailable = () => Promise.reject(new AppError('AUTH_SERVICE_UNAVAILABLE'));

export function createUnavailableApi(): ApiClient {
  const auth: AuthApi = {
    signUpWithEmail: unavailable,
    signInWithProvider: unavailable,
    signInWithPassword: unavailable,
    requestPasswordRecovery: unavailable,
    verifyRecoveryCode: unavailable,
    resetPassword: unavailable,
    signOut: unavailable,
    changePassword: unavailable,
    updateDisplayName: unavailable,
  };
  const shop: ShopApi = {
    createShop: unavailable,
    updateShop: unavailable,
    getShop: unavailable,
    listMyShops: unavailable,
    renameShop: unavailable,
  };
  // Không có máy chủ nên không có phiên nào để khôi phục: luôn lỗi, màn Splash coi như chưa đăng nhập.
  const session: SessionApi = { restore: unavailable, identity: unavailable };
  return { auth, shop, session };
}
