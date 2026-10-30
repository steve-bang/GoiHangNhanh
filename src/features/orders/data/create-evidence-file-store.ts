import { AppError } from '@/core/errors/app-error';
import type { EvidenceFileStore } from '@/features/evidence';
import type { SqlDatabase } from '@/platform';

import { createMemoryEvidenceFileStore } from './memory-evidence-file-store';
import { createSqliteEvidenceFileStore } from './sqlite-evidence-file-store';

/**
 * Kho tệp bằng chứng khi chạy: mở SQLite lần đầu cần tới, CÙNG kết nối với kho đơn (`openLocalDatabase`
 * dùng chung một kết nối). `open` trả `null` (web) thì dùng kho bộ nhớ. Mở LỖI thì mọi thao tác báo
 * `LOCAL_SAVE_UNAVAILABLE`, không lặng lẽ chuyển sang bộ nhớ (sẽ mất bằng chứng khi đóng app).
 */
export function createLocalEvidenceFileStore(
  open: () => Promise<SqlDatabase | null>,
): EvidenceFileStore {
  let resolved: Promise<EvidenceFileStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) => (db ? createSqliteEvidenceFileStore(db) : createMemoryEvidenceFileStore()))
        .catch((error: unknown) => {
          resolved = null;
          throw new AppError('LOCAL_SAVE_UNAVAILABLE', {}, { cause: error });
        });
    }
    return resolved;
  };
  return {
    create: async (f) => (await get()).create(f),
    get: async (s, id) => (await get()).get(s, id),
    applyEvent: async (s, id, e, n, p) => (await get()).applyEvent(s, id, e, n, p),
    listByStates: async (s, st) => (await get()).listByStates(s, st),
    listForUpload: async (s, st, u) => (await get()).listForUpload(s, st, u),
    listShopsWithStates: async (st) => (await get()).listShopsWithStates(st),
    listByOrders: async (s, o) => (await get()).listByOrders(s, o),
    listByOrder: async (s, o) => (await get()).listByOrder(s, o),
    listBySession: async (s, ss) => (await get()).listBySession(s, ss),
    countUnsynced: async (s) => (await get()).countUnsynced(s),
    countUnsyncedOnDevice: async () => (await get()).countUnsyncedOnDevice(),
    countByState: async (s, r) => (await get()).countByState(s, r),
  };
}
