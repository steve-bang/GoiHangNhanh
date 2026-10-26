import type { ErrorCode } from './codes';

/**
 * Lỗi nghiệp vụ có mã ổn định. UI hiển thị thông báo qua i18n khóa `errors.<code>`
 * (điều gì xảy ra / ảnh hưởng / việc làm tiếp), KHÔNG dùng `message` để hiển thị.
 *
 * `context` chỉ chứa ID nội bộ hoặc giá trị không nhạy cảm. Không đặt mã đơn, mã vận đơn, tên
 * hay thông tin khách vào đây (xem logger và docs/engineering/conventions.md mục "Log và PII").
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly context: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: ErrorCode,
    context: Readonly<Record<string, string | number | boolean>> = {},
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
