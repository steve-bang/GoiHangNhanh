import type { ApiClient } from '@/api/contract';
import { getDefaultApi } from '@/api/create-api';

/**
 * Cổng của feature shop = API mặc định của app (`src/api`): Firebase ở bản thật, bản giả ở dev/test.
 * Feature không biết backend nào đứng sau; đổi backend ở `src/api/create-api.ts`.
 */
export function getDefaultGateways(): ApiClient {
  return getDefaultApi();
}
