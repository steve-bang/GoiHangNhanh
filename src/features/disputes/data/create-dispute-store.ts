import { AppError } from '@/core/errors/app-error';
import type { CreatorUidProvider } from '@/features/orders';
import type { SqlDatabase } from '@/platform/sql-database';

import type { DisputeStore } from '../domain/dispute-store';
import { createMemoryDisputeStore } from './memory-dispute-store';
import { createSqliteDisputeStore } from './sqlite-dispute-store';

/**
 * Kho dùng khi chạy: mở SQLite lần đầu cần tới. `open` trả `null` (web) thì dùng kho bộ nhớ. Mở lỗi
 * thì mọi thao tác báo `DISPUTE_SAVE_FAILED`, KHÔNG lặng lẽ chuyển sang bộ nhớ (sẽ mất hồ sơ).
 */
export function createLocalDisputeStore(
  open: () => Promise<SqlDatabase | null>,
  options: { creatorUid?: CreatorUidProvider } = {},
): DisputeStore {
  let resolved: Promise<DisputeStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) =>
          db ? createSqliteDisputeStore(db, options) : createMemoryDisputeStore(options),
        )
        .catch((error: unknown) => {
          resolved = null;
          throw new AppError('DISPUTE_SAVE_FAILED', {}, { cause: error });
        });
    }
    return resolved;
  };
  return {
    createDispute: async (i) => (await get()).createDispute(i),
    getDispute: async (s, id) => (await get()).getDispute(s, id),
    listDisputes: async (s, o) => (await get()).listDisputes(s, o),
    addEvidence: async (s, id, e, n) => (await get()).addEvidence(s, id, e, n),
    addNote: async (s, id, t, n) => (await get()).addNote(s, id, t, n),
    closeDispute: async (s, id, t, n) => (await get()).closeDispute(s, id, t, n),
    listHeldEvidenceIds: async (s) => (await get()).listHeldEvidenceIds(s),
  };
}
