import { ORDER_DB_MIGRATIONS as MIGRATIONS } from '@/features/orders';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runReturnStoreContract, makeNewReturn } from './return-store.contract';
import { createSqliteReturnStore } from './sqlite-return-store';

// Chạy hợp đồng trên SQLite THẬT của Node (không phải expo-sqlite trên thiết bị).
runReturnStoreContract('SQLite (node:sqlite)', async () =>
  createSqliteReturnStore(createNodeSqliteDatabase()),
);

describe('kho SQLite hàng hoàn: schema và người tạo', () => {
  it('migration v8 thêm bảng hồ sơ hàng hoàn trên DB đã ở v7, không mất dữ liệu cũ', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 7)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 7');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 's', 'C1', 'C1', 'shopee', 'entered_by_user', 1)`,
    );
    const store = createSqliteReturnStore(db);
    await store.listReturns('s' as never, 1);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    const orders = await db.getAllAsync<{ id: string }>('SELECT id FROM orders');
    expect(orders).toHaveLength(1);
  });

  it('gắn uid người tạo khi biết ai đăng nhập (kho đọc uid mỗi lần lưu)', async () => {
    let uid: string | null = 'user-a';
    const store = createSqliteReturnStore(createNodeSqliteDatabase(), { creatorUid: () => uid });
    const first = await store.createReturn(makeNewReturn());
    uid = 'user-b';
    const second = await store.createReturn(makeNewReturn());
    uid = null;
    const third = await store.createReturn(makeNewReturn());
    expect(first.returnCase.createdBy).toBe('user-a');
    expect(first.events[0]?.by).toBe('user-a');
    expect(second.returnCase.createdBy).toBe('user-b');
    expect(third.returnCase.createdBy).toBeUndefined();
  });

  it('lỗi cơ sở dữ liệu đổi thành RETURN_SAVE_FAILED và không ghi dở (giao dịch)', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteReturnStore(db);
    const first = await store.createReturn(makeNewReturn());
    // ID trùng làm INSERT lỗi giữa giao dịch: không được để lại sự kiện/số thứ tự dở dang.
    const duplicate = makeNewReturn({ id: first.returnCase.id });
    await expect(store.createReturn(duplicate)).rejects.toMatchObject({
      code: 'RETURN_SAVE_FAILED',
    });
    const events = await db.getAllAsync<{ id: string }>('SELECT id FROM return_events');
    expect(events).toHaveLength(1);
    const next = await store.createReturn(makeNewReturn());
    expect(next.returnCase.seq).toBe(2);
  });
});
