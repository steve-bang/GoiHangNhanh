import type { ApiClient } from '@/api/contract';
import { AppError } from '@/core/errors/app-error';

import type { PersonalGateways, ShopSummary, UserProfile } from '../domain/types';
import { createUnavailablePersonalGateways } from './unavailable-personal-gateways';

/**
 * Cổng cá nhân ở chế độ Firebase: nối TỐI THIỂU danh tính phiên, hồ sơ, shop đang dùng và đăng xuất
 * thật qua `ApiClient` (PR1 của release-hardening-plan.md). Mọi cổng còn lại (đổi mật khẩu, danh sách/
 * chuyển shop, đổi tên, cài đặt thông báo, cập nhật hồ sơ) GIỮ "chưa kết nối" cho tới PR riêng
 * (decisions.md Q-20t): không giả thành công.
 */
export function createFirebasePersonalGateways(api: ApiClient): PersonalGateways {
  const unavailable = createUnavailablePersonalGateways();

  const identityOrThrow = async () => {
    const identity = await api.session.identity();
    // Chưa đăng nhập: không có hồ sơ để hiện (bên gọi coi như lỗi, không bịa).
    if (!identity) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
    return identity;
  };

  return {
    account: {
      ...unavailable.account,
      getSessionIdentity: () => api.session.identity(),
      async getProfile(): Promise<UserProfile> {
        const identity = await identityOrThrow();
        return {
          uid: identity.uid,
          email: identity.email,
          displayName: identity.displayName,
          // Mới có đăng nhập bằng mật khẩu (Apple/Google chưa nối, O-15).
          signInMethod: 'password',
        };
      },
      async getShopSummary(): Promise<ShopSummary | null> {
        const identity = await identityOrThrow();
        if (identity.shopId === null) return null;
        const shop = await api.shop.getShop(identity.shopId);
        if (!shop) return null;
        return {
          id: shop.id,
          name: shop.name,
          role: shop.role,
          status: 'active',
          canEdit: shop.canEdit,
        };
      },
      signOut: () => api.auth.signOut(),
    },
    settings: unavailable.settings,
  };
}
