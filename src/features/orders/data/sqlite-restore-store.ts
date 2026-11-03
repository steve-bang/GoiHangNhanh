import type { ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';
import { logger } from '@/core/logging/logger';
import type { SqlDatabase } from '@/platform/sql-database';

import { toCodeKey } from '../domain/codes';
import {
  EMPTY_PROGRESS,
  RESTORE_PHASES,
  type RestorePhase,
  type RestoreProgress,
  type RestoreStore,
} from '../domain/restore';
import { runSerialized } from './db-queue';
import { migrateLocalDatabase } from './sqlite-order-store';

interface ProgressRow {
  phase: string;
  cursor: string | null;
  done: number;
  imported: number;
}

/**
 * Kho khôi phục trên SQLite, CÙNG kết nối và hàng đợi tuần tự với các kho khác. Mọi ghi dùng điều kiện
 * "chưa có" (không ghi đè bản ghi sẵn có, kể cả bản của người dùng này đang dùng), mỗi trang trong MỘT
 * giao dịch. Bản ghi khôi phục mang người tạo GỐC (`created_by` từ máy chủ) và được đánh dấu đã đăng nên
 * bộ đồng bộ không đăng lại (bất biến: chỉ đăng bản ghi do chính uid tạo, ADR-019). Tệp bằng chứng không
 * có `local_path`; trạng thái lấy từ xác nhận của máy chủ. Lỗi ném `LOCAL_SAVE_UNAVAILABLE`, log không
 * ghi nội dung.
 */
export function createSqliteRestoreStore(db: SqlDatabase): RestoreStore {
  let ready: Promise<void> | null = null;
  const guarded = async <T>(task: () => Promise<T>): Promise<T> => {
    const run = runSerialized(db, async () => {
      if (!ready) {
        ready = migrateLocalDatabase(db).catch((error: unknown) => {
          ready = null;
          throw error;
        });
      }
      await ready;
      return task();
    });
    try {
      return await run;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('restore.local_store_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw new AppError('LOCAL_SAVE_UNAVAILABLE', {}, { cause: error });
    }
  };

  const exists = async (table: 'orders' | 'packing_sessions' | 'evidence_files', id: string) =>
    (await db.getFirstAsync<{ id: string }>(`SELECT id FROM ${table} WHERE id = ?`, [id])) !== null;

  return {
    readProgress: (shopId, uid) =>
      guarded(async () => {
        const rows = await db.getAllAsync<ProgressRow>(
          'SELECT phase, cursor, done, imported FROM restore_progress WHERE shop_id = ? AND uid = ?',
          [shopId, uid],
        );
        const result = {} as Record<RestorePhase, RestoreProgress>;
        for (const phase of RESTORE_PHASES) {
          const row = rows.find((r) => r.phase === phase);
          result[phase] = row
            ? { cursor: row.cursor, done: row.done === 1, imported: row.imported }
            : EMPTY_PROGRESS;
        }
        return result;
      }),
    saveProgress: (shopId, uid, phase, progress, nowDevice) =>
      guarded(async () => {
        await db.runAsync(
          `INSERT INTO restore_progress (shop_id, uid, phase, cursor, done, imported, updated_at_device)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(shop_id, uid, phase) DO UPDATE SET cursor = excluded.cursor,
             done = excluded.done, imported = excluded.imported,
             updated_at_device = excluded.updated_at_device`,
          [
            shopId,
            uid,
            phase,
            progress.cursor,
            progress.done ? 1 : 0,
            progress.imported,
            nowDevice,
          ],
        );
      }),
    existingOrderIds: (shopId, ids) =>
      guarded(async () => {
        const found = new Set<string>();
        for (const id of ids) {
          const row = await db.getFirstAsync<{ id: string }>(
            'SELECT id FROM orders WHERE id = ? AND shop_id = ?',
            [id, shopId],
          );
          if (row) found.add(id);
        }
        return found;
      }),
    importOrders: (shopId, items, nowDevice) =>
      guarded(async () => {
        let written = 0;
        await db.withTransactionAsync(async () => {
          for (const { order, lines, packages } of items) {
            if (order.shopId !== shopId || (await exists('orders', order.id))) continue;
            await db.runAsync(
              `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, tracking_code,
                 tracking_code_key, data_origin, created_at_device, remote_synced_at_device,
                 created_by, last_activity_device)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'entered_by_user', ?, ?, ?, ?)`,
              [
                order.id,
                shopId,
                order.orderCode,
                toCodeKey(order.orderCode),
                order.source,
                order.trackingCode,
                order.trackingCode === null ? null : toCodeKey(order.trackingCode),
                order.createdAtDevice,
                nowDevice,
                order.createdBy ?? null,
                order.createdAtDevice,
              ],
            );
            for (const line of lines) {
              await db.runAsync(
                `INSERT OR IGNORE INTO order_lines (id, order_id, name, variant, quantity, position,
                   data_origin, created_at_device)
                 VALUES (?, ?, ?, ?, ?, ?, 'entered_by_user', ?)`,
                [
                  line.id,
                  order.id,
                  line.name,
                  line.variant,
                  line.quantity,
                  line.position,
                  line.createdAtDevice,
                ],
              );
            }
            for (const pkg of packages) {
              await db.runAsync(
                `INSERT OR IGNORE INTO packages (id, order_id, idx, created_at_device, created_by,
                   remote_synced_at_device)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  pkg.id,
                  order.id,
                  pkg.index,
                  pkg.createdAtDevice,
                  pkg.createdBy ?? null,
                  nowDevice,
                ],
              );
            }
            written += 1;
          }
        });
        return written;
      }),
    importSessions: (shopId, items) =>
      guarded(async () => {
        let written = 0;
        await db.withTransactionAsync(async () => {
          for (const { session, remoteStatus } of items) {
            if (session.shopId !== shopId || (await exists('packing_sessions', session.id))) {
              continue;
            }
            // Khóa ngoại: đơn + kiện phải có trên máy, cùng shop và kiện thuộc đúng đơn.
            const linked = await db.getFirstAsync<{ id: string }>(
              `SELECT p.id FROM packages p JOIN orders o ON o.id = p.order_id
               WHERE p.id = ? AND o.id = ? AND o.shop_id = ?`,
              [session.packageId, session.orderId, shopId],
            );
            if (!linked) continue;
            await db.runAsync(
              `INSERT INTO packing_sessions (id, shop_id, order_id, package_id, started_at_device,
                 snapshot_json, session_status, remote_status, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                session.id,
                shopId,
                session.orderId,
                session.packageId,
                session.startedAtDevice,
                JSON.stringify(session.snapshot),
                session.sessionStatus,
                remoteStatus,
                session.createdBy ?? null,
              ],
            );
            await db.runAsync(
              `UPDATE orders SET last_activity_device = MAX(last_activity_device, ?)
               WHERE id = ? AND shop_id = ?`,
              [session.startedAtDevice, session.orderId, shopId],
            );
            written += 1;
          }
        });
        return written;
      }),
    importEvidence: (shopId, items, nowDevice) =>
      guarded(async () => {
        let written = 0;
        await db.withTransactionAsync(async () => {
          for (const file of items) {
            if (await exists('evidence_files', file.id)) continue;
            const linked = await db.getFirstAsync<{ id: string }>(
              `SELECT s.id FROM packing_sessions s
               WHERE s.id = ? AND s.shop_id = ? AND s.order_id = ? AND s.package_id = ?`,
              [file.sessionId, shopId, file.orderId, file.packageId],
            );
            if (!linked) continue;
            await db.runAsync(
              `INSERT INTO evidence_files (id, shop_id, order_id, package_id, session_id, file_group,
                 kind, state, local_path, size_bytes, duration_ms, sha256_client, attempt_count,
                 next_attempt_at_device, last_error_code, hashed_size_bytes, hashed_mtime_device,
                 last_alive_at_device, created_at_device, updated_at_device)
               VALUES (?, ?, ?, ?, ?, 'pack', ?, ?, NULL, ?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
              [
                file.id,
                shopId,
                file.orderId,
                file.packageId,
                file.sessionId,
                file.kind,
                file.state,
                file.sizeBytes,
                file.durationMs,
                file.sha256Client,
                file.capturedAtDevice,
                nowDevice,
              ],
            );
            written += 1;
          }
        });
        return written;
      }),
  };
}

/** Kho khi chạy: mở SQLite lần đầu cần tới; `open` trả `null` (web) thì kho trong bộ nhớ (no-op). */
export function createLocalRestoreStore(open: () => Promise<SqlDatabase | null>): RestoreStore {
  let resolved: Promise<RestoreStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) => (db ? createSqliteRestoreStore(db) : createMemoryRestoreStore()))
        .catch((error: unknown) => {
          resolved = null;
          throw error;
        });
    }
    return resolved;
  };
  return {
    readProgress: async (s, u) => (await get()).readProgress(s, u),
    saveProgress: async (s, u, p, v, n) => (await get()).saveProgress(s, u, p, v, n),
    existingOrderIds: async (s, ids) => (await get()).existingOrderIds(s, ids),
    importOrders: async (s, i, n) => (await get()).importOrders(s, i, n),
    importSessions: async (s, i) => (await get()).importSessions(s, i),
    importEvidence: async (s, i, n) => (await get()).importEvidence(s, i, n),
  };
}

/** Kho trống (web, test không có SQLite): không có gì để ghi nên khôi phục là no-op. */
export function createMemoryRestoreStore(): RestoreStore {
  const progress = new Map<string, RestoreProgress>();
  const key = (shopId: ShopId, uid: string, phase: RestorePhase) => `${shopId}|${uid}|${phase}`;
  return {
    readProgress: async (shopId, uid) => {
      const result = {} as Record<RestorePhase, RestoreProgress>;
      for (const phase of RESTORE_PHASES) {
        result[phase] = progress.get(key(shopId, uid, phase)) ?? EMPTY_PROGRESS;
      }
      return result;
    },
    saveProgress: async (shopId, uid, phase, value) => {
      progress.set(key(shopId, uid, phase), value);
    },
    existingOrderIds: async () => new Set(),
    importOrders: async () => 0,
    importSessions: async () => 0,
    importEvidence: async () => 0,
  };
}
