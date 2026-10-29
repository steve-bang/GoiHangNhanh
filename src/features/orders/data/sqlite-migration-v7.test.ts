import type { OrderListCursor, OrderListQuery } from '../domain/order-list';
import type { SessionId } from '@/core/ids';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';
import type { SqlDatabase } from '@/platform/sql-database';

import { makeOrder } from './order-store.contract';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { buildPackingSession } from '../domain/start-session';
import { MIGRATIONS } from './sqlite-migrations';
import { createSqliteOrderStore, listConditions } from './sqlite-order-store';

const SHOP = 'shop-a' as never;
const OTHER = 'shop-b' as never;

async function dbAtV6(): Promise<SqlDatabase & { close: () => void }> {
  const db = createNodeSqliteDatabase();
  for (const sql of MIGRATIONS.slice(0, 6)) await db.execAsync(sql);
  await db.execAsync('PRAGMA user_version = 6');
  return db;
}

/** Dữ liệu tất định có nhiều đơn trùng mốc (kiểm keyset theo id), phiên, video/ảnh, hai shop. */
async function seed(db: SqlDatabase, count: number): Promise<void> {
  await db.execAsync('BEGIN');
  for (let i = 0; i < count; i += 1) {
    const shop = i % 7 === 0 ? OTHER : SHOP;
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES (?, ?, ?, ?, ?, 'entered_by_user', ?)`,
      [`o${i}`, shop, `C${i}`, `C${i}`, i % 3 === 0 ? 'tiktok_shop' : 'shopee', 1000 + (i % 40)],
    );
    await db.runAsync(
      'INSERT INTO packages (id, order_id, idx, created_at_device) VALUES (?, ?, 1, 1)',
      [`p${i}`, `o${i}`],
    );
    if (i % 2 === 0) {
      // một đến hai phiên; mốc lặp lại để có đơn trùng last_activity
      const sessionCount = i % 4 === 0 ? 2 : 1;
      for (let k = 0; k < sessionCount; k += 1) {
        await db.runAsync(
          `INSERT INTO packing_sessions (id, shop_id, order_id, package_id, started_at_device,
             snapshot_json, session_status) VALUES (?, ?, ?, ?, ?, '{}', 'completed')`,
          [`s${i}-${k}`, shop, `o${i}`, `p${i}`, 900 + ((i * 7 + k * 50) % 200)],
        );
      }
      if (i % 3 !== 0) {
        await db.runAsync(
          `INSERT INTO evidence_files (id, shop_id, order_id, package_id, session_id, file_group,
             kind, state, created_at_device, updated_at_device)
           VALUES (?, ?, ?, ?, ?, 'pack', ?, 'recording', 1, 1)`,
          [`e${i}`, shop, `o${i}`, `p${i}`, `s${i}-0`, i % 5 === 0 ? 'photo' : 'video'],
        );
      }
    }
    if (i % 4 === 1) {
      await db.runAsync(
        `INSERT INTO order_lines (id, order_id, name, quantity, position, data_origin, created_at_device)
         VALUES (?, ?, 'Áo', 1, 0, 'entered_by_user', 1)`,
        [`l${i}`, `o${i}`],
      );
    }
  }
  await db.execAsync('COMMIT');
}

interface Row {
  id: string;
  last: number;
}

/** Truy vấn danh sách CŨ (v6, trước PR3), dùng làm chuẩn so sánh kết quả. */
async function legacyList(
  db: SqlDatabase,
  shopId: string,
  query: OrderListQuery,
  after: OrderListCursor | undefined,
  limit: number,
): Promise<Row[]> {
  const { where, params } = listConditions(shopId as never, query);
  const cursor = after ? 'WHERE (last_activity < ? OR (last_activity = ? AND id < ?))' : '';
  const cursorParams = after
    ? [after.lastActivityDevice, after.lastActivityDevice, after.orderId]
    : [];
  const rows = await db.getAllAsync<{ id: string; last_activity: number }>(
    `SELECT * FROM (
       SELECT o.id, MAX(o.created_at_device, COALESCE(s.last_session, 0)) AS last_activity
       FROM orders o
       LEFT JOIN (
         SELECT order_id, MAX(started_at_device) AS last_session
         FROM packing_sessions WHERE shop_id = ? GROUP BY order_id
       ) s ON s.order_id = o.id
       WHERE ${where}
     ) ${cursor}
     ORDER BY last_activity DESC, id DESC LIMIT ?`,
    [shopId, ...params, ...cursorParams, limit],
  );
  return rows.map((r) => ({ id: r.id, last: r.last_activity }));
}

async function legacyAllPages(
  db: SqlDatabase,
  shop: string,
  query: OrderListQuery,
  limit: number,
): Promise<Row[]> {
  const rows: Row[] = [];
  let after: OrderListCursor | undefined;
  for (;;) {
    const batch = await legacyList(db, shop, query, after, limit + 1);
    rows.push(...batch.slice(0, limit));
    const lastRow = batch[limit - 1];
    if (batch.length <= limit || !lastRow) return rows;
    after = { lastActivityDevice: lastRow.last, orderId: lastRow.id } as OrderListCursor;
  }
}

async function allPages(
  store: ReturnType<typeof createSqliteOrderStore>,
  shopId: string,
  query: OrderListQuery,
  limit: number,
): Promise<Row[]> {
  const out: Row[] = [];
  let after: OrderListCursor | undefined;
  for (;;) {
    const page = await store.listOrders(
      shopId as never,
      query,
      after ? { limit, after } : { limit },
    );
    out.push(...page.items.map((i) => ({ id: i.order.id as string, last: i.lastActivityDevice })));
    if (!page.nextCursor) return out;
    after = page.nextCursor;
  }
}

describe('migration v7: index và last_activity_device', () => {
  it('v6 -> v7 giữ nguyên dữ liệu, backfill đúng mốc hoạt động, tạo đủ index', async () => {
    const db = await dbAtV6();
    await seed(db, 120);
    const ordersBefore = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM orders ORDER BY id',
    );
    const tables = ['order_lines', 'packages', 'packing_sessions', 'evidence_files'];
    const countRows = () =>
      Promise.all(
        tables.map((t) => db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)),
      );
    const countsBefore = await countRows();
    await createSqliteOrderStore(db).countOrders(SHOP, {}); // kích hoạt migration

    expect(
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version,
    ).toBe(MIGRATIONS.length);
    const ordersAfter = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM orders ORDER BY id',
    );
    expect(ordersAfter).toHaveLength(ordersBefore.length);
    for (const [i, before] of ordersBefore.entries()) {
      const rest = { ...ordersAfter[i] };
      delete rest.last_activity_device;
      expect(rest).toEqual(before);
    }
    expect(await countRows()).toEqual(countsBefore);

    const wrong = await db.getAllAsync(
      `SELECT o.id FROM orders o WHERE o.last_activity_device != MAX(o.created_at_device,
         COALESCE((SELECT MAX(s.started_at_device) FROM packing_sessions s WHERE s.order_id = o.id), 0))`,
    );
    expect(wrong).toEqual([]);
    const indexes = (
      await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")
    ).map((r) => r.name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_evidence_files_order_kind',
        'idx_sessions_shop_order',
        'idx_orders_shop_activity',
      ]),
    );
  });

  it('chạy lại không lỗi và v7 an toàn với repairLegacySchema (v3 cũ thiếu cột)', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 3)) await db.execAsync(sql);
    for (const col of ['attempt_count', 'next_attempt_at_device', 'last_error_code']) {
      await db.execAsync(`ALTER TABLE evidence_files DROP COLUMN ${col}`);
    }
    await db.execAsync('PRAGMA user_version = 3');
    await createSqliteOrderStore(db).countOrders(SHOP, {});
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(evidence_files)')).map(
      (c) => c.name,
    );
    expect(cols).toEqual(expect.arrayContaining(['attempt_count', 'last_error_code']));
    expect(
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version,
    ).toBe(MIGRATIONS.length);
    await expect(createSqliteOrderStore(db).countOrders(SHOP, {})).resolves.toBe(0);
  });

  it('kết quả danh sách (mọi trang, mọi bộ lọc) giống hệt truy vấn cũ trước migration', async () => {
    const db = await dbAtV6();
    await seed(db, 400);
    const queries: OrderListQuery[] = [
      {},
      { withoutVideo: true },
      { source: 'tiktok_shop' },
      { declaration: 'declared' },
      { declaration: 'undeclared', withoutVideo: true },
      { createdSinceDevice: 1020 },
      { searchKey: 'C1' },
    ];
    // Chuẩn: truy vấn cũ chạy trên chính DB v6 (trước migration), duyệt keyset từng trang.
    const expected = new Map<string, Row[]>();
    for (const shop of [SHOP, OTHER] as string[]) {
      for (const q of queries) {
        expected.set(`${shop}|${JSON.stringify(q)}`, await legacyAllPages(db, shop, q, 7));
      }
    }
    const store = createSqliteOrderStore(db);
    for (const shop of [SHOP, OTHER] as string[]) {
      for (const q of queries) {
        const got = await allPages(store, shop, q, 7);
        const want = expected.get(`${shop}|${JSON.stringify(q)}`) ?? [];
        expect(want.length).toBeGreaterThan(0);
        expect(got).toEqual(want);
        expect(await store.countOrders(shop as never, q)).toBe(want.length);
      }
    }
  });

  it('withoutVideo: ảnh/không bằng chứng tính là chưa có video; video mọi trạng thái là có video', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteOrderStore(db);
    const names = ['none', 'photo', 'video'] as const;
    for (const [i, name] of names.entries()) {
      const d = makeOrder(name, { at: 100 + i });
      await store.saveNewOrder(d);
      const pkg = d.packages[0];
      if (!pkg) throw new Error('fixture');
      if (name === 'none') continue;
      const built = buildPackingSession(d, pkg.id, {
        sessionId: `sess-${name}` as SessionId,
        nowDevice: 500 + i,
      });
      if (!built.ok) throw new Error('fixture');
      await store.saveSession(built.session);
      await db.runAsync(
        `INSERT INTO evidence_files (id, shop_id, order_id, package_id, session_id, file_group,
           kind, state, created_at_device, updated_at_device)
         VALUES (?, ?, ?, ?, ?, 'pack', ?, 'failed', 1, 1)`,
        [`ev-${name}`, d.order.shopId, d.order.id, pkg.id, `sess-${name}`, name],
      );
    }
    const page = await store.listOrders(LOCAL_SHOP_ID, { withoutVideo: true }, { limit: 10 });
    expect(page.items.map((i) => i.order.orderCode).sort()).toEqual(['none', 'photo']);
    expect(await store.countOrders(LOCAL_SHOP_ID, { withoutVideo: true })).toBe(2);
  });

  it('tạo phiên nâng mốc hoạt động của đúng đơn, không bao giờ hạ xuống', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteOrderStore(db);
    const a = makeOrder('A', { at: 100 });
    const b = makeOrder('B', { at: 200 });
    await store.saveNewOrder(a);
    await store.saveNewOrder(b);
    const pkgA = a.packages[0];
    if (!pkgA) throw new Error('fixture');
    const build = (id: string, at: number) => {
      const r = buildPackingSession(a, pkgA.id, { sessionId: id as SessionId, nowDevice: at });
      if (!r.ok) throw new Error('fixture');
      return r.session;
    };
    const first = build('s1', 900);
    await store.saveSession(first);
    await store.updateSessionStatus(LOCAL_SHOP_ID, first.id, 'recording');
    await store.updateSessionStatus(LOCAL_SHOP_ID, first.id, 'ended');
    await store.saveSession(build('s0', 300)); // mốc cũ hơn (thiết bị đổi giờ): không được hạ
    const read = async (id: string) =>
      (
        await db.getFirstAsync<{ last_activity_device: number }>(
          'SELECT last_activity_device FROM orders WHERE id = ?',
          [id],
        )
      )?.last_activity_device;
    expect(await read(a.order.id)).toBe(900);
    expect(await read(b.order.id)).toBe(200);
    const page = await store.listOrders(LOCAL_SHOP_ID, {}, { limit: 5 });
    expect(page.items.map((i) => i.order.orderCode)).toEqual(['A', 'B']);
    expect(page.items[0]?.lastActivityDevice).toBe(900);
  });

  it('EXPLAIN QUERY PLAN: withoutVideo và danh sách dùng index, không quét evidence_files theo từng đơn', async () => {
    const db = await dbAtV6();
    await seed(db, 200);
    await createSqliteOrderStore(db).countOrders(SHOP, {}); // migrate
    const plan = async (sql: string, params: (string | number)[]) =>
      (await db.getAllAsync<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params)).map(
        (r) => r.detail,
      );

    const { where, params } = listConditions(SHOP, { withoutVideo: true });
    const listPlan = await plan(
      `SELECT o.* FROM orders o WHERE ${where} ORDER BY o.last_activity_device DESC, o.id DESC LIMIT 21`,
      params,
    );
    const countPlan = await plan(`SELECT COUNT(*) FROM orders o WHERE ${where}`, params);
    for (const lines of [listPlan, countPlan]) {
      expect(lines.some((l) => l.includes('idx_evidence_files_order_kind'))).toBe(true);
      expect(lines.some((l) => /SCAN ev\b/.test(l))).toBe(false);
      // mọi SCAN còn lại phải đi qua index (SCAN o USING INDEX ...), không phải quét bảng trần
      expect(lines.filter((l) => /^SCAN /.test(l) && !l.includes('USING'))).toEqual([]);
    }
    expect(listPlan.some((l) => l.includes('idx_orders_shop_activity'))).toBe(true);
    expect(listPlan.some((l) => /TEMP B-TREE/.test(l))).toBe(false);

    const noFilter = listConditions(SHOP, {});
    const pagePlan = await plan(
      `SELECT o.* FROM orders o WHERE ${noFilter.where}
       AND (o.last_activity_device < ? OR (o.last_activity_device = ? AND o.id < ?))
       ORDER BY o.last_activity_device DESC, o.id DESC LIMIT 21`,
      [...noFilter.params, 1, 1, 'x'],
    );
    expect(pagePlan.some((l) => l.includes('idx_orders_shop_activity'))).toBe(true);

    const sessionPlan = await plan(
      'SELECT id FROM packing_sessions WHERE order_id = ? AND shop_id = ? LIMIT 1',
      ['o2', SHOP],
    );
    expect(sessionPlan.some((l) => l.includes('idx_sessions_shop_order'))).toBe(true);
  });
});
