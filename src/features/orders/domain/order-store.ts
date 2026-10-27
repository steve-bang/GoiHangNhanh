import type { OrderId, OrderLineId, SessionId, ShopId } from '@/core/ids';

import type { Order, OrderDetails, OrderLine, OrderPackage, PackingSession } from './types';

/**
 * Cổng lưu cục bộ (SQLite trên máy, bản bộ nhớ cho test/web). MỌI thao tác nhận `shopId` của cửa
 * hàng hiện tại (hoặc đọc từ bản ghi được ghi) và chỉ thấy bản ghi của shop đó: bản ghi shop khác
 * coi như không tồn tại, kể cả khi biết ID (bất biến 8). Lỗi ném `AppError`, không nuốt lỗi:
 * `ORDER_SAVE_FAILED` cho đơn/dòng/kiện; `LOCAL_SAVE_UNAVAILABLE` cho phiên.
 */
export interface OrderStore {
  /** Ghi đơn + dòng + kiện trong MỘT giao dịch: hoặc đủ hoặc không có gì. */
  saveNewOrder(details: OrderDetails): Promise<void>;
  getOrder(shopId: ShopId, id: OrderId): Promise<OrderDetails | null>;
  /** Đơn trùng khóa mã đơn HOẶC khóa mã vận đơn (khóa = chuẩn hóa, xem `toCodeKey`). Không chọn hộ. */
  findOrdersByCodes(
    shopId: ShopId,
    query: { orderCodeKey?: string; trackingCodeKey?: string },
  ): Promise<Order[]>;
  /** Các dòng đã nhập gần đây nhất (mới trước), để gợi ý. */
  listRecentLines(shopId: ShopId, limit: number): Promise<OrderLine[]>;
  /**
   * Sửa số lượng của một dòng, CHỈ khi đơn chưa có phiên đóng gói nào. Đơn đã có phiên thì ném
   * `ORDER_HAS_SESSION` (chưa có bảng lịch sử thay đổi; bất biến 7). Không có dòng (hoặc dòng thuộc
   * shop khác) thì ném `ORDER_SAVE_FAILED`.
   */
  updateLineQuantity(shopId: ShopId, lineId: OrderLineId, quantity: number): Promise<void>;
  /** Thêm kiện cho đơn (được phép cả khi đơn đã có phiên: không đổi ảnh chụp của phiên cũ). */
  addPackage(shopId: ShopId, pkg: OrderPackage): Promise<void>;
  /**
   * Lưu phiên mới. Kiện đã có phiên đang thực hiện thì ném `PACKAGE_SESSION_ACTIVE` (không tạo phiên
   * chồng; docs/04 A03). Đơn/kiện không thuộc `session.shopId` thì ném `LOCAL_SAVE_UNAVAILABLE`.
   */
  saveSession(session: PackingSession): Promise<void>;
  getSession(shopId: ShopId, id: SessionId): Promise<PackingSession | null>;
  /** Mọi phiên của đơn (mới nhất trước). Dùng để khóa sửa dòng và tìm phiên đang thực hiện. */
  listSessionsOfOrder(shopId: ShopId, orderId: OrderId): Promise<PackingSession[]>;
}
