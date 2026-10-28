/**
 * Địa chỉ email nhận yêu cầu hỗ trợ. CHƯA CÓ địa chỉ thật (decisions.md Q-20g, Q-21ae): để `null` thì màn
 * Liên hệ hỗ trợ khóa nút gửi và nói rõ chưa có kênh. KHÔNG điền địa chỉ đoán hay tên miền giữ chỗ; chỉ điền
 * khi BA/chủ sản phẩm cung cấp một hộp thư thật đã có người trực.
 */
export const SUPPORT_EMAIL: string | null = null;

/** Địa chỉ hỗ trợ hợp lệ để soạn email, hoặc `null` (chưa cấu hình hoặc sai dạng). */
export function getSupportEmail(raw: string | null = SUPPORT_EMAIL): string | null {
  const email = raw?.trim() ?? '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
