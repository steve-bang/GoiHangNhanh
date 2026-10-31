import type { OrderId, ShopId } from '@/core/ids';
import type { EvidenceFileStore, FileState } from '@/features/evidence';

import type { OrderEvidenceItem } from '../domain/evidence-items';

/** Trạng thái các tệp bằng chứng theo đơn (đơn không có trong map = chưa có tệp nào). */
export type EvidenceStatesByOrder = ReadonlyMap<OrderId, readonly FileState[]>;

/**
 * NGUỒN DUY NHẤT của trạng thái tệp bằng chứng cho danh sách/chi tiết đơn: đọc từ kho tệp bằng chứng
 * theo `shopId`. Phiên `created` KHÔNG phải bằng chứng (bất biến 3) nên không đọc từ phiên; chưa có
 * tệp nào (ví dụ recorder đang tắt) thì map rỗng và mọi đơn là "Chưa có video".
 */
export async function loadEvidenceStates(
  files: EvidenceFileStore,
  shopId: ShopId,
  orderIds: readonly OrderId[],
): Promise<EvidenceStatesByOrder> {
  const result = new Map<OrderId, FileState[]>();
  for (const file of await files.listByOrders(shopId, orderIds)) {
    const states = result.get(file.orderId) ?? [];
    states.push(file.state);
    result.set(file.orderId, states);
  }
  return result;
}

/**
 * Danh sách tệp bằng chứng của MỘT đơn (UI-E03), cũ nhất trước, cùng nguồn với `loadEvidenceStates`.
 * Giờ là giờ THIẾT BỊ lúc tạo tệp (không phải thời gian máy chủ). Không dựng mục từ phiên `created`.
 */
export async function loadEvidenceItems(
  files: EvidenceFileStore,
  shopId: ShopId,
  orderId: OrderId,
): Promise<readonly OrderEvidenceItem[]> {
  return (await files.listByOrder(shopId, orderId)).map((file) => ({
    id: file.id,
    group: file.group,
    kind: file.kind,
    sessionId: file.sessionId,
    capturedAtDevice: file.createdAtDevice,
    state: file.state,
  }));
}
