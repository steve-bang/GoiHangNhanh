import type { OrderId, OrderLineId, PackageId, SessionId, ShopId } from '@/core/ids';

import type { OrderListPage, OrderListPageRequest, OrderListQuery } from './order-list';
import type { Order, OrderDetails, OrderLine, OrderPackage, PackingSession } from './types';
import type { OrderEdit } from './update-order';

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
  /**
   * Sửa nguồn bán, mã vận đơn và các dòng sản phẩm của đơn trong MỘT giao dịch (hoặc đủ hoặc không có
   * gì). Mã đơn KHÔNG sửa được. CHỈ khi đơn chưa có phiên đóng gói nào: đã có phiên thì ném
   * `ORDER_HAS_SESSION` (chưa có lịch sử thay đổi; bất biến 7; người dùng đã quyết định chưa làm lịch
   * sử, Q-22ah). Đơn không có hoặc thuộc shop khác ném `ORDER_NOT_FOUND`. `edit.lines` là TOÀN BỘ dòng
   * sau khi sửa: dòng có trong đơn được cập nhật, dòng không còn bị xóa, dòng mới được thêm. Trả đơn sau
   * khi sửa. Không đổi ảnh chụp đơn của phiên nào (không có phiên).
   */
  updateOrder(shopId: ShopId, orderId: OrderId, edit: OrderEdit): Promise<OrderDetails>;
  /** Thêm kiện cho đơn (được phép cả khi đơn đã có phiên: không đổi ảnh chụp của phiên cũ). */
  addPackage(shopId: ShopId, pkg: OrderPackage): Promise<void>;
  /**
   * Lưu phiên mới. Kiện đã có phiên đang thực hiện thì ném `PACKAGE_SESSION_ACTIVE` (không tạo phiên
   * chồng; docs/04 A03). Đơn/kiện không thuộc `session.shopId` thì ném `LOCAL_SAVE_UNAVAILABLE`.
   */
  saveSession(session: PackingSession): Promise<void>;
  getSession(shopId: ShopId, id: SessionId): Promise<PackingSession | null>;
  /**
   * Đặt trạng thái phiên cục bộ (luồng ghi video: `recording`, `ended`...) theo bảng chuyển hợp lệ
   * (`canChangeSessionStatus`, session-status.ts): lùi (ví dụ `confirmed` -> `recording`), nhảy cóc
   * và trạng thái lạ đều bị từ chối; đặt lại đúng trạng thái hiện tại là không đổi gì. Phiên không có
   * hoặc của shop khác, hoặc chuyển không hợp lệ thì ném `LOCAL_SAVE_UNAVAILABLE` và KHÔNG đổi gì.
   * Không đổi ảnh chụp đơn của phiên. Chưa có lịch sử đổi trạng thái (xem decisions.md, mục theo dõi).
   */
  updateSessionStatus(shopId: ShopId, id: SessionId, status: string): Promise<void>;
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
  /**
   * Như `countUnsynced` nhưng cho MỌI shop có dữ liệu trên máy này. CHỈ để bảo vệ dữ liệu khi đăng xuất
   * (đăng xuất rời cả tài khoản, không chỉ shop đang dùng; Q-20o). Không dùng để hiển thị dữ liệu của
   * shop khác: mọi truy vấn còn lại vẫn theo `shopId`. Hôm nay chưa có tệp bằng chứng nên luôn 0.
   */
  countUnsyncedOnDevice(): Promise<number>;
  /** Như `hasRecordingInProgress` nhưng cho mọi shop trên máy này (chỉ để chặn đăng xuất). Lỗi đọc ném `LOCAL_SAVE_UNAVAILABLE`. */
  hasRecordingOnDevice(): Promise<boolean>;
  /**
   * Lịch sử tìm kiếm gần đây (UI-B03; Q-22f/u). CHỈ lưu chuỗi người dùng đã chủ động tìm, cục bộ,
   * THEO shop (mọi hàm nhận `shopId`), không tạo/đổi dữ liệu đơn. `recordSearch` upsert theo khóa chuẩn
   * hóa (`toCodeKey`, nên "dh1" và "DH1" là một mục; chuỗi hiển thị lấy bản mới nhất), giữ tối đa
   * `MAX_RECENT_SEARCHES` mục mới nhất mỗi shop và bỏ mục cũ nhất khi vượt. Chuỗi rỗng bị bỏ qua.
   */
  recordSearch(shopId: ShopId, text: string, nowDevice: number): Promise<void>;
  /** Mới nhất trước, tối đa `limit`. */
  listRecentSearches(shopId: ShopId, limit: number): Promise<RecentSearch[]>;
  /** Xóa một mục theo chuỗi (so theo khóa chuẩn hóa) của shop; không có mục thì không lỗi. */
  removeRecentSearch(shopId: ShopId, text: string): Promise<void>;
  /** Xóa toàn bộ lịch sử tìm của MỘT shop (không đụng shop khác). */
  clearRecentSearches(shopId: ShopId): Promise<void>;
  /**
   * Đơn CẦN đăng lên máy chủ bởi `creatorUid`: đã có ít nhất một phiên (từ đó đơn không còn sửa được
   * nên đăng là thao tác tạo thuần, không cần cập nhật/xóa dòng; Q-23a), chưa đăng, và do CHÍNH
   * `creatorUid` tạo (`createdBy`). Đơn của người khác dùng chung máy, hoặc không rõ người tạo (tạo
   * trước khi có cột / lúc chưa biết uid), không bao giờ có mặt ở đây (Q-23g). Cũ nhất trước.
   */
  listOrdersPendingRemote(
    shopId: ShopId,
    limit: number,
    creatorUid: string,
  ): Promise<OrderDetails[]>;
  /**
   * Ghi nhận đơn đã có trên máy chủ (idempotent), cùng ĐÚNG các kiện trong `publishedPackageIds`
   * (những kiện `publishOrder` đã ghi, lấy từ bản đơn mà bộ đồng bộ đã đọc) và do `creatorUid` tạo.
   * Kiện thêm giữa lúc đăng, hay của người khác, KHÔNG được đánh dấu: chúng vẫn chờ lượt đăng riêng.
   */
  markOrderPublished(
    shopId: ShopId,
    orderId: OrderId,
    atDevice: number,
    creatorUid: string,
    publishedPackageIds: readonly PackageId[],
  ): Promise<void>;
  /** Ghi nhận một kiện đã có trên máy chủ (idempotent). */
  markPackagePublished(shopId: ShopId, packageId: PackageId, atDevice: number): Promise<void>;
  /**
   * Phiên CẦN đăng/cập nhật trạng thái trên máy chủ bởi `creatorUid`: do chính `creatorUid` bắt đầu,
   * trạng thái khác `created` (phiên `created` chưa có bằng chứng nên không đăng), khác trạng thái đã
   * đăng gần nhất, và đơn của nó đã đăng. `status` là trạng thái cục bộ hiện tại. Cũ nhất trước.
   */
  listSessionsPendingRemote(
    shopId: ShopId,
    limit: number,
    creatorUid: string,
  ): Promise<PendingSession[]>;
  /** Ghi nhận phiên đã đăng với `status` (idempotent). */
  markSessionPublished(shopId: ShopId, sessionId: SessionId, status: string): Promise<void>;
}

/**
 * Một phiên cần đăng. `packagePending`: kiện của phiên (do chính `creatorUid` tạo) CHƯA được ghi nhận
 * là đã đăng, nên phải đảm bảo kiện có trên máy chủ trước khi đăng phiên; `false` thì không cần đọc
 * hay ghi gì thêm cho kiện. Phiên trên kiện do người khác tạo mà kiện chưa đăng thì KHÔNG có mặt ở
 * danh sách (chờ họ đăng kiện).
 */
export interface PendingSession {
  readonly session: PackingSession;
  readonly status: string;
  readonly packagePending: boolean;
}

export interface RecentSearch {
  readonly text: string;
  /** Thời gian THIẾT BỊ lần tìm gần nhất. */
  readonly lastUsedAtDevice: number;
}
