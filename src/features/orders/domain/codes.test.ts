import {
  MAX_CODE_LENGTH,
  normalizeCode,
  toCodeKey,
  validateCode,
  validateQuantity,
  validateTrackingCode,
} from './codes';

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

describe('mã vận đơn (V1-04, trần khớp Rules)', () => {
  it('rỗng là không có mã; cắt khoảng trắng đầu cuối, giữ phần giữa', () => {
    expect(validateTrackingCode('  ')).toEqual({ ok: true, code: null });
    expect(validateTrackingCode(' SPX  1 ')).toEqual({ ok: true, code: 'SPX  1' });
  });
  it('đúng 64 ký tự qua; 65 ký tự hoặc ký tự điều khiển bị từ chối', () => {
    expect(validateTrackingCode('x'.repeat(MAX_CODE_LENGTH))).toEqual({
      ok: true,
      code: 'x'.repeat(64),
    });
    expect(validateTrackingCode('x'.repeat(MAX_CODE_LENGTH + 1))).toEqual({ ok: false });
    expect(validateTrackingCode('SPX\u00071')).toEqual({ ok: false });
  });
});
