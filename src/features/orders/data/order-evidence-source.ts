import type { OrderId, ShopId } from '@/core/ids';
import type { FileState } from '@/features/evidence';

/** Trạng thái các tệp bằng chứng theo đơn (đơn không có trong map = chưa có tệp nào). */
export type EvidenceStatesByOrder = ReadonlyMap<OrderId, readonly FileState[]>;

/**
 * NGUỒN DUY NHẤT của trạng thái tệp bằng chứng cho danh sách/chi tiết đơn. HIỆN CHƯA CÓ bằng chứng
 * thật (chưa ghi video, chưa có bảng tệp): luôn trả rỗng, nên mọi đơn là "Chưa có video". Phiên
 * `created` KHÔNG phải bằng chứng (bất biến 3) nên cố ý không đọc từ phiên. Khi có kho tệp bằng
 * chứng (recorder/hàng đợi tải lên), đọc ở đây theo `shopId` và thay điều kiện `withoutVideo` của
 * `OrderStore` cho khớp (xem `OrderListQuery.withoutVideo`).
 */
export async function loadEvidenceStates(
  _shopId: ShopId,
  _orderIds: readonly OrderId[],
): Promise<EvidenceStatesByOrder> {
  return new Map();
}
