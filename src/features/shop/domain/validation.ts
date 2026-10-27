/**
 * Kiểm tra dữ liệu thiết lập tài khoản/shop (docs/09 UI-A03, A04). TypeScript thuần; trả về MÃ
 * vấn đề, câu chữ hiển thị nằm ở i18n.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const SHOP_NAME_MAX_LENGTH = 50;

/** Đủ chặt để bắt lỗi gõ thường gặp; việc xác minh email thật thuộc về máy chủ. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type EmailIssue = 'required' | 'invalid';
export type PasswordIssue = 'required' | 'too_short';
export type ShopNameIssue = 'required' | 'too_long';

/** Độ dài theo ký tự hiển thị (code point), để emoji không bị đếm thành hai. */
export function textLength(value: string): number {
  return Array.from(value).length;
}

export function normalizeEmail(raw: string): string {
  return raw.trim();
}

export function validateEmail(raw: string): EmailIssue | null {
  const email = normalizeEmail(raw);
  if (email.length === 0) return 'required';
  return EMAIL_PATTERN.test(email) ? null : 'invalid';
}

/** Mật khẩu KHÔNG bị cắt khoảng trắng: người dùng có thể chủ ý dùng. */
export function validatePassword(raw: string): PasswordIssue | null {
  if (raw.length === 0) return 'required';
  return textLength(raw) < MIN_PASSWORD_LENGTH ? 'too_short' : null;
}

export function normalizeShopName(raw: string): string {
  return raw.trim();
}

export function validateShopName(raw: string): ShopNameIssue | null {
  const length = textLength(normalizeShopName(raw));
  if (length === 0) return 'required';
  return length > SHOP_NAME_MAX_LENGTH ? 'too_long' : null;
}
