import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { logger } from '@/core/logging/logger';
import {
  DeviceSettingsProvider,
  createMemoryDeviceSettingsStore,
  useDeviceSettings,
  type DeviceSettings,
} from '@/features/orders';
import { CRASH_REPORTS_ENABLED } from '@/features/personal';
import type { CrashReporter } from '@/platform';

import { CrashReportingBridge, crashReportingAllowed } from './CrashReportingBridge';

function fakeReporter(available = true) {
  return {
    available,
    setEnabled: jest.fn(async () => undefined),
    recordLog: jest.fn(),
    recordError: jest.fn(),
  } satisfies CrashReporter;
}

let settingsRef: DeviceSettings | undefined;
function CaptureSettings() {
  const settings = useDeviceSettings();
  useEffect(() => {
    settingsRef = settings;
  }, [settings]);
  return null;
}

async function mount(
  reporter: CrashReporter,
  { allowed = true, stored }: { allowed?: boolean; stored?: boolean } = {},
) {
  const store = createMemoryDeviceSettingsStore();
  if (stored !== undefined) await store.write(CRASH_REPORTS_ENABLED.key, String(stored), 0);
  const view = await render(
    <DeviceSettingsProvider store={store}>
      <CaptureSettings />
      <CrashReportingBridge allowed={allowed} reporter={reporter} />
    </DeviceSettingsProvider>,
  );
  return { view, store };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('crashReportingAllowed', () => {
  const base = { isDev: false, isTest: false, fakeFlag: undefined };
  it('chỉ bản build thật dùng Firebase', () => {
    expect(crashReportingAllowed({ ...base })).toBe(true);
    expect(crashReportingAllowed({ ...base, appEnv: 'prod' })).toBe(true);
    expect(crashReportingAllowed({ ...base, isDev: true })).toBe(false);
    expect(crashReportingAllowed({ ...base, isTest: true })).toBe(false);
    expect(crashReportingAllowed({ ...base, fakeFlag: '1' })).toBe(false);
    expect(crashReportingAllowed({ ...base, backend: 'fake' })).toBe(false);
  });

  it('môi trường Jest hiện tại: không cho phép (mặc định đọc env)', () => {
    expect(crashReportingAllowed()).toBe(false);
  });
});

describe('CrashReportingBridge (V1-16)', () => {
  it('không cho phép hoặc adapter không có: không gọi gì, logger không gửi', async () => {
    const off = fakeReporter();
    await mount(off, { allowed: false });
    logger.error('a.error');
    expect(off.setEnabled).not.toHaveBeenCalled();
    expect(off.recordLog).not.toHaveBeenCalled();

    const missing = fakeReporter(false);
    await mount(missing);
    logger.error('a.error');
    expect(missing.setEnabled).not.toHaveBeenCalled();
    expect(missing.recordLog).not.toHaveBeenCalled();
  });

  it('mặc định BẬT (R-8 A): bật thu thập, logger gửi bản ghi đã lọc', async () => {
    const reporter = fakeReporter();
    const { view } = await mount(reporter);
    await waitFor(() => expect(reporter.setEnabled).toHaveBeenCalledWith(true));
    logger.error('orders.local_store_failed', { reason: 'Error', orderCode: 'DH-1' });
    expect(reporter.recordLog).toHaveBeenCalledWith({
      level: 'error',
      event: 'orders.local_store_failed',
      fields: { reason: 'Error' },
    });
    await view.unmount();
    logger.error('a.error');
    expect(reporter.recordLog).toHaveBeenCalledTimes(1);
  });

  it('đã lưu TẮT: tắt thu thập, logger không gửi', async () => {
    const reporter = fakeReporter();
    await mount(reporter, { stored: false });
    await waitFor(() => expect(reporter.setEnabled).toHaveBeenCalledWith(false));
    expect(reporter.setEnabled).not.toHaveBeenCalledWith(true);
    logger.error('a.error');
    expect(reporter.recordLog).not.toHaveBeenCalled();
  });

  it('đổi công tắc: tắt có hiệu lực ngay, bật lại gửi tiếp', async () => {
    const reporter = fakeReporter();
    await mount(reporter);
    await waitFor(() => expect(reporter.setEnabled).toHaveBeenCalledWith(true));
    await act(async () => {
      await settingsRef?.set(CRASH_REPORTS_ENABLED, false);
    });
    expect(reporter.setEnabled).toHaveBeenLastCalledWith(false);
    logger.warn('a.warn');
    expect(reporter.recordLog).not.toHaveBeenCalled();
    await act(async () => {
      await settingsRef?.set(CRASH_REPORTS_ENABLED, true);
    });
    expect(reporter.setEnabled).toHaveBeenLastCalledWith(true);
    expect(reporter.setEnabled).toHaveBeenCalledTimes(3);
    logger.warn('a.warn');
    expect(reporter.recordLog).toHaveBeenCalledTimes(1);
  });
});
