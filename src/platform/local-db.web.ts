import type { SqlDatabase } from './sql-database';

/** Web: không dùng SQLite (chỉ để xem trước/chụp ảnh giao diện); kho bộ nhớ thay thế. */
export async function openLocalDatabase(): Promise<SqlDatabase | null> {
  return null;
}
