import { createFakePersonalGateways } from './fake-personal-gateways';
import { createUnavailablePersonalGateways } from './unavailable-personal-gateways';
import type { PersonalGateways } from '../domain/types';

export type PersonalBackendMode = 'fake' | 'unavailable';

export interface PersonalBackendEnv {
  readonly isDev: boolean;
  readonly isTest: boolean;
  /** Giá trị của `EXPO_PUBLIC_USE_FAKE_BACKEND`. */
  readonly fakeFlag: string | undefined;
}

/**
 * Cùng quy tắc với cổng của feature shop (`features/shop/data/gateways.ts`): bản giả chỉ khi
 * `__DEV__`, trong test, hoặc đặt RÕ `EXPO_PUBLIC_USE_FAKE_BACKEND=1`; còn lại là "chưa kết nối".
 * Giữ hai bản đồng bộ cho tới khi gom về một chỗ khi có Firebase thật.
 */
export function resolvePersonalBackendMode(env: PersonalBackendEnv): PersonalBackendMode {
  return env.isDev || env.isTest || env.fakeFlag === '1' ? 'fake' : 'unavailable';
}

export function readPersonalBackendEnv(): PersonalBackendEnv {
  return {
    isDev: __DEV__,
    isTest: process.env.NODE_ENV === 'test',
    // Truy cập trực tiếp để Metro thay giá trị lúc đóng gói.
    fakeFlag: process.env.EXPO_PUBLIC_USE_FAKE_BACKEND,
  };
}

export function createPersonalGateways(
  env: PersonalBackendEnv = readPersonalBackendEnv(),
): PersonalGateways {
  if (resolvePersonalBackendMode(env) === 'unavailable') return createUnavailablePersonalGateways();
  return createFakePersonalGateways({ latencyMs: env.isTest ? 0 : 450 });
}

let defaultGateways: PersonalGateways | undefined;

/** Cổng mặc định của app (một thể hiện cho cả phiên). THAY BẰNG FIREBASE THẬT TẠI ĐÂY (Q-08, O-15). */
export function getDefaultPersonalGateways(): PersonalGateways {
  defaultGateways ??= createPersonalGateways();
  return defaultGateways;
}

/** Chỉ cho test. */
export function resetDefaultPersonalGatewaysForTests(): void {
  defaultGateways = undefined;
}
