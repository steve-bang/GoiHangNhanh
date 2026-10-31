import { logger } from '@/core/logging/logger';
import type { SqlDatabase } from '@/platform/sql-database';

import { runSerialized } from './db-queue';
import { migrateLocalDatabase } from './sqlite-order-store';

/**
 * Xóa dữ liệu trên máy SAU KHI máy chủ đã xác nhận xóa tài khoản (V1-15; kế hoạch v1 mục 3.3). Đây là
 * ngoại lệ có chủ đích với bất biến 4 (R-2 A, docs/06 "Hệ quả với Firebase"): người dùng tự yêu cầu, đã
 * thấy cảnh báo và tích xác nhận riêng khi còn tệp chưa tải. Không dùng ở bất kỳ luồng nào khác.
 *
 * Bảng nghiệp vụ bị xóa, con trước cha (khóa ngoại bật). `device_settings` là cài đặt của MÁY (Wi‑Fi, báo
 * lỗi), không phải dữ liệu tài khoản: giữ lại. Thêm bảng ở migration mới thì PHẢI thêm vào một trong hai
 * danh sách (test đối chiếu `sqlite_master`).
 */
export const WIPED_TABLES: readonly string[] = [
  'dispute_events',
  'dispute_evidence',
  'disputes',
  'return_media',
  'return_events',
  'return_discrepancies',
  'return_lines',
  'return_link_events',
  'return_cases',
  'evidence_files',
  'packing_sessions',
  'packages',
  'order_lines',
  'orders',
  'search_history',
];
export const KEPT_TABLES: readonly string[] = ['device_settings'];

/**
 * `DELETE` mọi bảng nghiệp vụ trong MỘT giao dịch, trên hàng đợi chung của kết nối (không chồng giao
 * dịch của kho khác). Giữ schema và `user_version`. Gọi lại được (bảng rỗng thì không làm gì).
 *
 * Không để dữ liệu đã xóa còn nằm trên đĩa (review PR #61): bật `secure_delete` TRƯỚC khi xóa (SQLite ghi
 * đè trang/ô đã giải phóng bằng 0), sau giao dịch ép ghi WAL vào tệp chính và cắt WAL
 * (`wal_checkpoint(TRUNCATE)`, bản sao cũ của trang nằm trong WAL), rồi `VACUUM` ngoài giao dịch để dựng
 * lại tệp. Hai bước sau chỉ là dọn thêm: lỗi chỉ ghi log, không làm hỏng việc xóa (dữ liệu đã bị xóa khỏi
 * bảng). Tất cả nằm TRƯỚC bước gỡ dấu của `createLocalDataWiper`.
 */
export function wipeLocalDatabase(db: SqlDatabase): Promise<void> {
  return runSerialized(db, async () => {
    // CSDL có thể chưa được kho nào mở trong lần chạy này (khởi động thấy dấu): đưa về schema mới nhất.
    await migrateLocalDatabase(db);
    await db.execAsync('PRAGMA secure_delete = ON');
    await db.withTransactionAsync(async () => {
      for (const table of WIPED_TABLES) await db.runAsync(`DELETE FROM ${table}`);
    });
    try {
      await db.getFirstAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      logger.warn('local_wipe.checkpoint_failed');
    }
    try {
      await db.execAsync('VACUUM');
    } catch {
      logger.warn('local_wipe.vacuum_failed');
    }
  });
}

/** Bảng có `created_by` (người tạo) dùng để biết dữ liệu có chắc là của tài khoản này không. */
const OWNED_TABLES = [
  'orders',
  'packages',
  'packing_sessions',
  'return_cases',
  'return_media',
  'disputes',
] as const;

/**
 * Số bản ghi trên máy KHÔNG chắc là của `uid`: người tạo khác hoặc không rõ (NULL), ở mọi shop. Xóa tài
 * khoản bị chặn khi số này > 0 (decisions.md Q-29 / V1-15): dữ liệu liên kết chéo nên không xóa chọn lọc.
 */
