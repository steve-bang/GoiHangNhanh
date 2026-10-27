/**
 * Kiểm tra biểu mẫu tab Cá nhân. TypeScript thuần; trả về MÃ vấn đề, câu chữ nằm ở i18n
 * (`personal:validation.*`). Độ dài mật khẩu theo D-13 (từ 8 ký tự).
 */

export const MIN_PASSWORD_LENGTH = 8;
/** Giới hạn họ tên: ĐỀ XUẤT (chưa có trong đặc tả BA), cùng mức với tên shop; chờ xác nhận ở Q-19b. */
export const DISPLAY_NAME_MAX_LENGTH = 50;

export type DisplayNameIssue = 'required' | 'too_long';
export type CurrentPasswordIssue = 'required';
export type NewPasswordIssue = 'required' | 'too_short' | 'same_as_current';
export type ConfirmPasswordIssue = 'required' | 'mismatch';

/** Độ dài theo ký tự hiển thị (code point), để emoji không bị đếm thành hai. */
export function textLength(value: string): number {
  return Array.from(value).length;
}

export function normalizeDisplayName(raw: string): string {
  return raw.trim();
}

export function validateDisplayName(raw: string): DisplayNameIssue | null {
  const length = textLength(normalizeDisplayName(raw));
  if (length === 0) return 'required';
  return length > DISPLAY_NAME_MAX_LENGTH ? 'too_long' : null;
}

export function validateCurrentPassword(raw: string): CurrentPasswordIssue | null {
  return raw.length === 0 ? 'required' : null;
}

/** Mật khẩu KHÔNG bị cắt khoảng trắng: người dùng có thể chủ ý dùng. */
export function validateNewPassword(current: string, next: string): NewPasswordIssue | null {
  if (next.length === 0) return 'required';
  if (textLength(next) < MIN_PASSWORD_LENGTH) return 'too_short';
  return next === current ? 'same_as_current' : null;
}

export function validateConfirmNewPassword(
  next: string,
  confirmation: string,
): ConfirmPasswordIssue | null {
  if (confirmation.length === 0) return 'required';
  return confirmation === next ? null : 'mismatch';
}
