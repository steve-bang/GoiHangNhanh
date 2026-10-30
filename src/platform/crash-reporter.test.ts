import { AppError } from '@/core/errors/app-error';
import { expectNoPii, PII_SAMPLES } from '@/test-utils/pii-samples';

import { createCrashReporter, type ErrorUtilsLike } from './crash-reporter';

function fakeSdk() {
  const instance = { tag: 'crashlytics' };
  const sdk = {
    getCrashlytics: jest.fn(() => instance),
    log: jest.fn(),
    recordError: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(async () => null),
    deleteUnsentReports: jest.fn(async () => undefined),
    // Có trong SDK thật; adapter KHÔNG BAO GIỜ được gọi.
    setUserId: jest.fn(),
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    crash: jest.fn(),
  };
  return { sdk, instance };
}

function fakeErrorUtils() {
  const previous = jest.fn();
  let handler: (error: unknown, isFatal?: boolean) => void = previous;
  const utils: ErrorUtilsLike = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next) => {
      handler = next;
    },
  };
  return { utils, previous, current: () => handler };
}

function setup() {
  const { sdk, instance } = fakeSdk();
  const errors = fakeErrorUtils();
  const reporter = createCrashReporter(() => sdk as never, errors.utils);
  return { sdk, instance, errors, reporter };
}

const NEVER_CALLED = ['setUserId', 'setAttribute', 'setAttributes', 'crash'] as const;

