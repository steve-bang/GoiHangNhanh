import type { ShopSummary } from './types';

/**
 * Chỉ hiện ô tìm khi tài khoản có từ ngần này cửa hàng: ít hơn thì cuộn mắt là đủ, ô tìm chỉ thêm việc
 * (đề xuất ở personal-tab-redesign-plan.md, khung 7a; chưa có số liệu thực tế về số cửa hàng mỗi tài khoản).
 */
export const SHOP_SEARCH_MIN_SHOPS = 6;

/** Dấu tổ hợp (U+0300..U+036F), viết bằng escape để không lẫn ký tự tổ hợp vô hình trong mã nguồn. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Bỏ dấu, đổi chữ thường, cắt khoảng trắng đầu/cuối để "my pham" khớp "Shop Mỹ Phẩm".
 * Môi trường không có `String.prototype.normalize` (hoặc ném lỗi): rơi về so khớp chữ thường, không bỏ dấu
 * (vẫn lọc được, không crash, không trả rỗng).
 */
export function foldForSearch(text: string): string {
  let folded = text.toLowerCase();
  try {
    if (typeof String.prototype.normalize === 'function') {
      folded = folded.normalize('NFD').replace(COMBINING_MARKS, '');
    }
  } catch {
    // giữ chữ thường chưa bỏ dấu
  }
  return folded.replace(/\u0111/g, 'd').trim();
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
