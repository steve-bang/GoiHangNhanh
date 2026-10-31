/**
 * ID tài liệu do client gửi lên callable (shopId, evidenceId, returnId): chỉ chữ, số, `_`, `-`, tối đa
 * 128 ký tự. Chặn ký tự đường dẫn (`/`, `..`) để client không trỏ được ra ngoài shop của mình.
 */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && ID_PATTERN.test(value);