describe('createCrashReporter (V1-16)', () => {
  it('trong Jest (không có mô-đun native RNFirebase): SDK thật nạp được hay không đều là no-op', async () => {
    const errors = fakeErrorUtils();
    const reporter = createCrashReporter(undefined, errors.utils);
    expect(reporter.available).toBe(false);
    await expect(reporter.setEnabled(true)).resolves.toBeUndefined();
    expect(errors.current()).toBe(errors.previous);
  });

  it('thiếu mô-đun native hoặc SDK không khởi tạo được: no-op, không ném, không đụng handler', async () => {
    const errors = fakeErrorUtils();
    const missing = createCrashReporter(() => null, errors.utils);
    expect(missing.available).toBe(false);
    await expect(missing.setEnabled(true)).resolves.toBeUndefined();
    expect(() => missing.recordError(new Error('x'))).not.toThrow();

    const { sdk } = fakeSdk();
    sdk.getCrashlytics.mockImplementation(() => {
      throw new Error('No Firebase App');
    });
    const broken = createCrashReporter(() => sdk as never, errors.utils);
    expect(broken.available).toBe(false);
    expect(errors.current()).toBe(errors.previous);
  });

  it('chưa bật thì không ghi gì; bật thì ghi dòng nhật ký và lỗi đã lọc', async () => {
    const { sdk, instance, reporter } = setup();
    reporter.recordLog({ level: 'error', event: 'orders.local_store_failed', fields: {} });
    reporter.recordError(new Error('x'));
    expect(sdk.log).not.toHaveBeenCalled();
    expect(sdk.recordError).not.toHaveBeenCalled();

    await reporter.setEnabled(true);
    expect(sdk.setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(instance, true);
    expect(sdk.deleteUnsentReports).not.toHaveBeenCalled();

    reporter.recordLog({
      level: 'warn',
      event: 'orders.list_failed',
      fields: { reason: 'sqlite' },
    });
    expect(sdk.log).toHaveBeenLastCalledWith(instance, 'warn orders.list_failed reason=sqlite');
    expect(sdk.recordError).not.toHaveBeenCalled();

    reporter.recordLog({
      level: 'error',
      event: 'evidence.local_store_failed',
      fields: { reason: 'Error' },
    });
    expect(sdk.recordError).toHaveBeenCalledTimes(1);
    const [, error, name] = sdk.recordError.mock.calls[0] as unknown as [unknown, Error, string];
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LoggedError');
    expect(error.message).toBe('error evidence.local_store_failed reason=Error');
    expect(name).toBe('evidence.local_store_failed');
  });

  it('recordError không gửi error.message hay context (mã đơn, email, đường dẫn)', async () => {
    const { sdk, reporter } = setup();
    await reporter.setEnabled(true);
    reporter.recordError(new Error(PII_SAMPLES.join(' ')));
    reporter.recordError(new AppError('LOCAL_SAVE_UNAVAILABLE', { orderCode: 'DH-240915-0001' }));
    expect(sdk.recordError).toHaveBeenCalledTimes(2);
    const sent = sdk.recordError.mock.calls.map((call) => {
      const error = (call as unknown as [unknown, Error])[1];
      return { name: error.name, message: error.message, stack: error.stack };
    });
    expectNoPii(sent);
    expect(sent[1]?.message).toBe('LOCAL_SAVE_UNAVAILABLE');
  });

  it('tắt: tắt thu thập, xóa báo cáo chưa gửi, ngừng ghi ngay', async () => {
    const { sdk, instance, reporter } = setup();
    await reporter.setEnabled(true);
    await reporter.setEnabled(false);
    expect(sdk.setCrashlyticsCollectionEnabled).toHaveBeenLastCalledWith(instance, false);
    expect(sdk.deleteUnsentReports).toHaveBeenCalledWith(instance);
    reporter.recordLog({ level: 'error', event: 'a.b', fields: {} });
    reporter.recordError(new Error('x'));
    expect(sdk.log).not.toHaveBeenCalled();
    expect(sdk.recordError).not.toHaveBeenCalled();
  });

  it('lỗi SDK khi bật/tắt không ném', async () => {
    const { sdk, reporter } = setup();
    sdk.setCrashlyticsCollectionEnabled.mockRejectedValue(new Error('native'));
    await expect(reporter.setEnabled(false)).resolves.toBeUndefined();
    sdk.log.mockImplementation(() => {
      throw new Error('native');
    });
    await reporter.setEnabled(true);
    expect(() => reporter.recordLog({ level: 'error', event: 'a.b', fields: {} })).not.toThrow();
  });

  it('handler toàn cục: lấy handler RN TRƯỚC khi khởi tạo SDK, chuyển lỗi ĐÃ LỌC cho nó', async () => {
    const { sdk, errors, reporter } = setup();
    expect(errors.current()).not.toBe(errors.previous);
    await reporter.setEnabled(true);

    const raw = new Error(`Không lưu được ${PII_SAMPLES[1]}`);
    errors.current()(raw, false);
    expect(sdk.recordError).toHaveBeenCalledTimes(1);
    const forwarded = errors.previous.mock.calls[0] as [Error, boolean];
    expect(forwarded[1]).toBe(false);
    expect(forwarded[0]).toBeInstanceOf(Error);
    expect(forwarded[0].message).toBe('Error');
    expectNoPii({ message: forwarded[0].message, stack: forwarded[0].stack });

    // Fatal: không ghi thêm bản không fatal (sập native đã được Crashlytics bắt), vẫn chuyển cho RN.
    errors.current()(raw, true);
    expect(sdk.recordError).toHaveBeenCalledTimes(1);
    expect(errors.previous).toHaveBeenCalledTimes(2);
  });

  it('handler toàn cục khi tắt: không ghi, vẫn chuyển lỗi đã lọc cho RN', () => {
    const { sdk, errors } = setup();
    errors.current()(new Error(PII_SAMPLES[0]), false);
    expect(sdk.recordError).not.toHaveBeenCalled();
    const forwarded = errors.previous.mock.calls[0] as [Error];
    expect(forwarded[0].message).not.toContain(PII_SAMPLES[0]);
  });

  it('không bao giờ gọi setUserId/setAttribute(s)/crash trong mọi luồng', async () => {
    const { sdk, errors, reporter } = setup();
    await reporter.setEnabled(true);
    reporter.recordLog({ level: 'error', event: 'a.b', fields: { reason: 'sqlite' } });
    reporter.recordError(new Error('x'));
    errors.current()(new Error('x'), false);
    await reporter.setEnabled(false);
    for (const fn of NEVER_CALLED) expect(sdk[fn]).not.toHaveBeenCalled();
  });
});
