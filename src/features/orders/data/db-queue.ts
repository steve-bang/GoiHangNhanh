import type { SqlDatabase } from '@/platform/sql-database';

const tails = new WeakMap<SqlDatabase, Promise<unknown>>();

/**
 * Xếp mọi thao tác trên CÙNG một kết nối vào một hàng đợi nối đuôi, dù do kho đơn hay kho tệp bằng
 * chứng phát ra: hai giao dịch chồng nhau trên một kết nối sẽ lỗi ("cannot start a transaction
 * within a transaction"). Một thao tác lỗi không làm hỏng hàng đợi.
 */
export function runSerialized<T>(db: SqlDatabase, task: () => Promise<T>): Promise<T> {
  const run = (tails.get(db) ?? Promise.resolve()).then(task);
  tails.set(
    db,
    run.catch(() => undefined),
  );
  return run;
}
