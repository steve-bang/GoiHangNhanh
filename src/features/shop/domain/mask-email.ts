/**
 * Che email để hiện cho người dùng mà không phơi cả địa chỉ (màn nhập mã xác minh): giữ tối đa 2 ký
 * tự đầu của phần trước `@` và toàn bộ tên miền, ví dụ `da•••@example.com`. Phần trước `@` ngắn
 * (1-2 ký tự) chỉ giữ 1 ký tự đầu để vẫn che được. Không có `@` thì che gần hết.
 */
const MASK = '•••';

export function maskEmail(raw: string): string {
  const email = raw.trim();
  const at = email.lastIndexOf('@');
  if (at <= 0) return Array.from(email).slice(0, 1).join('') + MASK;
  const local = Array.from(email.slice(0, at));
  const domain = email.slice(at);
  const keep = local.length <= 2 ? 1 : 2;
  return local.slice(0, keep).join('') + MASK + domain;
}
