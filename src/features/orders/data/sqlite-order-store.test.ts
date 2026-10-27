import { AppError } from '@/core/errors/app-error';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runOrderStoreContract, makeOrder } from './order-store.contract';
import { MIGRATIONS } from './sqlite-migrations';
import { createSqliteOrderStore, parseSnapshot } from './sqlite-order-store';

// Chạy hợp đồng trên SQLite THẬT của Node (không phải expo-sqlite trên thiết bị).
runOrderStoreContract('SQLite (node:sqlite)', async () =>
  createSqliteOrderStore(createNodeSqliteDatabase()),
);

describe('kho SQLite: migration và lỗi', () => {
  it('tạo schema ở lần dùng đầu, đặt user_version, và chạy lại không lỗi', async () => {
    const db = createNodeSqliteDatabase();
    const first = createSqliteOrderStore(db);
    await first.getOrder(LOCAL_SHOP_ID, 'x' as never);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    // một kho khác trên cùng db: không chạy lại migration (CREATE TABLE sẽ lỗi nếu chạy lại)
    const second = createSqliteOrderStore(db);
    await expect(second.getOrder(LOCAL_SHOP_ID, 'x' as never)).resolves.toBeNull();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['orders', 'order_lines', 'packages', 'packing_sessions']),
    );
  });

  it('lưu đơn là một giao dịch: một dòng lỗi thì không còn bản ghi nào', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteOrderStore(db);
    const details = makeOrder('TX', { lines: [{ name: 'Áo' }] });
    const line = details.lines[0];
    if (!line) throw new Error('fixture');
    const broken = { ...details, lines: [line, { ...line, quantity: 0 }] };
    await expect(store.saveNewOrder(broken)).rejects.toBeInstanceOf(AppError);
    expect(await db.getAllAsync('SELECT * FROM orders')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM order_lines')).toEqual([]);
  });

  it('lỗi cơ sở dữ liệu đổi thành mã lỗi riêng: ORDER_SAVE_FAILED cho đơn, LOCAL_SAVE_UNAVAILABLE cho phiên', async () => {
    const db = createNodeSqliteDatabase();
    db.close();
    const store = createSqliteOrderStore(db);
    await expect(store.getOrder(LOCAL_SHOP_ID, 'x' as never)).rejects.toMatchObject({
      code: 'ORDER_SAVE_FAILED',
    });
    await expect(store.getSession(LOCAL_SHOP_ID, 'x' as never)).rejects.toMatchObject({
      code: 'LOCAL_SAVE_UNAVAILABLE',
    });
  });

  it('khóa ngoại BẬT trên kết nối (SQLite mặc định tắt): bản ghi mồ côi bị từ chối ở tầng cơ sở dữ liệu', async () => {
    const db = createNodeSqliteDatabase();
    // trước khi kho khởi tạo: kết nối giống expo-sqlite, khóa ngoại tắt
    expect(
      (await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys,
    ).toBe(0);
    const store = createSqliteOrderStore(db);
    await store.getOrder(LOCAL_SHOP_ID, 'x' as never); // kích hoạt migrate + cài đặt kết nối
    expect(
      (await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys,
    ).toBe(1);
    await expect(
      db.runAsync(
        'INSERT INTO packages (id, order_id, idx, created_at_device) VALUES (?, ?, ?, ?)',
        ['p', 'khong-co', 1, 1],
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('các thao tác đồng thời được xếp hàng: hai lần lưu cùng lúc không chen vào giao dịch của nhau', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteOrderStore(db);
    const results = await Promise.allSettled(
      ['A', 'B', 'C'].map((code) =>
        store.saveNewOrder(makeOrder(code, { lines: [{ name: 'Áo' }, { name: 'Quần' }] })),
      ),
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await db.getAllAsync('SELECT * FROM orders')).toHaveLength(3);
    expect(await db.getAllAsync('SELECT * FROM order_lines')).toHaveLength(6);
  });

  it('parseSnapshot từ chối dữ liệu hỏng', () => {
    expect(() => parseSnapshot('{"orderCode":1}')).toThrow();
    expect(() => parseSnapshot('null')).toThrow();
  });
});
