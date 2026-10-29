import { ORDER_DB_MIGRATIONS as MIGRATIONS } from '@/features/orders';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runDisputeStoreContract, makeNewDispute } from './dispute-store.contract';
import { createSqliteDisputeStore } from './sqlite-dispute-store';

runDisputeStoreContract('SQLite (node:sqlite)', async () =>
  createSqliteDisputeStore(createNodeSqliteDatabase()),
);

describe('kho SQLite tranh chấp: schema và người tạo', () => {
  it('migration v9 thêm bảng trên DB đã ở v8, không mất dữ liệu cũ', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 8)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 8');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 's', 'C1', 'C1', 'shopee', 'entered_by_user', 1)`,
    );
    const store = createSqliteDisputeStore(db);
    await store.listDisputes('s' as never);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    expect(await db.getAllAsync('SELECT id FROM orders')).toHaveLength(1);
  });

  it('gắn uid người tạo (đọc mỗi lần lưu)', async () => {
    let uid: string | null = 'user-a';
    const store = createSqliteDisputeStore(createNodeSqliteDatabase(), { creatorUid: () => uid });
    const first = await store.createDispute(makeNewDispute());
    uid = null;
    const second = await store.createDispute(makeNewDispute());
    expect(first.dispute.createdBy).toBe('user-a');
    expect(first.events[0]?.by).toBe('user-a');
    expect(second.dispute.createdBy).toBeUndefined();
  });

  it('lỗi giữa giao dịch không để lại sự kiện dở dang', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteDisputeStore(db);
    const first = await store.createDispute(makeNewDispute());
    await expect(
      store.createDispute(makeNewDispute({ id: first.dispute.id })),
    ).rejects.toMatchObject({ code: 'DISPUTE_SAVE_FAILED' });
    expect(await db.getAllAsync('SELECT id FROM dispute_events')).toHaveLength(1);
    const next = await store.createDispute(makeNewDispute());
    expect(next.dispute.seq).toBe(2);
  });
});
