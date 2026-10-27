import { join } from 'node:path';

import { router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';

import { ROUTES } from '@/core/navigation';
import {
  resetDefaultGatewaysForTests,
  SPLASH_MAX_WAIT_MS,
  SPLASH_MIN_VISIBLE_MS,
} from '@/features/shop';

const APP_DIR = join(__dirname, '..', '..', 'app');
const ORIGINAL_FLAG = process.env.EXPO_PUBLIC_FAKE_SESSION;

/**
 * Splash (UI-A01) qua Expo Router thật, trong bộ nhớ, cổng phiên giả chọn bằng cờ
 * `EXPO_PUBLIC_FAKE_SESSION`. Không thay thế kiểm thử trên thiết bị (splash hệ điều hành, thời gian
 * khởi động thật).
 */
async function openApp(flag: string | undefined) {
  if (flag === undefined) delete process.env.EXPO_PUBLIC_FAKE_SESSION;
  else process.env.EXPO_PUBLIC_FAKE_SESSION = flag;
  resetDefaultGatewaysForTests();
  await renderRouter(APP_DIR, { initialUrl: ROUTES.splash.path });
}

const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  if (ORIGINAL_FLAG === undefined) delete process.env.EXPO_PUBLIC_FAKE_SESSION;
  else process.env.EXPO_PUBLIC_FAKE_SESSION = ORIGINAL_FLAG;
  resetDefaultGatewaysForTests();
});

describe('Splash (Expo Router thật, cổng phiên giả)', () => {
  it('mở "/" hiện Splash, chưa chuyển trước thời gian tối thiểu', async () => {
    await openApp('signed_in');
    expect(screen.getByTestId('screen-UI-A01')).toBeOnTheScreen();
    await advance(SPLASH_MIN_VISIBLE_MS - 100);
    expect(screen.getByTestId('screen-UI-A01')).toBeOnTheScreen();
  });

  it.each([
    ['signed_out', 'screen-UI-A02'],
    ['no_shop', 'screen-UI-A04'],
    ['signed_in', 'screen-UI-B01'],
  ])('cờ phiên %s -> %s; Back không quay lại Splash', async (flag, screenId) => {
    await openApp(flag);
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(screen.getByTestId(screenId)).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A01')).toBeNull();
    expect(router.canGoBack()).toBe(false);
    await act(async () => {
      router.back();
    });
    expect(screen.queryByTestId('screen-UI-A01')).toBeNull();
  });

  it('không đặt cờ (môi trường test) mặc định signed_in: vào Tổng quan như trước', async () => {
    await openApp(undefined);
    await advance(SPLASH_MAX_WAIT_MS);
    expect(screen.getByTestId('screen-UI-B01')).toBeOnTheScreen();
  });

  it('Chào mừng (từ Splash) có đủ hai nút đăng nhập/tạo tài khoản', async () => {
    await openApp('signed_out');
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(screen.getByTestId('welcome-sign-in')).toBeOnTheScreen();
    expect(screen.getByTestId('welcome-create-account')).toBeOnTheScreen();
  });
});
