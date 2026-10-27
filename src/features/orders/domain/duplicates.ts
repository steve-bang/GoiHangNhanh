import type { OrderSource } from '@/core/orders/order-source';

import { toCodeKey } from './codes';
import type { Order } from './types';

export interface DuplicateMatches {
  /** Cùng mã đơn VÀ cùng nguồn bán: đúng điều A02 yêu cầu kiểm tra trước khi tạo. */
  readonly sameOrder: readonly Order[];
  /** Cùng mã đơn nhưng khác nguồn bán: báo để người dùng tự xem, không coi là trùng. */
  readonly sameCodeOtherSource: readonly Order[];
  /** Cùng mã vận đơn (khác các nhóm trên). */
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
    if (toCodeKey(order.orderCode) === codeKey) {
      (order.source === input.source ? sameOrder : sameCodeOtherSource).push(order);
    } else if (trackingKey && order.trackingCode && toCodeKey(order.trackingCode) === trackingKey) {
      sameTracking.push(order);
    }
  }
  return { sameOrder, sameCodeOtherSource, sameTracking };
}

export const hasDuplicates = (found: DuplicateMatches): boolean =>
  found.sameOrder.length + found.sameTracking.length > 0;
