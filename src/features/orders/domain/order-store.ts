import type { OrderId, OrderLineId, SessionId, ShopId } from '@/core/ids';

import type { Order, OrderDetails, OrderLine, OrderPackage, PackingSession } from './types';

/**
 * Cổng lưu cục bộ (SQLite trên máy, bản bộ nhớ cho test/web). Mọi truy vấn theo `shopId` (bất biến
 * 8). Lỗi lưu ném `AppError` (`LOCAL_SAVE_UNAVAILABLE`), không nuốt lỗi.
 */
export interface OrderStore {
  /** Ghi đơn + dòng + kiện trong MỘT giao dịch: hoặc đủ hoặc không có gì. */
  saveNewOrder(details: OrderDetails): Promise<void>;
  getOrder(id: OrderId): Promise<OrderDetails | null>;
  /** Đơn trùng khóa mã đơn HOẶC khóa mã vận đơn (khóa = chuẩn hóa, xem `toCodeKey`). Không chọn hộ. */
  findOrdersByCodes(
    shopId: ShopId,
    query: { orderCodeKey?: string; trackingCodeKey?: string },
  ): Promise<Order[]>;
  /** Các dòng đã nhập gần đây nhất (mới trước), để gợi ý. */
  listRecentLines(shopId: ShopId, limit: number): Promise<OrderLine[]>;
  /** Sửa số lượng của một dòng (trước khi quay). Không có dòng thì ném `LOCAL_SAVE_UNAVAILABLE`. */
  updateLineQuantity(lineId: OrderLineId, quantity: number): Promise<void>;
  addPackage(pkg: OrderPackage): Promise<void>;
  saveSession(session: PackingSession): Promise<void>;
  getSession(id: SessionId): Promise<PackingSession | null>;
}
