import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';
import { logger } from '@/core/logging/logger';
import {
  applyEventToFile,
  hasSameBinding,
  toStateCounts,
  UNSYNCED_STATES,
  type EvidenceFile,
  type EvidenceFileStore,
  type FileState,
} from '@/features/evidence';
import type { SqlDatabase } from '@/platform/sql-database';

import { runSerialized } from './db-queue';
import { migrateLocalDatabase } from './sqlite-order-store';

interface FileRow {
  id: string;
  shop_id: string;
  order_id: string;
  package_id: string;
  session_id: string;
  file_group: string;
  kind: string;
  state: string;
  local_path: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  sha256_client: string | null;
  attempt_count: number;
  next_attempt_at_device: number | null;
  last_error_code: string | null;
  created_at_device: number;
  updated_at_device: number;
}

const COLUMNS =
  'id, shop_id, order_id, package_id, session_id, file_group, kind, state, local_path, size_bytes, duration_ms, sha256_client, attempt_count, next_attempt_at_device, last_error_code, created_at_device, updated_at_device';

/** `COLUMNS` với tiền tố bảng `f.` (truy vấn có JOIN). */
const PREFIXED_COLUMNS = COLUMNS.split(', ')
  .map((c) => `f.${c}`)
  .join(', ');

const UNSYNCED_SQL = UNSYNCED_STATES.map((s) => `'${s}'`).join(', ');

function toFile(row: FileRow): EvidenceFile {
  return {
    id: row.id as EvidenceId,
    shopId: row.shop_id as ShopId,
    orderId: row.order_id as OrderId,
    packageId: row.package_id as PackageId,
    sessionId: row.session_id as SessionId,
    group: row.file_group === 'return' ? 'return' : 'pack',
    kind: row.kind === 'photo' ? 'photo' : 'video',
    state: row.state as FileState,
    localPath: row.local_path,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    sha256Client: row.sha256_client,
    attemptCount: row.attempt_count,
    nextAttemptAtDevice: row.next_attempt_at_device,
    lastErrorCode: row.last_error_code,
    createdAtDevice: row.created_at_device,
    updatedAtDevice: row.updated_at_device,
  };
}

/**
 * Kho tệp bằng chứng trên SQLite (bảng `evidence_files`, migration v3). Dùng chung cơ sở dữ liệu và
 * bộ migration với kho đơn; mọi truy vấn tham số hóa và có `shop_id` (bất biến 8). Lỗi lưu trữ ném
 * `LOCAL_SAVE_UNAVAILABLE`; không log nội dung (đường dẫn tệp, mã băm).
 */
