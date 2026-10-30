import { expectNoPii, PII_SAMPLES } from '@/test-utils/pii-samples';

import type { CrashSafeRecord } from './crash-safe';
import { logger, REDACTED, redact, setLogSink } from './logger';

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

describe('logger -> sink báo lỗi (V1-16)', () => {
  let records: CrashSafeRecord[];
  beforeEach(() => {
    records = [];
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    setLogSink((record) => records.push(record));
  });
  afterEach(() => {
    setLogSink(null);
    jest.restoreAllMocks();
  });

  it('chỉ warn và error tới sink; debug/info không', () => {
    logger.debug('a.debug');
    logger.info('a.info');
    logger.warn('a.warn', { reason: 'sqlite' });
    logger.error('a.error', { reason: 'LOCAL_SAVE_UNAVAILABLE' });
    expect(records).toEqual([
      { level: 'warn', event: 'a.warn', fields: { reason: 'sqlite' } },
      { level: 'error', event: 'a.error', fields: { reason: 'LOCAL_SAVE_UNAVAILABLE' } },
    ]);
  });

  it('sink không bao giờ nhận email, uid, shopId, mã đơn, mã vận đơn, đường dẫn tệp', () => {
    const [email, orderCode, trackingCode, uid, shopId, phone, path, absPath, fileUri, url, name] =
      PII_SAMPLES;
    logger.error('orders.local_store_failed', {
      email,
      orderCode,
      trackingCode,
      uid,
      shopId,
      userId: uid,
      phone,
      path,
      uri: fileUri,
      dir: absPath,
      uploadUrl: url,
      customerName: name,
      reason: orderCode,
      step: trackingCode,
      target: absPath,
      kind: email,
    });
    logger.warn(`orders.${orderCode ?? ''}`, { result: uid });
    expect(records).toHaveLength(2);
    expectNoPii(records);
    expect(records[0]?.fields).toEqual({});
    expect(records[1]?.event).toBe('invalid_event');
  });

  it('sink ném lỗi không làm logger ném; gỡ sink thì không gọi nữa', () => {
    setLogSink(() => {
      throw new Error('boom');
    });
    expect(() => logger.error('a.error')).not.toThrow();
    const sink = jest.fn();
    setLogSink(sink);
    setLogSink(null);
    logger.error('a.error');
    expect(sink).not.toHaveBeenCalled();
  });
});
