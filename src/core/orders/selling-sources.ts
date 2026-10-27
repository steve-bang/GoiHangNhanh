import { ORDER_SOURCES, type OrderSource } from './order-source';

/** Thứ tự hiển thị và thứ tự chuẩn khi lưu: Shopee, TikTok Shop, Lazada, Khác. */
export const SELLING_SOURCES: readonly OrderSource[] = ORDER_SOURCES;

/** Bỏ trùng và sắp theo thứ tự chuẩn; "Khác" là một lựa chọn như các nguồn còn lại. */
export function normalizeSources(sources: readonly OrderSource[]): OrderSource[] {
  return SELLING_SOURCES.filter((source) => sources.includes(source));
}
