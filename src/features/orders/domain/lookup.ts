import { toCodeKey } from './codes';
import type { Order } from './types';

/** Vì sao một đơn khớp mã đang tra: chỉ để người dùng phân biệt, không phải kết luận. */
export type MatchReason = 'orderCode' | 'trackingCode';

export interface LookupMatch {
  readonly order: Order;
  readonly reasons: readonly MatchReason[];
}

/**
 * Kết quả tra cứu MỘT mã (quét, nhập tay, tìm): không có / đúng một / nhiều. Chỉ phân loại, KHÔNG
 * chọn hộ: `many` luôn bắt người dùng chọn, không có phần tử nào được ưu tiên (bất biến 5).
 */
export type LookupResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly match: LookupMatch }
  | { readonly kind: 'many'; readonly matches: readonly LookupMatch[] };

/** Lý do khớp của một đơn với mã đã nhập (so khóa chuẩn hóa `toCodeKey`). */
export function matchReasons(order: Order, code: string): MatchReason[] {
  const key = toCodeKey(code);
  const reasons: MatchReason[] = [];
  if (toCodeKey(order.orderCode) === key) reasons.push('orderCode');
  if (order.trackingCode !== null && toCodeKey(order.trackingCode) === key) {
    reasons.push('trackingCode');
  }
  return reasons;
}

/**
 * Phân loại kết quả `findOrdersByCodes` cho `code`. Chỉ giữ đơn thật sự khớp khóa (phòng kho trả
 * thừa); giữ thứ tự kho trả về (mới nhất trước) nhưng không gắn mặc định chọn.
 */
export function classifyLookup(found: readonly Order[], code: string): LookupResult {
  const matches: LookupMatch[] = [];
  const seen = new Set<string>();
  for (const order of found) {
    if (seen.has(order.id)) continue;
    const reasons = matchReasons(order, code);
    if (reasons.length === 0) continue;
    seen.add(order.id);
    matches.push({ order, reasons });
  }
  const [first, ...rest] = matches;
  if (!first) return { kind: 'none' };
  if (rest.length === 0) return { kind: 'one', match: first };
  return { kind: 'many', matches };
}
