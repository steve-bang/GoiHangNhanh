import { AppError } from '@/core/errors/app-error';

import type { AuthGateway, Gateways, SessionGateway, ShopGateway } from '../domain/types';

/**
 * Cổng "chưa kết nối": dùng ở bản build thường khi chưa có máy chủ thật. Mọi lời gọi đều trả lỗi
 * nghiệp vụ `AUTH_SERVICE_UNAVAILABLE`; KHÔNG BAO GIỜ báo đã tạo tài khoản/shop khi chưa có máy chủ
 * xác nhận (CLAUDE.md #3, #11).
 */
const unavailable = () => Promise.reject(new AppError('AUTH_SERVICE_UNAVAILABLE'));

export function createUnavailableGateways(): Gateways {
  const auth: AuthGateway = {
    signUpWithEmail: unavailable,
    signInWithProvider: unavailable,
    signInWithPassword: unavailable,
    requestPasswordRecovery: unavailable,
    verifyRecoveryCode: unavailable,
    resetPassword: unavailable,
  };
  const shop: ShopGateway = { createShop: unavailable, updateShop: unavailable };
  // Không có máy chủ nên không có phiên nào để khôi phục: luôn lỗi, màn Splash coi như chưa đăng nhập.
  const session: SessionGateway = { restore: unavailable };
  return { auth, shop, session };
}
