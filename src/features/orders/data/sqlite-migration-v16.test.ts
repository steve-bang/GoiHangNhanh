import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { MIGRATIONS } from './sqlite-migrations';
import { migrateLocalDatabase } from './sqlite-order-store';

/**
 * V1-13: v16 chỉ thêm cột (dấu tệp đã băm ở `evidence_files`/`return_media`, cờ gián đoạn của
 * `return_media`) và hai index; dữ liệu có sẵn ở v15 giữ nguyên.
 */
describe('migration v16 (dấu tệp đã băm, cờ gián đoạn, index)', () => {
  it('v15 -> v16: dữ liệu cũ nguyên vẹn, cột mới mặc định, index có; chạy lại không đổi gì', async () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(16);
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 15)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 15');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 'shop-a', 'DH-1', 'DH-1', 'shopee', 'entered_by_user', 1)`,
    );
    await db.runAsync(
      "INSERT INTO packages (id, order_id, idx, created_at_device) VALUES ('p1', 'o1', 1, 1)",
    );
    await db.runAsync(
      `INSERT INTO packing_sessions (id, shop_id, order_id, package_id, started_at_device, snapshot_json,
         session_status) VALUES ('s1', 'shop-a', 'o1', 'p1', 5, '{}', 'ended')`,
    );
    await db.runAsync(
      `INSERT INTO evidence_files (id, shop_id, order_id, package_id, session_id, file_group, kind, state,
         local_path, size_bytes, sha256_client, created_at_device, updated_at_device)
       VALUES ('e1', 'shop-a', 'o1', 'p1', 's1', 'pack', 'video', 'queued', 'evidence/e1.mp4', 10, ?, 6, 6)`,
      ['a'.repeat(64)],
    );
    await db.runAsync(
      `INSERT INTO return_cases (id, shop_id, seq, code, status, created_at_device, updated_at_device)
       VALUES ('r1', 'shop-a', 1, 'RH-00001', 'opening', 1, 1)`,
    );
    await db.runAsync(
      `INSERT INTO return_media (id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client,
         created_at_device, updated_at_device)
       VALUES ('m1', 'r1', 'shop-a', 'video', 'local_save_failed', 'tmp/v.mp4', NULL, NULL, 2, 2)`,
    );
    const snapshot = async () => ({
      orders: await db.getAllAsync('SELECT * FROM orders'),
      sessions: await db.getAllAsync('SELECT * FROM packing_sessions'),
      files: await db.getAllAsync(
        'SELECT id, state, local_path, size_bytes, sha256_client, attempt_count FROM evidence_files',
      ),
      media: await db.getAllAsync(
        'SELECT id, kind, state, local_path, attempt_count, last_error_code FROM return_media',
      ),
    });
    const before = await snapshot();

    await migrateLocalDatabase(db);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    expect(await snapshot()).toEqual(before);

    expect(
      await db.getAllAsync('SELECT hashed_size_bytes, hashed_mtime_device FROM evidence_files'),
    ).toEqual([{ hashed_size_bytes: null, hashed_mtime_device: null }]);
    expect(
      await db.getAllAsync(
        'SELECT hashed_size_bytes, hashed_mtime_device, interrupted FROM return_media',
      ),
    ).toEqual([{ hashed_size_bytes: null, hashed_mtime_device: null, interrupted: 0 }]);
    // Cờ chỉ nhận 0/1.
    await expect(
      db.runAsync("UPDATE return_media SET interrupted = 2 WHERE id = 'm1'"),
    ).rejects.toThrow();

    const indexes = (
      await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_sessions_shop_started', 'idx_return_media_shop_state') ORDER BY name",
      )
    ).map((r) => r.name);
    expect(indexes).toEqual(['idx_return_media_shop_state', 'idx_sessions_shop_started']);
    const indexColumns = async (name: string) =>
      (await db.getAllAsync<{ name: string }>(`PRAGMA index_info(${name})`)).map((c) => c.name);
    expect(await indexColumns('idx_sessions_shop_started')).toEqual([
      'shop_id',
      'started_at_device',
    ]);
    expect(await indexColumns('idx_return_media_shop_state')).toEqual(['shop_id', 'state']);

    await migrateLocalDatabase(db);
    expect(await snapshot()).toEqual(before);
  });
});
