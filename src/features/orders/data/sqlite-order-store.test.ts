import { AppError } from '@/core/errors/app-error';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import type { SessionId } from '@/core/ids';
import { buildPackingSession } from '../domain/start-session';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runOrderStoreContract, makeOrder } from './order-store.contract';
import { runPendingRemoteContract } from './pending-remote.contract';
import { MIGRATIONS } from './sqlite-migrations';
import { createSqliteOrderStore, parseSnapshot } from './sqlite-order-store';

// Chạy hợp đồng trên SQLite THẬT của Node (không phải expo-sqlite trên thiết bị).
runOrderStoreContract('SQLite (node:sqlite)', async () =>
  createSqliteOrderStore(createNodeSqliteDatabase()),
);

runPendingRemoteContract('SQLite (node:sqlite)', async () => {
  let uid: string | null = 'user-a';
  return {
    store: createSqliteOrderStore(createNodeSqliteDatabase(), { creatorUid: () => uid }),
    setUid: (value) => void (uid = value),
  };
});

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
      expect.arrayContaining([
        'orders',
        'order_lines',
        'packages',
        'packing_sessions',
        'search_history',
      ]),
    );
  });

  it('nâng cấp từ v4 lên v5: thêm cột created_by, dữ liệu cũ giữ nguyên, không người tạo và không bao giờ được đăng', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 4)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 4');
    const details = makeOrder('V4', { lines: [{ name: 'Áo' }] });
    const o = details.order;
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, tracking_code,
        tracking_code_key, data_origin, created_at_device) VALUES (?, ?, 'V4', 'V4', ?, NULL, NULL, 'entered_by_user', 1)`,
      [o.id, o.shopId, o.source],
    );
    await db.runAsync(
      'INSERT INTO packages (id, order_id, idx, created_at_device) VALUES (?, ?, 1, 1)',
      [pkg.id, o.id],
    );
    const store = createSqliteOrderStore(db, { creatorUid: () => 'u1' });
    const before = await store.getOrder(o.shopId, o.id);
    expect(before?.order.orderCode).toBe('V4');
    expect(before?.order).not.toHaveProperty('createdBy');
    for (const table of ['orders', 'packages', 'packing_sessions']) {
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(cols.map((c) => c.name)).toContain('created_by');
    }
    expect(
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version,
    ).toBe(MIGRATIONS.length);
    expect(await store.listOrdersPendingRemote(o.shopId, 10, 'u1')).toEqual([]);
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

describe('kho SQLite: nâng cấp từ v1 lên v2 (lịch sử tìm)', () => {
  it('giữ nguyên dữ liệu đơn của v1 và thêm bảng search_history', async () => {
    const db = createNodeSqliteDatabase();
    // dựng đúng DB của người dùng đang ở v1: chỉ chạy migration đầu tiên rồi ghi một đơn
    await db.execAsync(MIGRATIONS[0] as string);
    await db.execAsync('PRAGMA user_version = 1');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, tracking_code,
         tracking_code_key, data_origin, created_at_device)
       VALUES ('o1', 'shop-local', 'CU-1', 'CU-1', 'shopee', NULL, NULL, 'user_entered', 5)`,
    );
    const store = createSqliteOrderStore(db);
    expect(await store.countOrders('shop-local' as never, {})).toBe(1);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    await store.recordSearch('shop-local' as never, 'CU-1', 9);
    expect(await store.listRecentSearches('shop-local' as never, 5)).toHaveLength(1);
  });
});

describe('kho SQLite: trạng thái phiên lạ trong dữ liệu', () => {
  it('phiên có trạng thái không phải created không được coi là đang thực hiện ở danh sách', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteOrderStore(db);
    const details = makeOrder('ST', { lines: [{ name: 'Áo' }] });
    await store.saveNewOrder(details);
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(details, pkg.id, {
      sessionId: 'sess-st' as SessionId,
      nowDevice: 5000,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    const page = { limit: 10 };
    const before = await store.listOrders(LOCAL_SHOP_ID, {}, page);
    expect(before.items[0]?.activeSession).toMatchObject({ id: 'sess-st' });
    // Ghi thẳng trạng thái chưa có trong domain: bắt được nếu điều kiện lọc bị đảo hoặc bỏ.
    await db.runAsync("UPDATE packing_sessions SET session_status = 'finished'");
    const after = await store.listOrders(LOCAL_SHOP_ID, {}, page);
    expect(after.items[0]?.activeSession).toBeNull();
  });
});
