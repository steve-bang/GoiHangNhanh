import type { ShopSummary } from './types';

/**
 * Chỉ hiện ô tìm khi tài khoản có từ ngần này cửa hàng: ít hơn thì cuộn mắt là đủ, ô tìm chỉ thêm việc
 * (đề xuất ở personal-tab-redesign-plan.md, khung 7a; chưa có số liệu thực tế về số cửa hàng mỗi tài khoản).
 */
export const SHOP_SEARCH_MIN_SHOPS = 6;

/** Bỏ dấu, đổi chữ thường, cắt khoảng trắng đầu/cuối để "my pham" khớp "Shop Mỹ Phẩm". */
export function foldForSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim();
}

/** Lọc theo tên (chứa chuỗi tìm, không phân biệt dấu/hoa thường). Chuỗi tìm rỗng: giữ nguyên danh sách. */
export function filterShopsByName(
  shops: readonly ShopSummary[],
  query: string,
): readonly ShopSummary[] {
  const needle = foldForSearch(query);
  if (needle === '') return shops;
  return shops.filter((shop) => foldForSearch(shop.name).includes(needle));
}
