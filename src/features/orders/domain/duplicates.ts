import type { OrderSource } from '@/core/orders/order-source';

import { toCodeKey } from './codes';
import type { Order } from './types';

export interface DuplicateMatches {
  /** Cùng mã đơn VÀ cùng nguồn bán: đúng điều A02 yêu cầu kiểm tra trước khi tạo. */
  readonly sameOrder: readonly Order[];
  /** Cùng mã đơn nhưng khác nguồn bán VÀ không trùng mã vận đơn: báo để người dùng tự xem, không coi là trùng. */
  readonly sameCodeOtherSource: readonly Order[];
  /**
   * Cùng mã vận đơn với đơn khác (kể cả đơn khác nguồn hoặc khác mã đơn): CÓ cảnh báo, vì một mã vận
   * đơn chỉ nên thuộc một đơn. Không nằm đồng thời trong `sameOrder`.
   */
  readonly sameTracking: readonly Order[];
}

/**
 * Phân loại các bản ghi tìm thấy. Chỉ phân loại, KHÔNG chọn hộ (bất biến 5, ADR-011): người dùng
 * quyết định dùng đơn nào hoặc tạo hồ sơ mới.
 */
export function classifyMatches(
  matches: readonly Order[],
  input: { orderCode: string; source: OrderSource; trackingCode?: string | null },
): DuplicateMatches {
  const codeKey = toCodeKey(input.orderCode);
  const trackingKey = input.trackingCode ? toCodeKey(input.trackingCode) : null;
  const sameOrder: Order[] = [];
  const sameCodeOtherSource: Order[] = [];
  const sameTracking: Order[] = [];
  for (const order of matches) {
    const sameCode = toCodeKey(order.orderCode) === codeKey;
    const sameTrackingCode =
      trackingKey !== null &&
      order.trackingCode !== null &&
      toCodeKey(order.trackingCode) === trackingKey;
    if (sameCode && order.source === input.source) sameOrder.push(order);
    else if (sameTrackingCode) sameTracking.push(order);
    else if (sameCode) sameCodeOtherSource.push(order);
  }
  return { sameOrder, sameCodeOtherSource, sameTracking };
}

export const hasDuplicates = (found: DuplicateMatches): boolean =>
  found.sameOrder.length + found.sameTracking.length > 0;
