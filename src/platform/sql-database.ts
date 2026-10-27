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

/**
 * Cài đặt theo TỪNG KẾT NỐI, phải chạy ngay sau khi mở cơ sở dữ liệu và ngoài mọi giao dịch. SQLite
 * mặc định TẮT khóa ngoại và expo-sqlite không tự bật (tài liệu mẫu của chính expo-sqlite đặt
 * `PRAGMA foreign_keys = ON` trong bước khởi tạo), nên bật tường minh để schema `REFERENCES` có hiệu
 * lực trên máy thật giống trong test. Idempotent. Kho đơn gọi lại ở bước migrate để mọi đường khởi
 * tạo (thiết bị, test) dùng chung.
 */
export async function applyConnectionSettings(db: SqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
}
