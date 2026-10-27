import type { OrderId, OrderLineId, PackageId, SessionId, ShopId } from '@/core/ids';
import type { OrderSource } from '@/core/orders/order-source';

/**
 * Mọi thông tin đơn ở giai đoạn này do người dùng nhập; không bao giờ trình bày như dữ liệu chính
 * thức từ sàn (CLAUDE.md bất biến 10).
 */
export type DataOrigin = 'entered_by_user';

/**
 * Đơn tối giản: mã đơn + nguồn bán (+ mã vận đơn) để định danh/tìm kiếm. `id` mới là định danh;
 * `orderCode` và `trackingCode` chỉ là thuộc tính tìm kiếm (bất biến 1). Thời gian là thời gian
 * THIẾT BỊ (hậu tố `Device`), khác thời gian máy chủ.
 */
export interface Order {
  readonly id: OrderId;
  readonly shopId: ShopId;
  readonly orderCode: string;
  readonly source: OrderSource;
  readonly trackingCode: string | null;
  readonly dataOrigin: DataOrigin;
  readonly createdAtDevice: number;
}

/** Một dòng sản phẩm để đối chiếu. Tên và variant là hai trường riêng; không bao giờ gộp variant. */
export interface OrderLine {
  readonly id: OrderLineId;
  readonly orderId: OrderId;
  readonly name: string;
  readonly variant: string | null;
  readonly quantity: number;
  /** Thứ tự hiển thị trong đơn (từ 0). */
  readonly position: number;
  readonly dataOrigin: DataOrigin;
  readonly createdAtDevice: number;
}

/** Kiện hàng: mỗi kiện có ID riêng; `index` (từ 1) chỉ để hiển thị. */
export interface OrderPackage {
  readonly id: PackageId;
  readonly orderId: OrderId;
  readonly index: number;
  readonly createdAtDevice: number;
}

export interface OrderDetails {
  readonly order: Order;
  readonly lines: readonly OrderLine[];
  readonly packages: readonly OrderPackage[];
}

/** Ảnh chụp dữ liệu đơn tại thời điểm bắt đầu quay (docs/04 A03): sửa đơn sau đó không đổi ảnh chụp. */
export interface OrderSnapshot {
  readonly orderCode: string;
  readonly source: OrderSource;
  readonly trackingCode: string | null;
  readonly lines: readonly {
    readonly name: string;
    readonly variant: string | null;
    readonly quantity: number;
  }[];
  readonly packageIndex: number;
  readonly packageCount: number;
  readonly takenAtDevice: number;
}

/**
 * Phiên đóng gói (docs/04 A03): ID phiên + đơn + kiện được tạo TRƯỚC khi mở camera (bất biến 2).
 * `sessionStatus` chỉ có `created`: chưa ghi video nên chưa có tệp, chưa phải bằng chứng và tuyệt
 * đối không có trạng thái "đã lưu" (bất biến 3).
 */
export interface PackingSession {
  readonly id: SessionId;
  readonly shopId: ShopId;
  readonly orderId: OrderId;
  readonly packageId: PackageId;
  readonly startedAtDevice: number;
  readonly snapshot: OrderSnapshot;
  readonly sessionStatus: 'created';
}
