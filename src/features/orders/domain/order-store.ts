import type { OrderId, OrderLineId, SessionId, ShopId } from '@/core/ids';

import type { OrderListPage, OrderListPageRequest, OrderListQuery } from './order-list';
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
  /**
   * Một trang danh sách đơn của shop: sắp theo hoạt động gần nhất (MAX(thời điểm tạo, mốc phiên mới
   * nhất)) rồi `id` giảm dần, phân trang keyset (`after` = con trỏ của thẻ cuối trang trước; đơn mới
   * chèn vào giữa chừng không làm trùng thẻ). Đọc lỗi ném `ORDER_SAVE_FAILED`.
   */
  listOrders(
    shopId: ShopId,
    query: OrderListQuery,
    page: OrderListPageRequest,
  ): Promise<OrderListPage>;
  /** Số đơn của shop khớp truy vấn (cùng điều kiện với `listOrders`). */
  countOrders(shopId: ShopId, query: OrderListQuery): Promise<number>;
  /** Mọi phiên của đơn (mới nhất trước). Dùng để khóa sửa dòng và tìm phiên đang thực hiện. */
  listSessionsOfOrder(shopId: ShopId, orderId: OrderId): Promise<PackingSession[]>;
  /**
   * Số tệp bằng chứng trên máy này của shop mà máy chủ CHƯA xác nhận (định nghĩa trung thực): tệp
   * cục bộ có trạng thái chưa tới `uploaded`/`verified` (docs/06; `file-state.ts`). HÔM NAY chưa có
   * bảng tệp bằng chứng hay hàng đợi tải lên (chưa ghi video; `loadEvidenceStates` rỗng, Q-18) nên
   * chắc chắn không có tệp nào và hàm trả 0 vì sự thật đó, không phải ước lượng. Khi có kho tệp,
   * ĐỌC TỪ ĐÓ theo `shopId` (đổi ở đây, hợp đồng giữ nguyên). Phiên `created` không phải bằng chứng.
   */
  countUnsynced(shopId: ShopId): Promise<number>;
  /**
   * Shop có phiên đang GHI VIDEO không (`isSessionStatusRecording`), để chặn đăng xuất. Chỉ tính
   * phiên của `shopId`. `created` không tính (xem `RECORDING_SESSION_STATUS`). Đọc lỗi ném
   * `LOCAL_SAVE_UNAVAILABLE`: bên gọi KHÔNG được coi lỗi là "không quay" (chặn theo hướng bảo thủ).
   */
  hasRecordingInProgress(shopId: ShopId): Promise<boolean>;
}
