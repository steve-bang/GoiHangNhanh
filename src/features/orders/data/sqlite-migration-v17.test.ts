import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { MIGRATIONS } from './sqlite-migrations';
import { migrateLocalDatabase } from './sqlite-order-store';

/** G-4: v17 chỉ thêm cột nhịp tim `last_alive_at_device` (nullable) vào `evidence_files`. */
describe('migration v17 (nhịp tim phiên quay)', () => {
  it('v16 -> v17: dữ liệu cũ nguyên vẹn, cột mới NULL; chạy lại không đổi gì', async () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(17);
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 16)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 16');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 'shop-a', 'DH-1', 'DH-1', 'shopee', 'entered_by_user', 1)`,
    );
    await db.runAsync(
      "INSERT INTO packages (id, order_id, idx, created_at_device) VALUES ('p1', 'o1', 1, 1)",
    );
    await db.runAsync(
      `INSERT INTO packing_sessions (id, shop_id, order_id, package_id, started_at_device, snapshot_json,
         session_status) VALUES ('s1', 'shop-a', 'o1', 'p1', 5, '{}', 'recording')`,
    );
    await db.runAsync(
      `INSERT INTO evidence_files (id, shop_id, order_id, package_id, session_id, file_group, kind, state,
         created_at_device, updated_at_device)
       VALUES ('e1', 'shop-a', 'o1', 'p1', 's1', 'pack', 'video', 'recording', 6, 6)`,
    );
    const snapshot = () =>
      db.getAllAsync(
        'SELECT id, state, local_path, size_bytes, sha256_client, created_at_device, updated_at_device FROM evidence_files',
      );
    const before = await snapshot();

    await migrateLocalDatabase(db);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    expect(await snapshot()).toEqual(before);
    expect(await db.getAllAsync('SELECT last_alive_at_device FROM evidence_files')).toEqual([
      { last_alive_at_device: null },
    ]);

    await migrateLocalDatabase(db);
    expect(await snapshot()).toEqual(before);
  });
});
