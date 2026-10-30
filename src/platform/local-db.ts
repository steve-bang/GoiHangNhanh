import { defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';

import { excludeFromBackup } from './backup-exclusion';
import { applyConnectionSettings, type SqlDatabase } from './sql-database';

const DATABASE_NAME = 'doncung.db';

/**
 * Mở cơ sở dữ liệu cục bộ (expo-sqlite, ADR-017). Bật khóa ngoại tường minh (xem `applyConnectionSettings`). Chưa kiểm chứng trên iOS/Android thật. Bản web
 * (`local-db.web.ts`) trả `null` để dùng kho bộ nhớ: expo-sqlite trên web còn thử nghiệm.
 */
let shared: Promise<SqlDatabase | null> | null = null;

/**
 * MỘT kết nối dùng chung cho cả app: kho đơn và kho tệp bằng chứng cùng hàng đợi giao dịch trên đúng
 * kết nối này (`runSerialized`); hai kết nối tới cùng tệp sẽ tranh khóa. Mở lỗi thì lần sau thử lại.
 */
export function openLocalDatabase(): Promise<SqlDatabase | null> {
  shared ??= openOnce().catch((error: unknown) => {
    shared = null;
    throw error;
  });
  return shared;
}

async function openOnce(): Promise<SqlDatabase | null> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  const sql: SqlDatabase = {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params = []) => {
      await db.runAsync(sql, [...params]);
    },
    getAllAsync: <T>(sql: string, params: readonly (string | number | null)[] = []) =>
      db.getAllAsync<T>(sql, [...params]),
    getFirstAsync: <T>(sql: string, params: readonly (string | number | null)[] = []) =>
      db.getFirstAsync<T>(sql, [...params]),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
  await applyConnectionSettings(sql);
  // V1-12 (Q-24d A): thư mục CSDL (gồm tệp -wal/-shm) không vào iCloud Backup. Thư mục chỉ chắc có sau
  // khi mở; không chờ, lỗi không chặn mở CSDL (adapter tự log, không ném). Một lần mỗi tiến trình.
  if (typeof defaultDatabaseDirectory === 'string' && defaultDatabaseDirectory.length > 0) {
    excludeFromBackup('database', defaultDatabaseDirectory).catch(() => undefined);
  }
  return sql;
}
