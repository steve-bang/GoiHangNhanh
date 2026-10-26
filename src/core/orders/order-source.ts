/**
 * Nguồn bán (docs/04 A02, docs/09 UI-A04/B04): Shopee, TikTok Shop, Lazada, Khác/chưa xác định.
 * Giá trị do người dùng chọn, không phải dữ liệu xác nhận từ sàn (CLAUDE.md #10).
 * Nhãn chữ nằm ở i18n `common:sources.<giá trị>`.
 */
export const ORDER_SOURCES = ['shopee', 'tiktok_shop', 'lazada', 'other'] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

/** Chuỗi ngoài (tham số route...) -> nguồn hợp lệ; không nhận ra thì "Khác / chưa xác định". */
export function toOrderSource(value: string | undefined): OrderSource {
  return ORDER_SOURCES.find((source) => source === value) ?? 'other';
}
