import { createContext, useContext, type ReactNode } from 'react';

import type { ShopId } from '@/core/ids';

import { LOCAL_SHOP_ID } from '../domain/local-shop';

const CurrentShopContext = createContext<ShopId | null>(null);

/**
 * Cấp shop của phiên cho cây giao diện. Đặt ở composition root, nhận `shopId` từ phiên (feature
 * `personal`) để `orders` không phụ thuộc ngược vào `personal`. `null` = phiên chưa biết shop (chưa
 * nạp danh tính hoặc chưa có shop): dùng `LOCAL_SHOP_ID` như trước (Q-17d), không đoán shop khác.
 */
export function CurrentShopProvider({
  shopId,
  children,
}: {
  shopId: string | null;
  children: ReactNode;
}) {
  return (
    <CurrentShopContext.Provider value={shopId as ShopId | null}>
      {children}
    </CurrentShopContext.Provider>
  );
}

/**
 * Shop của phiên hiện tại: MỘT chỗ duy nhất để mọi màn lấy shop rồi truyền vào `OrderStore` (bất biến 8).
 * Đổi shop trong phiên thì giá trị này đổi theo và mọi hook nạp dữ liệu theo `shopId` nạp lại.
 */
export function useCurrentShopId(): ShopId {
  return useContext(CurrentShopContext) ?? LOCAL_SHOP_ID;
}
