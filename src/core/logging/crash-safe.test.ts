import { AppError } from '@/core/errors/app-error';
import { expectNoPii, PII_SAMPLES } from '@/test-utils/pii-samples';

import {
  CRASH_SAFE_FIELD_KEYS,
  crashSafeEvent,
  crashSafeFields,
  formatCrashLine,
  INVALID_EVENT,
  sanitizeErrorForCrash,
  sanitizeStack,
} from './crash-safe';

describe('crashSafeEvent', () => {
  it('giữ tên sự kiện kỹ thuật, thay tên lạ bằng invalid_event', () => {
    expect(crashSafeEvent('orders.local_store_failed')).toBe('orders.local_store_failed');
    expect(crashSafeEvent('platform.keep_awake_failed')).toBe('platform.keep_awake_failed');
    for (const sample of PII_SAMPLES)
      expect(crashSafeEvent(`orders.${sample}`)).toBe(INVALID_EVENT);
    expect(crashSafeEvent('orders.dh123')).toBe(INVALID_EVENT);
    expect(crashSafeEvent('x'.repeat(65))).toBe(INVALID_EVENT);
  });
});

describe('crashSafeFields', () => {
  it('chỉ giữ khóa cho phép với giá trị là mã lỗi, tên lỗi, nhãn chữ thường hoặc số nhỏ', () => {
    expect(
      crashSafeFields({
        reason: 'LOCAL_SAVE_UNAVAILABLE',
        step: 'on',
        target: 'evidence',
        kind: 'TypeError',
        attempt: 3,
        status: true,
      }),
    ).toEqual({
      reason: 'LOCAL_SAVE_UNAVAILABLE',
      step: 'on',
      target: 'evidence',
      kind: 'TypeError',
      attempt: 3,
      status: true,
    });
  });

  it('bỏ hẳn uid, shopId, email, mã đơn, mã vận đơn, đường dẫn, URL, kể cả trong khóa cho phép', () => {
    const fields: Record<string, unknown> = {
      uid: PII_SAMPLES[3],
      shopId: PII_SAMPLES[4],
      email: PII_SAMPLES[0],
      orderCode: PII_SAMPLES[1],
      path: PII_SAMPLES[7],
      nested: { reason: 'sqlite' },
    };
    const out = crashSafeFields(fields);
    expectNoPii(out);
    expect(Object.keys(out)).toEqual([]);
    for (const key of CRASH_SAFE_FIELD_KEYS) {
      for (const sample of PII_SAMPLES) expect(crashSafeFields({ [key]: sample })).toEqual({});
    }
  });

  it('mã đơn viết hoa không lọt qua dù giống mã lỗi; số lớn (số điện thoại) bị bỏ', () => {
    expect(crashSafeFields({ reason: 'SPX0123456789', attempt: 912345678 })).toEqual({});
    expect(crashSafeFields({ reason: 'NOT_A_REAL_CODE' })).toEqual({});
    expect(crashSafeFields({ attempt: -1 })).toEqual({});
    expect(crashSafeFields({ attempt: 1.5 })).toEqual({});
  });

  it('đầu vào không phải đối tượng -> rỗng', () => {
    expect(crashSafeFields(undefined)).toEqual({});
    expect(crashSafeFields('reason')).toEqual({});
    expect(crashSafeFields([{ reason: 'x' }])).toEqual({});
  });

  it('formatCrashLine ghép mức, sự kiện và trường', () => {
    expect(
      formatCrashLine({
        level: 'error',
        event: 'orders.local_store_failed',
        fields: { reason: 'Error' },
      }),
    ).toBe('error orders.local_store_failed reason=Error');
  });
});

describe('sanitizeErrorForCrash', () => {
  it('không dùng error.message: thông điệp là tên lớp lỗi', () => {
    const error = new TypeError(`Không tìm thấy ${PII_SAMPLES[1]} của ${PII_SAMPLES[0]}`);
    const safe = sanitizeErrorForCrash(error);
    expect(safe.name).toBe('TypeError');
    expect(safe.message).toBe('TypeError');
    expectNoPii(safe);
  });

  it('AppError: thông điệp là mã lỗi', () => {
    const safe = sanitizeErrorForCrash(
      new AppError('LOCAL_SAVE_UNAVAILABLE', { orderCode: 'DH-1' }),
    );
    expect(safe).toMatchObject({ name: 'AppError', message: 'LOCAL_SAVE_UNAVAILABLE' });
    expect(JSON.stringify(safe)).not.toContain('DH-1');
  });

  it('giá trị ném không phải Error, tên lớp lạ -> Error', () => {
    expect(sanitizeErrorForCrash(PII_SAMPLES[0])).toEqual({
      name: 'Error',
      message: 'Error',
      stack: 'Error: Error',
    });
    const odd = new Error('x');
    odd.name = 'DH-240915-0001';
    expect(sanitizeErrorForCrash(odd).name).toBe('Error');
  });

  it('stack: bỏ dòng thông điệp, rút đường dẫn/URL về tên tệp, giữ hàm và dòng:cột', () => {
    const error = new Error(PII_SAMPLES[2]);
    error.stack = [
      `Error: ${PII_SAMPLES[2]} ${PII_SAMPLES[0]}`,
      '    at saveOrder (address at /var/containers/Bundle/Application/ABCD-1234/DonChung.app/main.jsbundle:1:23456)',
      '    at anonymous (file:///data/user/0/vn.doncung.app/files/index.android.bundle:1:999)',
      '    at http://192.168.1.2:8081/index.bundle?platform=ios&dev=true:12:3',
      `    at fn ("${PII_SAMPLES[6]}")`,
      'persist@/private/var/mobile/Containers/Data/Application/X/main.jsbundle:5:6',
      `trailing text with ${PII_SAMPLES[1]}`,
    ].join('\n');
    const safe = sanitizeErrorForCrash(error);
    expectNoPii(safe);
    expect(safe.stack).toContain('at saveOrder (address at main.jsbundle:1:23456)');
    expect(safe.stack).toContain('at anonymous (index.android.bundle:1:999)');
    expect(safe.stack).toContain('at index.bundle:12:3');
    expect(safe.stack).toContain('persist@main.jsbundle:5:6');
    expect(safe.stack.split('\n')[0]).toBe('Error: Error');
  });

  it('sanitizeStack giới hạn 30 khung và bỏ khi không có khung', () => {
    const many = Array.from({ length: 50 }, (_, i) => `    at f${i} (a.js:${i}:1)`).join('\n');
    expect(sanitizeStack(many)?.split('\n')).toHaveLength(30);
    expect(sanitizeStack('chỉ có chữ')).toBeUndefined();
    expect(sanitizeStack(undefined)).toBeUndefined();
  });
});
