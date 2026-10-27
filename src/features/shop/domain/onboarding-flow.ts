import type { OrderSource } from '@/core/orders/order-source';

import { normalizeSources, toggleSource } from './selling-sources';
import { SHOP_NAME_MAX_LENGTH } from './validation';
import type { AuthAccount, CreatedShop } from './types';

/**
 * Trạng thái luồng thiết lập (Tạo tài khoản -> Thông tin shop -> Hoàn tất). Chỉ nằm trong bộ nhớ
 * của phiên chạy app: giữ giá trị khi người dùng quay lại/tiến tới giữa các màn. KHÔNG chứa mật
 * khẩu. Mất khi app bị đóng; đó là chủ ý (chưa có gì cần khôi phục trước khi máy chủ xác nhận).
 */
export interface OnboardingState {
  readonly email: string;
  /** Có khi máy chủ đã xác nhận tạo tài khoản. */
  readonly account: AuthAccount | null;
  readonly shopName: string;
  readonly sources: readonly OrderSource[];
  /** Có khi máy chủ đã xác nhận tạo shop. */
  readonly shop: CreatedShop | null;
  /**
   * `uid` của tài khoản đã tạo `shop` (null: chưa có tài khoản lúc ghi nhận). Shop, tên shop và
   * nguồn bán chỉ thuộc về tài khoản này: đổi tài khoản thì xóa (bất biến #8, cô lập theo shop).
   */
  readonly shopOwnerUid: string | null;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  email: '',
  account: null,
  shopName: '',
  sources: [],
  shop: null,
  shopOwnerUid: null,
};

export type OnboardingAction =
  | { type: 'email_changed'; email: string }
  | { type: 'account_created'; account: AuthAccount }
  | { type: 'shop_name_changed'; name: string }
  | { type: 'source_toggled'; source: OrderSource }
  | { type: 'sources_cleared' }
  /**
   * `ownerUid`: tài khoản đã gọi cổng tạo/cập nhật (chụp lúc bắt đầu gọi). Kết quả đến muộn khi luồng
   * đã chuyển sang tài khoản khác thì bị bỏ qua. Không truyền = tài khoản hiện tại.
   */
  | { type: 'shop_created'; shop: CreatedShop; ownerUid?: string | null }
  | { type: 'reset' };

/** Xóa mọi dữ liệu gắn với một tài khoản trước đó (shop, tên shop, nguồn bán). */
function clearShopData(state: OnboardingState): OnboardingState {
  return { ...state, shopName: '', sources: [], shop: null, shopOwnerUid: null };
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case 'email_changed':
      return { ...state, email: action.email };
    case 'account_created': {
      // Tài khoản khác với tài khoản đang giữ dữ liệu shop: không để rò sang tài khoản mới.
      const uid = action.account.uid;
      const foreign =
        (state.account !== null && state.account.uid !== uid) ||
        (state.shop !== null && state.shopOwnerUid !== uid);
      return { ...(foreign ? clearShopData(state) : state), account: action.account };
    }
    case 'shop_name_changed':
      return {
        ...state,
        shopName: Array.from(action.name).slice(0, SHOP_NAME_MAX_LENGTH).join(''),
      };
    case 'source_toggled':
      return { ...state, sources: toggleSource(state.sources, action.source) };
    case 'sources_cleared':
      return { ...state, sources: [] };
    case 'shop_created': {
      const current = state.account?.uid ?? null;
      const owner = action.ownerUid === undefined ? current : action.ownerUid;
      if (owner !== current) return state;
      return {
        ...state,
        shop: action.shop,
        shopOwnerUid: owner,
        sources: normalizeSources(action.shop.sellingSources),
      };
    }
    case 'reset':
      return INITIAL_ONBOARDING_STATE;
  }
}
