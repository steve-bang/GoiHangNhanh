import { PUBLIC_LINKS } from './public-links';

/**
 * Lớp tương thích: liên kết pháp lý ở màn Chào mừng (UI-A02, màn đã khách xác nhận nên giữ nguyên import),
 * Điều khoản và chính sách (tab Cá nhân) và Xóa tài khoản. Giá trị lấy từ `public-links.ts` (nguồn duy
 * nhất, khớp web); KHÔNG khai báo URL ở đây. Không có trang "chính sách dữ liệu" riêng nên không có khóa đó.
 */
export const LEGAL_LINKS = {
  terms: PUBLIC_LINKS.terms,
  privacy: PUBLIC_LINKS.privacy,
  /** Trang web hướng dẫn xóa tài khoản (`/xoa-tai-khoan/`); còn giữ chỗ thì màn Xóa tài khoản ẩn liên kết. */
  accountDeletion: PUBLIC_LINKS.accountDeletionRequest,
} as const;

export { isPlaceholderLink } from './public-links';
