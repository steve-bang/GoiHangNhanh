import { createContext, useContext, type ReactNode } from 'react';

import type { ShopId } from '@/core/ids';

import { LOCAL_SHOP_ID } from '../domain/local-shop';

const CurrentShopContext = createContext<ShopId | null>(null);
const CurrentUidContext = createContext<string | null>(null);

/**
 * Cấp shop của phiên cho cây giao diện. Đặt ở composition root, nhận `shopId` từ phiên (feature
 * `personal`) để `orders` không phụ thuộc ngược vào `personal`. `null` = phiên chưa biết shop (chưa
 * nạp danh tính hoặc chưa có shop): dùng `LOCAL_SHOP_ID` như trước (Q-17d), không đoán shop khác.
 * `uid` là tài khoản đang đăng nhập (`null` = chưa biết): kho đơn ghi nó làm người tạo (Q-23g).
 */
export function CurrentShopProvider({
  shopId,
  uid = null,
  children,
}: {
  shopId: string | null;
  uid?: string | null;
  children: ReactNode;
}) {
  return (
    <CurrentShopContext.Provider value={shopId as ShopId | null}>
      <CurrentUidContext.Provider value={uid}>{children}</CurrentUidContext.Provider>
    </CurrentShopContext.Provider>
  );
}

/** uid tài khoản đang đăng nhập, hoặc `null` nếu chưa biết (chưa đăng nhập / ngoài provider). */
export function useCurrentUid(): string | null {
  return useContext(CurrentUidContext);
}

/**
 * Shop của phiên hiện tại: MỘT chỗ duy nhất để mọi màn lấy shop rồi truyền vào `OrderStore` (bất biến 8).
 * Đổi shop trong phiên thì giá trị này đổi theo và mọi hook nạp dữ liệu theo `shopId` nạp lại.
 */
export function useCurrentShopId(): ShopId {
  return useContext(CurrentShopContext) ?? LOCAL_SHOP_ID;
}