export function countForeignRecords(db: SqlDatabase, uid: string): Promise<number> {
  return runSerialized(db, async () => {
    await migrateLocalDatabase(db);
    const parts = OWNED_TABLES.map(
      (table) => `(SELECT COUNT(*) FROM ${table} WHERE created_by IS NULL OR created_by <> ?)`,
    );
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT ${parts.join(' + ')} AS n`,
      OWNED_TABLES.map(() => uid),
    );
    return row?.n ?? 0;
  });
}

/** Các bước có tác dụng phụ, tiêm vào để test thứ tự và giả lập app bị tắt sau từng bước. */
export interface LocalWipeSteps {
  hasMarker(): boolean;
  /** `true` khi dấu đã chắc trên đĩa. */
  setMarker(): boolean;
  /** `true` khi `evidence/` không còn tệp nào. */
  deleteEvidenceFiles(): boolean;
  wipeDatabase(): Promise<void>;
  /** Thoát phiên Auth trên máy. Lỗi bị bỏ qua (tài khoản đã bị xóa ở máy chủ). */
  signOutLocal(): Promise<void>;
  /** `true` khi dấu chắc đã gỡ. */
  clearMarker(): boolean;
}

export type LocalWipeFailure = 'evidence_files' | 'database' | 'marker';

export class LocalWipeError extends Error {
  constructor(readonly step: LocalWipeFailure) {
    super(`local_wipe_failed:${step}`);
  }
}

export interface LocalDataWiper {
  /** Còn dấu của lần xóa chưa xong (đọc đồng bộ). */
  hasPending(): boolean;
  /**
   * Chạy TỪ ĐẦU: (1) đặt dấu, (2) xóa tệp `evidence/`, (3) xóa CSDL, (4) thoát Auth trên máy, (5) gỡ dấu.
   * Mọi bước idempotent nên chạy lại sau khi app bị tắt ở bất kỳ bước nào cho cùng kết quả. Bước 2, 3, 5
   * lỗi thì ném `LocalWipeError` và GIỮ dấu (lần sau chạy lại). Thoát Auth đứng TRƯỚC gỡ dấu: tắt app giữa
   * hai bước không để lại phiên Auth của tài khoản đã xóa mà không còn dấu nào nhắc dọn.
   */
  run(): Promise<void>;
}

export function createLocalDataWiper(steps: LocalWipeSteps): LocalDataWiper {
  let inFlight: Promise<void> | null = null;
  const runOnce = async () => {
    if (!steps.setMarker()) {
      // Vẫn xóa (máy chủ đã xóa tài khoản, người dùng đã đồng ý); chỉ mất khả năng chạy lại sau khi tắt app.
      logger.warn('local_wipe.marker_not_set');
    }
    if (!steps.deleteEvidenceFiles()) throw new LocalWipeError('evidence_files');
    try {
      await steps.wipeDatabase();
    } catch {
      throw new LocalWipeError('database');
    }
    await steps.signOutLocal().catch(() => {
      logger.warn('local_wipe.sign_out_failed');
    });
    if (!steps.clearMarker()) throw new LocalWipeError('marker');
  };
  return {
    hasPending: () => steps.hasMarker(),
    run() {
      inFlight ??= runOnce().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}

/** Phần CSDL của việc xóa tài khoản trên máy, theo kết nối dùng chung của app. */
export interface LocalDeviceData {
  /** Xem `countForeignRecords`. Không có SQLite (bản web, kho bộ nhớ) thì 0. */
  countForeignRecords(uid: string): Promise<number>;
  /** Xem `wipeLocalDatabase`. Không có SQLite thì không làm gì (kho bộ nhớ mất khi tắt app). */
  wipeDatabase(): Promise<void>;
}

export function createLocalDeviceData(open: () => Promise<SqlDatabase | null>): LocalDeviceData {
  return {
    async countForeignRecords(uid) {
      const db = await open();
      return db ? countForeignRecords(db, uid) : 0;
    },
    async wipeDatabase() {
      const db = await open();
      if (db) await wipeLocalDatabase(db);
    },
  };
}