export function createSqliteEvidenceFileStore(db: SqlDatabase): EvidenceFileStore {
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
      logger.error('evidence.local_store_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw new AppError('LOCAL_SAVE_UNAVAILABLE', {}, { cause: error });
    }
  };

  const getRow = (shopId: ShopId, id: string) =>
    db.getFirstAsync<FileRow>(
      `SELECT ${COLUMNS} FROM evidence_files WHERE shop_id = ? AND id = ?`,
      [shopId, id],
    );

  const list = async (where: string, shopId: ShopId, value: string) =>
    (
      await db.getAllAsync<FileRow>(
        `SELECT ${COLUMNS} FROM evidence_files WHERE shop_id = ? AND ${where} = ? ORDER BY created_at_device, id`,
        [shopId, value],
      )
    ).map(toFile);

  return {
    create: (input) =>
      guarded(async () => {
        const holder: { row: FileRow | null } = { row: null };
        // Đọc-kiểm-ghi trong một giao dịch: id đã có thì phải cùng liên kết; chưa có thì bộ ba kiện,
        // phiên, đơn phải thuộc nhau và cùng shop (khóa ngoại chỉ kiểm từng cột có tồn tại).
        await db.withTransactionAsync(async () => {
          const existing = await db.getFirstAsync<FileRow>(
            `SELECT ${COLUMNS} FROM evidence_files WHERE id = ?`,
            [input.id],
          );
          if (existing) {
            if (!hasSameBinding(toFile(existing), input)) {
              throw new AppError('LOCAL_SAVE_UNAVAILABLE');
            }
            holder.row = existing;
            return;
          }
          const linked = await db.getFirstAsync<{ id: string }>(
            `SELECT s.id FROM packing_sessions s
             JOIN orders o ON o.id = s.order_id
             JOIN packages p ON p.id = s.package_id AND p.order_id = o.id
             WHERE s.id = ? AND s.shop_id = ? AND o.shop_id = ? AND o.id = ? AND p.id = ?`,
            [input.sessionId, input.shopId, input.shopId, input.orderId, input.packageId],
          );
          if (!linked) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
          await db.runAsync(
            `INSERT INTO evidence_files (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, 'recording', NULL, NULL, NULL, NULL, 0, NULL, NULL, ?, ?)`,
            [
              input.id,
              input.shopId,
              input.orderId,
              input.packageId,
              input.sessionId,
              input.group,
              input.kind,
              input.createdAtDevice,
              input.createdAtDevice,
            ],
          );
          holder.row = await getRow(input.shopId, input.id);
        });
        if (!holder.row) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
        return toFile(holder.row);
      }),
    get: (shopId, id) =>
      guarded(async () => {
        const row = await getRow(shopId, id);
        return row ? toFile(row) : null;
      }),
    applyEvent: (shopId, id, event, nowDevice, patch) =>
      guarded(async () => {
        let outcome: ReturnType<typeof applyEventToFile> = { ok: false, error: 'FILE_NOT_FOUND' };
        await db.withTransactionAsync(async () => {
          const row = await getRow(shopId, id);
          if (!row) return;
          outcome = applyEventToFile(toFile(row), event, nowDevice, patch);
          if (!outcome.ok) return;
          const f = outcome.file;
          await db.runAsync(
            'UPDATE evidence_files SET state = ?, local_path = ?, size_bytes = ?, duration_ms = ?, sha256_client = ?, attempt_count = ?, next_attempt_at_device = ?, last_error_code = ?, updated_at_device = ? WHERE shop_id = ? AND id = ?',
            [
              f.state,
              f.localPath,
              f.sizeBytes,
              f.durationMs,
              f.sha256Client,
              f.attemptCount,
              f.nextAttemptAtDevice,
              f.lastErrorCode,
              f.updatedAtDevice,
              shopId,
              id,
            ],
          );
        });
        return outcome;
      }),
    listByStates: (shopId, states) =>
      guarded(async () => {
        if (states.length === 0) return [];
        const marks = states.map(() => '?').join(', ');
        const rows = await db.getAllAsync<FileRow>(
          `SELECT ${COLUMNS} FROM evidence_files WHERE shop_id = ? AND state IN (${marks}) ORDER BY created_at_device, id`,
          [shopId, ...states],
        );
        return rows.map(toFile);
      }),
    listForUpload: (shopId, states, uid) =>
      guarded(async () => {
        if (!uid || states.length === 0) return [];
        const marks = states.map(() => '?').join(', ');
        // Chỉ tệp của phiên do CHÍNH uid tạo, cùng shop (NULL không bao giờ khớp; Q-24g, V1-07).
        const rows = await db.getAllAsync<FileRow>(
          `SELECT ${PREFIXED_COLUMNS}
           FROM evidence_files f
           JOIN packing_sessions s ON s.id = f.session_id AND s.shop_id = f.shop_id
           WHERE f.shop_id = ? AND s.created_by = ? AND f.state IN (${marks})
           ORDER BY f.created_at_device, f.id`,
          [shopId, uid, ...states],
        );
        return rows.map(toFile);
      }),
    listShopsWithStates: (states) =>
      guarded(async () => {
        if (states.length === 0) return [];
        const marks = states.map(() => '?').join(', ');
        const rows = await db.getAllAsync<{ shop_id: string }>(
          `SELECT DISTINCT shop_id FROM evidence_files WHERE state IN (${marks}) ORDER BY shop_id`,
          [...states],
        );
        return rows.map((r) => r.shop_id as ShopId);
      }),
    listByOrders: (shopId, orderIds) =>
      guarded(async () => {
        if (orderIds.length === 0) return [];
        const marks = orderIds.map(() => '?').join(', ');
        const rows = await db.getAllAsync<FileRow>(
          `SELECT ${COLUMNS} FROM evidence_files WHERE shop_id = ? AND order_id IN (${marks}) ORDER BY created_at_device, id`,
          [shopId, ...orderIds],
        );
        return rows.map(toFile);
      }),
    listByOrder: (shopId, orderId) => guarded(() => list('order_id', shopId, orderId)),
    listBySession: (shopId, sessionId) => guarded(() => list('session_id', shopId, sessionId)),
    countUnsynced: (shopId) =>
      guarded(async () => {
        const row = await db.getFirstAsync<{ n: number }>(
          `SELECT COUNT(*) AS n FROM evidence_files WHERE shop_id = ? AND state IN (${UNSYNCED_SQL})`,
          [shopId],
        );
        return row?.n ?? 0;
      }),
    countUnsyncedOnDevice: () =>
      guarded(async () => {
        const row = await db.getFirstAsync<{ n: number }>(
          `SELECT COUNT(*) AS n FROM evidence_files WHERE state IN (${UNSYNCED_SQL})`,
        );
        return row?.n ?? 0;
      }),
    countByState: (shopId, updatedIn) =>
      guarded(async () => {
        const range = updatedIn ? ' AND updated_at_device >= ? AND updated_at_device < ?' : '';
        const rows = await db.getAllAsync<{ state: string; n: number }>(
          `SELECT state, COUNT(*) AS n FROM evidence_files WHERE shop_id = ?${range} GROUP BY state`,
          updatedIn ? [shopId, updatedIn.fromDevice, updatedIn.toDevice] : [shopId],
        );
        return toStateCounts(rows);
      }),
  };
}
