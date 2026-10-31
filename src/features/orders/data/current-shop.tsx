import { createContext, useContext, type ReactNode } from 'react';

import type { ShopId } from '@/core/ids';

import { LOCAL_SHOP_ID } from '../domain/local-shop';

const CurrentShopContext = createContext<ShopId | null>(null);
const CurrentUidContext = createContext<string | null>(null);
/** Chế độ chặt (V1-06): chưa biết shop thì KHÔNG ghi dưới `LOCAL_SHOP_ID`. Mặc định `false` (giữ hành vi cũ). */
const StrictShopContext = createContext<boolean>(false);

/**
 * Cấp shop của phiên cho cây giao diện. Đặt ở composition root, nhận `shopId` từ phiên (feature
 * `personal`) để `orders` không phụ thuộc ngược vào `personal`. `null` = phiên chưa biết shop (chưa
 * nạp danh tính hoặc chưa có shop): dùng `LOCAL_SHOP_ID` như trước (Q-17d), không đoán shop khác.
 * `uid` là tài khoản đang đăng nhập (`null` = chưa biết): kho đơn ghi nó làm người tạo (Q-23g).
 */
export function CurrentShopProvider({
  shopId,
  uid = null,
  strict = false,
  children,
}: {
  shopId: string | null;
  uid?: string | null;
  /** `true` ở bản Firebase/"chưa kết nối": `useWritableShopId()` trả `null` khi chưa biết shop. */
  strict?: boolean;
  children: ReactNode;
}) {
  return (
    <CurrentShopContext.Provider value={shopId as ShopId | null}>
      <CurrentUidContext.Provider value={uid}>
        <StrictShopContext.Provider value={strict}>{children}</StrictShopContext.Provider>
      </CurrentUidContext.Provider>
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

/**
 * Shop để GHI bản ghi mới (đơn, phiên quay, hồ sơ hàng hoàn). `null` = không được ghi: chế độ chặt
 * (bản Firebase) mà phiên chưa biết shop thật. Bản ghi dưới `LOCAL_SHOP_ID` ở bản Firebase không bao
 * giờ được đăng lên máy chủ (CLAUDE.md "Cần lưu ý"), nên bên gọi phải dừng TRƯỚC khi ghi (và trước
 * khi bắt đầu quay: bất biến 2). Lớp phòng thủ thứ hai: cổng phiên (`SessionGate`) đã chặn màn từ trước.
 * Ngoài chế độ chặt (cổng giả) giữ hành vi cũ: rơi về `LOCAL_SHOP_ID`.
 */
export function useWritableShopId(): ShopId | null {
  const shopId = useContext(CurrentShopContext);
  const strict = useContext(StrictShopContext);
  if (shopId) return shopId;
  return strict ? null : LOCAL_SHOP_ID;
}
