import { PUBLIC_LINKS } from './public-links';

/**
 * Lớp tương thích: email hỗ trợ lấy từ `public-links.ts` (nguồn duy nhất, khớp web). `null` = chưa có hộp
 * thư thật (decisions.md Q-20g, Q-21ae): màn Liên hệ hỗ trợ khóa nút gửi và nói rõ chưa có kênh.
 */
export const SUPPORT_EMAIL: string | null = PUBLIC_LINKS.supportEmail;

export { getSupportEmail } from './public-links';
