import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { createLocalOrderStore } from './create-order-store';
import { makeOrder } from './order-store.contract';

describe('createLocalOrderStore', () => {
  it('open trả null (web) thì dùng kho bộ nhớ và vẫn lưu/đọc được', async () => {
    const store = createLocalOrderStore(async () => null);
    const d = makeOrder('W');
    await store.saveNewOrder(d);
    expect(await store.getOrder(d.order.id)).toEqual(d);
  });

  it('mở SQLite lỗi thì báo LOCAL_SAVE_UNAVAILABLE, KHÔNG lặng lẽ chuyển sang bộ nhớ; lần sau thử lại', async () => {
    let calls = 0;
    const db = createNodeSqliteDatabase();
    const store = createLocalOrderStore(async () => {
      calls += 1;
      if (calls === 1) throw new Error('disk');
      return db;
    });
    const d = makeOrder('F');
    await expect(store.saveNewOrder(d)).rejects.toMatchObject({ code: 'LOCAL_SAVE_UNAVAILABLE' });
    await store.saveNewOrder(d);
    expect(calls).toBe(2);
    expect(await db.getAllAsync('SELECT id FROM orders')).toHaveLength(1);
  });
});
