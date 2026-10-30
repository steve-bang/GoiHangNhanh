import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { MIGRATIONS } from './sqlite-migrations';
import { migrateLocalDatabase } from './sqlite-order-store';

/** V1-09: v15 chỉ thêm bảng `device_settings`; dữ liệu có sẵn ở v14 giữ nguyên. */
describe('migration v15 (device_settings)', () => {
  it('v14 -> v15: thêm bảng, dữ liệu cũ nguyên vẹn; chạy lại không đổi gì', async () => {
    expect(MIGRATIONS).toHaveLength(15);
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 14)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 14');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 'shop-a', 'DH-1', 'DH-1', 'shopee', 'entered_by_user', 1)`,
    );
    const before = await db.getAllAsync('SELECT * FROM orders');

    await migrateLocalDatabase(db);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(15);
    expect(await db.getAllAsync('SELECT * FROM orders')).toEqual(before);
    const columns = await db.getAllAsync<{ name: string; notnull: number; pk: number }>(
      'PRAGMA table_info(device_settings)',
    );
    expect(columns.map((c) => [c.name, c.notnull, c.pk])).toEqual([
      ['key', 1, 1],
      ['value', 1, 0],
      ['updated_at_device', 1, 0],
    ]);
    expect(await db.getAllAsync('SELECT * FROM device_settings')).toEqual([]);

    await db.runAsync(
      "INSERT INTO device_settings (key, value, updated_at_device) VALUES ('k', 'true', 1)",
    );
    await migrateLocalDatabase(db);
    expect(await db.getAllAsync('SELECT key, value FROM device_settings')).toEqual([
      { key: 'k', value: 'true' },
    ]);
  });
});
