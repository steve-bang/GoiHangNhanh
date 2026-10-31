import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { expectNoPii, PII_SAMPLES } from '@/test-utils/pii-samples';
import {
  createCrashReporter,
  reportFatalRenderError,
  resetCrashReporterForTests,
  type ErrorUtilsLike,
} from '@/platform/crash-reporter';

import { RootErrorBoundary } from './RootErrorBoundary';

const PII_MESSAGE = `Không đọc được ${PII_SAMPLES[8]}\n${PII_SAMPLES[0]}\nat ${PII_SAMPLES[1]}`;

function Thrower(): never {
  throw new Error(PII_MESSAGE);
}

function fakeSdk() {
  return {
    getCrashlytics: jest.fn(() => ({})),
    log: jest.fn(),
    recordError: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(async () => null),
    deleteUnsentReports: jest.fn(async () => undefined),
  };
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
  return { utils, previous };
}

beforeEach(() => {
  // React ghi lỗi đã bắt ra console.error trong môi trường test.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  resetCrashReporterForTests();
  jest.restoreAllMocks();
});

describe('RootErrorBoundary (V1-16, review PR #62)', () => {
  it('không lỗi: vẽ con như bình thường', async () => {
    await render(
      <RootErrorBoundary onFatal={jest.fn()}>
        <Text>ok</Text>
      </RootErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeOnTheScreen();
  });

  it('lỗi render: không vẽ UI mới (null), chuyển lỗi như fatal; chưa cài bộ lọc (dev) thì giữ thông điệp', async () => {
    const onFatal = jest.fn();
    const view = await render(
      <RootErrorBoundary onFatal={onFatal}>
        <Thrower />
      </RootErrorBoundary>,
    );
    expect(view.toJSON()).toBeNull();
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect((onFatal.mock.calls[0] as [Error])[0].message).toBe(PII_MESSAGE);
  });

  it('đã cài bộ lọc: lỗi bị lọc TẠI CHỖ trước khi React Native báo, handler toàn cục nhận bản đã lọc là fatal', async () => {
    const sdk = fakeSdk();
    const errors = fakeErrorUtils();
    const reporter = createCrashReporter(() => sdk as never, errors.utils);
    await reporter.setEnabled(true);
    let caught: Error | undefined;
    await render(
      <RootErrorBoundary
        onFatal={(error) => {
          caught = error as Error;
          reportFatalRenderError(error, errors.utils);
        }}
      >
        <Thrower />
      </RootErrorBoundary>,
    );
    // Chính đối tượng lỗi (React Native dùng cho onCaughtError) đã không còn thông điệp gốc.
    expect(caught?.message).toBe('Error');
    expectNoPii({ message: caught?.message, stack: caught?.stack });
    expect(errors.previous).toHaveBeenCalledTimes(1);
    const [forwarded, fatal] = errors.previous.mock.calls[0] as [Error, boolean];
    expect(fatal).toBe(true);
    expectNoPii({ message: forwarded.message, stack: forwarded.stack });
    expect(forwarded).not.toHaveProperty('componentStack');
    // Fatal: không ghi thêm bản không fatal (sập native đã được Crashlytics bắt).
    expect(sdk.recordError).not.toHaveBeenCalled();
  });
});
