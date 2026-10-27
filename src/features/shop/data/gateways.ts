import { createFakeGateways, FAKE_TAKEN_EMAIL } from './fake-gateways';
import { createUnavailableGateways } from './unavailable-gateways';
import type { Gateways } from '../domain/types';

export type BackendMode = 'fake' | 'unavailable';

export interface BackendEnv {
  readonly isDev: boolean;
  readonly isTest: boolean;
  /** Giá trị của `EXPO_PUBLIC_USE_FAKE_BACKEND`. */
  readonly fakeFlag: string | undefined;
}

/**
 * Bản giả chỉ khi `__DEV__`, trong test, hoặc đặt RÕ `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (ví dụ để xuất
 * bản web chụp ảnh giao diện). Còn lại (bản build thường) là "chưa kết nối".
 */
export function resolveBackendMode(env: BackendEnv): BackendMode {
  return env.isDev || env.isTest || env.fakeFlag === '1' ? 'fake' : 'unavailable';
}

export function readBackendEnv(): BackendEnv {
  return {
    isDev: __DEV__,
    isTest: process.env.NODE_ENV === 'test',
    // Truy cập trực tiếp để Metro thay giá trị lúc đóng gói.
    fakeFlag: process.env.EXPO_PUBLIC_USE_FAKE_BACKEND,
  };
}

export function createGateways(env: BackendEnv = readBackendEnv()): Gateways {
  if (resolveBackendMode(env) === 'unavailable') return createUnavailableGateways();
  return createFakeGateways({
    latencyMs: env.isTest ? 0 : 450,
    takenEmails: [FAKE_TAKEN_EMAIL],
  });
}

let defaultGateways: Gateways | undefined;

/**
 * Cổng mặc định của app (một thể hiện cho cả phiên). THAY BẰNG FIREBASE THẬT TẠI ĐÂY khi có dự án
 * Firebase (Q-08) và đã chốt phương thức đăng nhập (O-15): Firebase Auth cho `AuthGateway`, Cloud
 * Function callable `createShop` cho `ShopGateway`. Xem decisions.md Q-13.
 */
export function getDefaultGateways(): Gateways {
  defaultGateways ??= createGateways();
  return defaultGateways;
}

/** Chỉ cho test. */
export function resetDefaultGatewaysForTests(): void {
  defaultGateways = undefined;
}
