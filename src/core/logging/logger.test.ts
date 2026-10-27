import { REDACTED, redact } from './logger';

describe('redact', () => {
  it('che mã đơn, mã vận đơn, thông tin khách và token, kể cả lồng nhau', () => {
    const out = redact({
      sessionId: 's-1',
      orderCode: 'DH123',
      tracking_code: 'VN999',
      nested: { customerPhone: '0900000000', evidenceId: 'e-1' },
      list: [{ idToken: 'abc' }],
    });
    expect(out).toEqual({
      sessionId: 's-1',
      orderCode: REDACTED,
      tracking_code: REDACTED,
      nested: { customerPhone: REDACTED, evidenceId: 'e-1' },
      list: [{ idToken: REDACTED }],
    });
  });

  it('che email, mật khẩu, mã xác minh (otp/code) và vé đặt lại', () => {
    const out = redact({
      email: 'a@b.co',
      password: 'matkhau-1',
      newPassword: 'matkhau-2',
      otp: '123456',
      code: '123456',
      verificationCode: '123456',
      ticket: 'fake-ticket-1',
      resetTicket: 'x',
      screen: 'UI-A08',
    });
    expect(out).toEqual({
      email: REDACTED,
      password: REDACTED,
      newPassword: REDACTED,
      otp: REDACTED,
      code: REDACTED,
      verificationCode: REDACTED,
      ticket: REDACTED,
      resetTicket: REDACTED,
      screen: 'UI-A08',
    });
  });

  it('giữ nguyên ID nội bộ và giá trị kỹ thuật', () => {
    expect(redact({ evidenceId: 'e-1', sizeBytes: 5, state: 'queued' })).toEqual({
      evidenceId: 'e-1',
      sizeBytes: 5,
      state: 'queued',
    });
  });

  it('cắt độ sâu quá lớn thay vì đệ quy vô hạn', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(JSON.stringify(redact(deep))).toContain(REDACTED);
  });
});
