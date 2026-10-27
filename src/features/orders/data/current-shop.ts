import type { ShopId } from '@/core/ids';

import { LOCAL_SHOP_ID } from '../domain/local-shop';

/**
 * Shop của phiên hiện tại: MỘT chỗ duy nhất để thay `LOCAL_SHOP_ID` bằng shop của phiên Firebase khi
 * có (O-15, decisions.md Q-17d). Mọi màn lấy shop từ đây rồi truyền vào `OrderStore`.
 */
export function useCurrentShopId(): ShopId {
  return LOCAL_SHOP_ID;
}
