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
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  email: '',
  account: null,
  shopName: '',
  sources: [],
  shop: null,
};

export type OnboardingAction =
  | { type: 'email_changed'; email: string }
  | { type: 'account_created'; account: AuthAccount }
  | { type: 'shop_name_changed'; name: string }
  | { type: 'source_toggled'; source: OrderSource }
  | { type: 'sources_cleared' }
  | { type: 'shop_created'; shop: CreatedShop }
  | { type: 'reset' };

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case 'email_changed':
      return { ...state, email: action.email };
    case 'account_created':
      return { ...state, account: action.account };
    case 'shop_name_changed':
      return {
        ...state,
        shopName: Array.from(action.name).slice(0, SHOP_NAME_MAX_LENGTH).join(''),
      };
    case 'source_toggled':
      return { ...state, sources: toggleSource(state.sources, action.source) };
    case 'sources_cleared':
      return { ...state, sources: [] };
    case 'shop_created':
      return { ...state, shop: action.shop, sources: normalizeSources(action.shop.sellingSources) };
    case 'reset':
      return INITIAL_ONBOARDING_STATE;
  }
}
