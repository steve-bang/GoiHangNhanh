/**
 * LIÊN KẾT CÔNG KHAI CỦA APP — MỘT NƠI DUY NHẤT (decisions.md Q-29 / V1-18): trang Điều khoản, Chính sách
 * quyền riêng tư, Hỗ trợ, Yêu cầu xóa tài khoản trên web và email hỗ trợ. Giá trị PHẢI khớp
 * `web/src/config/site.ts` (`site.url` + `legalPages` + `legal.supportEmail`); test tooling
 * `scripts/public-links.test.cjs` so từng giá trị, đổi một bên mà quên bên kia thì `npm test` đỏ.
 *
 * Hôm nay là GIỮ CHỖ: tên miền `.invalid` (RFC 2606, không bao giờ phân giải) và email `null`. Màn nào hiện
 * liên kết phải khóa/ẩn khi `isPlaceholderLink(url)` hoặc `getSupportEmail() === null` (không mở trang chắc
 * chắn lỗi, không bịa địa chỉ). Điền giá trị thật ở release-checklist D-4, cùng lúc với web.
 * TypeScript thuần, không import gì (test tooling nạp trực tiếp tệp này).
 */

/** Gốc web công khai. GIỮ CHỖ — khớp `site.url` của web. */
export const PUBLIC_SITE_URL = 'https://don-chung.invalid';

/** Đường dẫn các trang (khớp `site.legalPages` của web; không đổi sau khi đã khai báo với store). */
const PAGE_PATHS = {
  terms: '/dieu-khoan/',
  privacy: '/chinh-sach-quyen-rieng-tu/',
  support: '/ho-tro/',
  accountDeletionRequest: '/xoa-tai-khoan/',
} as const;

export interface PublicLinks {
  readonly terms: string;
  readonly privacy: string;
  readonly support: string;
  readonly accountDeletionRequest: string;
  /**
   * Email nhận hỗ trợ và yêu cầu xóa tài khoản. `null` = CHƯA CÓ hộp thư thật có người trực (Q-20g, Q-21ae):
   * màn Liên hệ hỗ trợ khóa nút gửi. Không điền địa chỉ đoán hay tên miền giữ chỗ.
   */
  readonly supportEmail: string | null;
}

export const PUBLIC_LINKS: PublicLinks = {
  terms: `${PUBLIC_SITE_URL}${PAGE_PATHS.terms}`,
  privacy: `${PUBLIC_SITE_URL}${PAGE_PATHS.privacy}`,
  support: `${PUBLIC_SITE_URL}${PAGE_PATHS.support}`,
  accountDeletionRequest: `${PUBLIC_SITE_URL}${PAGE_PATHS.accountDeletionRequest}`,
  supportEmail: null,
};

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

/** Địa chỉ hỗ trợ hợp lệ để soạn email, hoặc `null` (chưa cấu hình hoặc sai dạng). */
export function getSupportEmail(raw: string | null = PUBLIC_LINKS.supportEmail): string | null {
  const email = raw?.trim() ?? '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
