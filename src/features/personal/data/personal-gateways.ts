import { readBackendEnv, resolveBackendMode, type BackendEnv } from '@/api/create-api';

import { createFakePersonalGateways } from './fake-personal-gateways';
import { createUnavailablePersonalGateways } from './unavailable-personal-gateways';
import type { PersonalGateways } from '../domain/types';

/**
 * Chế độ của cổng cá nhân CHỌN THEO CÙNG cơ chế của lớp API (`resolveBackendMode` ở
 * `src/api/create-api.ts`): không có bản sao quy tắc ở đây. Ánh xạ:
 * - `fake`: bản giả trong bộ nhớ (dev, test, `EXPO_PUBLIC_USE_FAKE_BACKEND=1`/`EXPO_PUBLIC_BACKEND=fake`).
 * - `firebase` và `unavailable`: **"chưa kết nối"**. Hợp đồng `ApiClient` hiện chưa có hồ sơ, đăng
 *   xuất, đổi mật khẩu, danh sách/chuyển shop, đổi tên shop không kèm nguồn bán, hay cài đặt thông báo
 *   nên chưa có gì để nối Firebase thật một cách an toàn; KHÔNG giả thành công (decisions.md Q-20t).
 */
export function createPersonalGateways(env: BackendEnv = readBackendEnv()): PersonalGateways {
  if (resolveBackendMode(env) === 'fake') {
    return createFakePersonalGateways({ latencyMs: env.isTest ? 0 : 450 });
  }
  return createUnavailablePersonalGateways();
}

let defaultGateways: PersonalGateways | undefined;

/** Cổng mặc định của app (một thể hiện cho cả phiên). Mở rộng hợp đồng API rồi nối Firebase thật tại `createPersonalGateways` (Q-20t). */
export function getDefaultPersonalGateways(): PersonalGateways {
  defaultGateways ??= createPersonalGateways();
  return defaultGateways;
}

/** Chỉ cho test. */
export function resetDefaultPersonalGatewaysForTests(): void {
  defaultGateways = undefined;
}
