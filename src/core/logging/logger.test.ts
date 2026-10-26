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
