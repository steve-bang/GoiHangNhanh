import type * as NodeSqlite from 'node:sqlite';

import type { SqlDatabase, SqlParam } from '@/platform';

/**
 * Bọc SQLite THẬT của Node (`node:sqlite`, Node >= 22.13) thành `SqlDatabase` để test câu lệnh SQL và
 * migration của kho cục bộ trong Jest. Đây KHÔNG phải expo-sqlite trên iOS/Android: không chứng
 * minh chạy được trên thiết bị (phiên bản SQLite có thể khác).
 */
export function createNodeSqliteDatabase(): SqlDatabase & { close: () => void } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mô-đun chỉ có trong Node
  const { DatabaseSync } = require('node:sqlite') as typeof NodeSqlite;
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const bind = (params: readonly SqlParam[] | undefined) => [...(params ?? [])];
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      db.prepare(sql).run(...bind(params));
    },
    async getAllAsync<T>(sql: string, params?: readonly SqlParam[]) {
      return db.prepare(sql).all(...bind(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, params?: readonly SqlParam[]) {
      return (db.prepare(sql).get(...bind(params)) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
