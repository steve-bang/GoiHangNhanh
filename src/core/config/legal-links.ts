/**
 * Liên kết pháp lý ở màn Chào mừng (UI-A02) và màn Điều khoản và chính sách (tab Cá nhân). Hiện là URL
 * GIỮ CHỖ (tên miền `.invalid` không bao giờ phân giải được); thay bằng URL thật khi có trang Điều khoản
 * và Chính sách quyền riêng tư. Không có URL thật cho chính sách dữ liệu nên không khai báo ở đây.
 */
export const LEGAL_LINKS = {
  terms: 'https://don-chung.invalid/terms',
  privacy: 'https://don-chung.invalid/privacy',
  /**
   * Trang web hướng dẫn xóa tài khoản (`web/src/config/site.ts` `legalPages.accountDeletionRequest`,
   * V1-19). TODO(V1-18): thay bằng `public-links.ts` dùng chung giá trị với web khi có tên miền thật;
   * còn giữ chỗ thì màn Xóa tài khoản ẩn liên kết (không mở trang chắc chắn lỗi).
   */
  accountDeletion: 'https://don-chung.invalid/xoa-tai-khoan/',
} as const;

/**
 * true khi URL là giữ chỗ hoặc không hợp lệ (tên miền `.invalid`, RFC 2606; hoặc không phải https):
 * màn nào hiển thị liên kết phải khóa hàng thay vì mở một trang chắc chắn lỗi.
 */
export function isPlaceholderLink(url: string): boolean {
  const match = /^https:\/\/([^/?#:]+)/i.exec(url.trim());
  if (!match?.[1]) return true;
  const host = match[1].toLowerCase();
  return host === 'invalid' || host.endsWith('.invalid');
}
