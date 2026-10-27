import { ORDER_SOURCES } from '@/core/orders/order-source';

import type { SellingSource } from './types';

/** Thứ tự hiển thị và thứ tự chuẩn khi lưu: Shopee, TikTok Shop, Lazada, Khác. */
export const SELLING_SOURCES: readonly SellingSource[] = ORDER_SOURCES;

/** Bỏ trùng và sắp theo thứ tự chuẩn; "Khác" là một lựa chọn như các nguồn còn lại. */
export function normalizeSources(sources: readonly SellingSource[]): SellingSource[] {
  return SELLING_SOURCES.filter((source) => sources.includes(source));
}

export function toggleSource(
  selected: readonly SellingSource[],
  source: SellingSource,
): SellingSource[] {
  return normalizeSources(
    selected.includes(source) ? selected.filter((s) => s !== source) : [...selected, source],
  );
}
