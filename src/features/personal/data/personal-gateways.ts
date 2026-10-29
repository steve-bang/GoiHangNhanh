import type { ApiClient } from '@/api/contract';
import {
  createApi,
  getDefaultApi,
  readBackendEnv,
  resolveBackendMode,
  type BackendEnv,
} from '@/api/create-api';

import { createFakePersonalGateways } from './fake-personal-gateways';
import { createFirebasePersonalGateways } from './firebase-personal-gateways';
import { createUnavailablePersonalGateways } from './unavailable-personal-gateways';
import type { PersonalGateways } from '../domain/types';

/**
 * Chế độ của cổng cá nhân CHỌN THEO CÙNG cơ chế của lớp API (`resolveBackendMode` ở
 * `src/api/create-api.ts`): không có bản sao quy tắc ở đây. Ánh xạ:
 * - `fake`: bản giả trong bộ nhớ (dev, test, `EXPO_PUBLIC_USE_FAKE_BACKEND=1`/`EXPO_PUBLIC_BACKEND=fake`).
 * - `firebase`: nối tối thiểu danh tính phiên, hồ sơ, shop đang dùng và đăng xuất thật qua `ApiClient`
 *   (`firebase-personal-gateways.ts`); phần còn lại GIỮ "chưa kết nối", KHÔNG giả thành công (Q-20t).
 *   Thiếu cấu hình Firebase thì `ApiClient` là bản "chưa kết nối" nên mọi lời gọi cũng báo chưa kết nối.
 * - `unavailable`: "chưa kết nối".
 */
export function createPersonalGateways(
  env: BackendEnv = readBackendEnv(),
  /** Lấy `ApiClient` cho chế độ Firebase (mặc định tạo theo `env`; app truyền API mặc định dùng chung). */
  getApi: () => ApiClient = () => createApi(env),
): PersonalGateways {
  const mode = resolveBackendMode(env);
  if (mode === 'fake') return createFakePersonalGateways({ latencyMs: env.isTest ? 0 : 450 });
  if (mode === 'firebase') return createFirebasePersonalGateways(getApi());
  return createUnavailablePersonalGateways();
}

let defaultGateways: PersonalGateways | undefined;

/** Cổng mặc định của app (một thể hiện cho cả phiên). Mở rộng hợp đồng API rồi nối Firebase thật tại `createPersonalGateways` (Q-20t). */
export function getDefaultPersonalGateways(): PersonalGateways {
  defaultGateways ??= createPersonalGateways(readBackendEnv(), getDefaultApi);
  return defaultGateways;
}

/** Chỉ cho test. */
export function resetDefaultPersonalGatewaysForTests(): void {
  defaultGateways = undefined;
}
