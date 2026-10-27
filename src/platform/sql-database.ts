/**
 * Giao diện tối thiểu của cơ sở dữ liệu SQL cục bộ mà lớp `data/` cần. `expo-sqlite` (native) thỏa
 * mãn qua `local-db.ts`; test dùng SQLite thật của Node qua `src/test-utils/node-sqlite.ts`.
 */
export type SqlParam = string | number | null;

export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: readonly SqlParam[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
  /** Chạy `task` trong một giao dịch: lỗi thì hoàn tác toàn bộ. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
