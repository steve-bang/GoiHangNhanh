import type { ApiClient, ShopDetails } from '@/api/contract';
import { AppError } from '@/core/errors/app-error';

import { normalizeDisplayName, normalizeShopName } from '../domain/validation';
import type { PersonalGateways, ShopSummary, UserProfile } from '../domain/types';
import { createUnavailablePersonalGateways } from './unavailable-personal-gateways';

/** Thành viên đọc được shop thì shop đang hoạt động (thành viên khác/shop khóa không đọc được: Rules). */
const toSummary = (shop: ShopDetails): ShopSummary => ({
  id: shop.id,
  name: shop.name,
  role: shop.role,
  status: 'active',
  canEdit: shop.canEdit,
});

/**
 * Cổng cá nhân ở chế độ Firebase, thật qua `ApiClient`: danh tính phiên, hồ sơ, shop đang dùng, đăng
 * xuất (PR1 release-hardening), và từ V1-05: danh sách shop, đổi tên shop (Function `updateShop`), đổi
 * họ tên (Auth), đổi mật khẩu (xác thực lại), chuyển shop (máy chủ chỉ cho một shop mỗi tài khoản: chỉ
 * shop đang dùng hợp lệ). Mọi hàm chỉ resolve khi máy chủ xác nhận. Cài đặt thông báo GIỮ "chưa kết
 * nối" (v1 không gửi thông báo; mục menu đã ẩn, decisions.md Q-29 / V1-05).
 */
export function createFirebasePersonalGateways(api: ApiClient): PersonalGateways {
  const { settings } = createUnavailablePersonalGateways();

  const identityOrThrow = async () => {
    const identity = await api.session.identity();
    // Chưa đăng nhập: không có hồ sơ để hiện (bên gọi coi như lỗi, không bịa).
    if (!identity) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
    return identity;
  };

  return {
    account: {
      getSessionIdentity: () => api.session.identity(),
      async getProfile(): Promise<UserProfile> {
        const identity = await identityOrThrow();
        // Không bịa phương thức đăng nhập: không xác định được thì báo chưa kết nối (màn hồ sơ cho thử lại).
        if (!identity.signInMethod) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
        return {
          uid: identity.uid,
          email: identity.email,
          displayName: identity.displayName,
          signInMethod: identity.signInMethod,
        };
      },
      async getShopSummary(): Promise<ShopSummary | null> {
        const identity = await identityOrThrow();
        if (identity.shopId === null) return null;
        const shop = await api.shop.getShop(identity.shopId);
        return shop ? toSummary(shop) : null;
      },
      async listShops(): Promise<readonly ShopSummary[]> {
        return (await api.shop.listMyShops()).map(toSummary);
      },
      async updateShopName(shopId: string, name: string): Promise<ShopSummary> {
        return toSummary(await api.shop.renameShop(shopId, normalizeShopName(name)));
      },
      /**
       * Máy chủ chưa có khái niệm "shop đang dùng" ngoài `userShops/{uid}` (một shop mỗi tài khoản,
       * client không ghi được). Chỉ shop đang dùng và còn đọc được mới hợp lệ; shop khác thì từ chối
       * thay vì đổi phiên sang shop mà lần mở app sau không khôi phục lại. Các chặn đang quay/tệp chưa
       * đồng bộ nằm ở `use-switch-shop.ts`, chạy TRƯỚC lời gọi này.
       */
      async switchShop(shopId: string): Promise<ShopSummary> {
        const [identity, shops] = await Promise.all([identityOrThrow(), api.shop.listMyShops()]);
        const shop = shops.find((candidate) => candidate.id === shopId);
        if (!shop || identity.shopId !== shopId) throw new AppError('SHOP_SWITCH_FAILED');
        return toSummary(shop);
      },
      async updateProfile(input): Promise<UserProfile> {
        const identity = await identityOrThrow();
        if (!identity.signInMethod) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
        const { displayName } = await api.auth.updateDisplayName(
          normalizeDisplayName(input.displayName),
        );
        return {
          uid: identity.uid,
          email: identity.email,
          displayName,
          signInMethod: identity.signInMethod,
        };
      },
      changePassword: (input) => api.auth.changePassword(input),
      deleteAccount: (password) => api.auth.deleteAccount({ password }),
      signOut: () => api.auth.signOut(),
    },
    settings,
  };
}
