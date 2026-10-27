import { openDatabaseAsync } from 'expo-sqlite';

import { applyConnectionSettings, type SqlDatabase } from './sql-database';

const DATABASE_NAME = 'doncung.db';

/**
 * Mở cơ sở dữ liệu cục bộ (expo-sqlite, ADR-017). Bật khóa ngoại tường minh (xem `applyConnectionSettings`). Chưa kiểm chứng trên iOS/Android thật. Bản web
 * (`local-db.web.ts`) trả `null` để dùng kho bộ nhớ: expo-sqlite trên web còn thử nghiệm.
 */
export async function openLocalDatabase(): Promise<SqlDatabase | null> {
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
  return sql;
}
