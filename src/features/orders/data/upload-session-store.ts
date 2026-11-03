import type { SqlDatabase, StoredUploadSession, UploadSessionStore } from '@/platform';

import { runSerialized } from './db-queue';
import { migrateLocalDatabase } from './sqlite-order-store';

/**
 * Kho phiên tải GCS đang dở trên SQLite (bảng `upload_sessions`, migration v18), CÙNG kết nối và hàng đợi
 * tuần tự với các kho khác (`db-queue.ts`). Mọi truy vấn lọc theo shop (bất biến 8). `location` có quyền ghi
 * tới khi phiên hết hạn nên không bao giờ được log.
 */
export function createSqliteUploadSessionStore(
  db: SqlDatabase,
  now: () => number = Date.now,
): UploadSessionStore {
  let ready: Promise<void> | null = null;
  const run = <T>(task: () => Promise<T>): Promise<T> =>
    runSerialized(db, async () => {
      if (!ready) {
        ready = migrateLocalDatabase(db).catch((error: unknown) => {
          ready = null; // lần sau thử lại
          throw error;
        });
      }
      await ready;
      return task();
    });
  return {
    get: (shopId, evidenceId) =>
      run(async () => {
        const row = await db.getFirstAsync<{ location: string; size_bytes: number }>(
          'SELECT location, size_bytes FROM upload_sessions WHERE shop_id = ? AND evidence_id = ?',
          [shopId, evidenceId],
        );
        return row ? { location: row.location, sizeBytes: row.size_bytes } : null;
      }),
    save: (shopId, evidenceId, session) =>
      run(() =>
        db.runAsync(
          // Cùng bằng chứng nhưng khác shop thì KHÔNG ghi đè (WHERE ở nhánh cập nhật).
          `INSERT INTO upload_sessions (evidence_id, shop_id, location, size_bytes, created_at_device)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(evidence_id) DO UPDATE SET location = excluded.location,
             size_bytes = excluded.size_bytes, created_at_device = excluded.created_at_device
             WHERE upload_sessions.shop_id = excluded.shop_id`,
          [evidenceId, shopId, session.location, session.sizeBytes, now()],
        ),
      ).then(() => undefined),
    clear: (shopId, evidenceId) =>
      run(() =>
        db.runAsync('DELETE FROM upload_sessions WHERE shop_id = ? AND evidence_id = ?', [
          shopId,
          evidenceId,
        ]),
      ).then(() => undefined),
  };
}

/** Kho trong bộ nhớ (web, test): mất khi tắt app. Cùng ngữ nghĩa với bản SQLite. */
export function createMemoryUploadSessionStore(): UploadSessionStore {
  const sessions = new Map<string, { shopId: string; session: StoredUploadSession }>();
  return {
    get: async (shopId, evidenceId) => {
      const entry = sessions.get(evidenceId);
      return entry && entry.shopId === shopId ? entry.session : null;
    },
    save: async (shopId, evidenceId, session) => {
      const entry = sessions.get(evidenceId);
      if (entry && entry.shopId !== shopId) return;
      sessions.set(evidenceId, { shopId, session });
    },
    clear: async (shopId, evidenceId) => {
      const entry = sessions.get(evidenceId);
      if (entry && entry.shopId === shopId) sessions.delete(evidenceId);
    },
  };
}

/**
 * Kho khi chạy: mở SQLite lần đầu cần tới (lười). `open` trả `null` (web) thì dùng kho bộ nhớ. Mở lỗi thì
 * thao tác ném lỗi; lần sau thử mở lại. Bên gọi (bộ tải) nuốt lỗi kho: không có kho thì tải từ đầu như cũ.
 */
export function createLocalUploadSessionStore(
  open: () => Promise<SqlDatabase | null>,
): UploadSessionStore {
  let resolved: Promise<UploadSessionStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) => (db ? createSqliteUploadSessionStore(db) : createMemoryUploadSessionStore()))
        .catch((error: unknown) => {
          resolved = null;
          throw error;
        });
    }
    return resolved;
  };
  return {
    get: async (s, id) => (await get()).get(s, id),
    save: async (s, id, session) => (await get()).save(s, id, session),
    clear: async (s, id) => (await get()).clear(s, id),
  };
}
