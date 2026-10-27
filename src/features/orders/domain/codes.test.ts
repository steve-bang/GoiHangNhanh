import { normalizeCode, toCodeKey, validateCode, validateQuantity } from './codes';

describe('mã đơn', () => {
  it('chuẩn hóa: bỏ khoảng trắng thừa; khóa so sánh viết hoa', () => {
    expect(normalizeCode('  dh  123 ')).toBe('dh 123');
    expect(toCodeKey('  dh  123 ')).toBe('DH 123');
  });
  it('mã rỗng, quá dài hoặc có ký tự điều khiển là INVALID_CODE', () => {
    expect(validateCode('   ')).toEqual({ ok: false, error: 'INVALID_CODE' });
    expect(validateCode('a'.repeat(65))).toEqual({ ok: false, error: 'INVALID_CODE' });
    expect(validateCode('ab\u0000c')).toEqual({ ok: false, error: 'INVALID_CODE' });
    expect(validateCode(' DH1 ')).toEqual({ ok: true, code: 'DH1' });
  });
});

describe('số lượng', () => {
  it.each([1, 2, 99999])('%d hợp lệ', (n) =>
    expect(validateQuantity(n)).toEqual({ ok: true, quantity: n }),
  );
  it.each([0, -1, 1.5, Number.NaN, 100000])('%d không hợp lệ', (n) =>
    expect(validateQuantity(n)).toEqual({ ok: false }),
  );
});
