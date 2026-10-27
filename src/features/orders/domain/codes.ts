/** Chuẩn hóa mã nhập/quét: bỏ khoảng trắng đầu cuối, gộp khoảng trắng giữa thành một dấu cách. */
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Khóa so sánh/tìm kiếm của một mã: đã chuẩn hóa và viết hoa. KHÔNG phải ID. */
export function toCodeKey(raw: string): string {
  return normalizeCode(raw).toUpperCase();
}

const MAX_CODE_LENGTH = 64;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export type CodeCheck = { ok: true; code: string } | { ok: false; error: 'INVALID_CODE' };

/** Mã rỗng, quá dài hoặc chứa ký tự điều khiển là `INVALID_CODE` (docs/04 A02). */
export function validateCode(raw: string): CodeCheck {
  const code = normalizeCode(raw);
  if (code.length === 0 || code.length > MAX_CODE_LENGTH || CONTROL_CHARS.test(code)) {
    return { ok: false, error: 'INVALID_CODE' };
  }
  return { ok: true, code };
}

export const MAX_QUANTITY = 99999;

export type QuantityCheck = { ok: true; quantity: number } | { ok: false };

/** Số lượng hợp lệ: số nguyên từ 1 đến 99.999 (docs/04 A03: "Vui lòng nhập số lượng hợp lệ"). */
export function validateQuantity(value: number): QuantityCheck {
  return Number.isInteger(value) && value >= 1 && value <= MAX_QUANTITY
    ? { ok: true, quantity: value }
    : { ok: false };
}
