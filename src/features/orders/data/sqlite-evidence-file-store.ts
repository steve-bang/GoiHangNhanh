import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';
import { logger } from '@/core/logging/logger';
import {
  applyEventToFile,
  ALL_FILE_STATES,
  isUnsynced,
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
  created_at_device: number;
  updated_at_device: number;
}

const COLUMNS =
  'id, shop_id, order_id, package_id, session_id, file_group, kind, state, local_path, size_bytes, duration_ms, sha256_client, created_at_device, updated_at_device';

const UNSYNCED_STATES = ALL_FILE_STATES.filter(isUnsynced);
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
        await db.runAsync(
          `INSERT OR IGNORE INTO evidence_files (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, 'recording', NULL, NULL, NULL, NULL, ?, ?)`,
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
        const row = await getRow(input.shopId, input.id);
        if (!row) throw new AppError('LOCAL_SAVE_UNAVAILABLE'); // id đã thuộc shop khác
        return toFile(row);
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
            'UPDATE evidence_files SET state = ?, local_path = ?, size_bytes = ?, duration_ms = ?, sha256_client = ?, updated_at_device = ? WHERE shop_id = ? AND id = ?',
            [
              f.state,
              f.localPath,
              f.sizeBytes,
              f.durationMs,
              f.sha256Client,
              f.updatedAtDevice,
              shopId,
              id,
            ],
          );
        });
        return outcome;
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
  };
}
