import { createFakeGateways, FAKE_TAKEN_EMAIL } from './fake-gateways';
import { createUnavailableGateways } from './unavailable-gateways';
import type { Gateways, SessionState } from '../domain/types';

export type BackendMode = 'fake' | 'unavailable';

export interface BackendEnv {
  readonly isDev: boolean;
  readonly isTest: boolean;
  /** Giá trị của `EXPO_PUBLIC_USE_FAKE_BACKEND`. */
  readonly fakeFlag: string | undefined;
  /** Giá trị của `EXPO_PUBLIC_FAKE_SESSION`: `signed_out` | `no_shop` | `signed_in` (chỉ cổng giả dùng). */
  readonly fakeSession?: string | undefined;
}

/**
 * Bản giả chỉ khi `__DEV__`, trong test, hoặc đặt RÕ `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (ví dụ để xuất
 * bản web chụp ảnh giao diện). Còn lại (bản build thường) là "chưa kết nối".
 */
export function resolveBackendMode(env: BackendEnv): BackendMode {
  return env.isDev || env.isTest || env.fakeFlag === '1' ? 'fake' : 'unavailable';
}

/**
 * Phiên giả khi mở app (cổng giả). Giá trị hợp lệ của `EXPO_PUBLIC_FAKE_SESSION` được dùng nguyên;
 * không đặt: `__DEV__`/test = `signed_in` (giữ hành vi mở app hiện tại để dev/QA vào được khung),
 * còn lại (bản xem trước dùng cổng giả mà không đặt cờ) = `signed_out`. Bản build thường không
 * dùng cổng giả nên không có phiên (xem `createUnavailableGateways`). Xem decisions.md Q-15.
 */
export function resolveFakeSession(env: BackendEnv): SessionState {
  switch (env.fakeSession) {
    case 'signed_out':
      return 'signed_out';
    case 'no_shop':
      return 'signed_in_no_shop';
    case 'signed_in':
      return 'signed_in';
    default:
      return env.isDev || env.isTest ? 'signed_in' : 'signed_out';
  }
}

export function readBackendEnv(): BackendEnv {
  return {
    isDev: __DEV__,
    isTest: process.env.NODE_ENV === 'test',
    // Truy cập trực tiếp để Metro thay giá trị lúc đóng gói.
    fakeFlag: process.env.EXPO_PUBLIC_USE_FAKE_BACKEND,
    fakeSession: process.env.EXPO_PUBLIC_FAKE_SESSION,
  };
}

export function createGateways(env: BackendEnv = readBackendEnv()): Gateways {
  if (resolveBackendMode(env) === 'unavailable') return createUnavailableGateways();
  return createFakeGateways({
    latencyMs: env.isTest ? 0 : 450,
    takenEmails: [FAKE_TAKEN_EMAIL],
    sessionState: resolveFakeSession(env),
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
