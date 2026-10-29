import { ORDER_DB_MIGRATIONS as MIGRATIONS } from '@/features/orders';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runReturnStoreContract, makeNewReturn } from './return-store.contract';
import { createSqliteReturnStore } from './sqlite-return-store';

// Chạy hợp đồng trên SQLite THẬT của Node (không phải expo-sqlite trên thiết bị).
runReturnStoreContract('SQLite (node:sqlite)', async (options) =>
  createSqliteReturnStore(createNodeSqliteDatabase(), options),
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

  it('migration v10 thêm bảng ảnh trên DB đã ở v9, giữ hồ sơ và tranh chấp cũ', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 9)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 9');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 's', 'C1', 'C1', 'shopee', 'entered_by_user', 1)`,
    );
    const store = createSqliteReturnStore(db);
    const made = await store.createReturn(makeNewReturn({ shopId: 's' as never }));
    // DB đang ở v9 (chưa có bảng ảnh): kho phải tự nâng lên v10 mà không mất dữ liệu cũ.
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    const orders = await db.getAllAsync<{ id: string }>('SELECT id FROM orders');
    expect(orders).toHaveLength(1);
    expect(await store.getReturn('s' as never, made.returnCase.id)).not.toBeNull();
    expect(await store.listMedia('s' as never, made.returnCase.id)).toEqual([]);
    const table = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'return_media'",
    );
    expect(table?.name).toBe('return_media');
  });

  it('migration v11 thêm cột vị trí vào ảnh đã có ở DB v10: ảnh cũ giữ nguyên, vị trí = chưa ghi', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 10)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 10');
    await db.runAsync(
      `INSERT INTO return_cases (id, shop_id, seq, code, status, created_at_device, updated_at_device)
       VALUES ('r1', 's', 1, 'HH-00001', 'receiving', 1, 1)`,
    );
    // Ảnh có từ TRƯỚC khi nâng cấp (cột của v10).
    await db.runAsync(
      `INSERT INTO return_media (id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client, created_at_device, updated_at_device)
       VALUES ('old', 'r1', 's', 'photo', 'queued', 'evidence/old.jpg', 5, ?, 1, 1)`,
      ['a'.repeat(64)],
    );
    const store = createSqliteReturnStore(db);
    await store.listReturns('s' as never, 1); // lần dùng đầu nâng DB lên phiên bản mới nhất
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    const columns = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(return_media)')).map(
      (c) => c.name,
    );
    expect(columns).toEqual(
      expect.arrayContaining(['lat', 'lng', 'accuracy_m', 'location_at_device', 'location_status']),
    );
    const [old] = await store.listMedia('s' as never, 'r1' as never);
    expect(old).toMatchObject({ id: 'old', state: 'queued', location: null });
    expect(
      await store.setMediaLocation('s' as never, 'old', {
        status: 'timeout',
        lat: null,
        lng: null,
        accuracyM: null,
        atDevice: null,
      }),
    ).toMatchObject({ ok: true });
  });

  it('migration v12 thêm cột dấu đã đăng vào hồ sơ có từ DB v11: hồ sơ cũ giữ nguyên, chưa đăng', async () => {
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 11)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 11');
    await db.runAsync(
      `INSERT INTO return_cases (id, shop_id, seq, code, status, created_at_device, updated_at_device, created_by)
       VALUES ('r1', 's', 1, 'RH-00001', 'receiving', 1, 1, 'u-1')`,
    );
    await db.runAsync(
      `INSERT INTO return_media (id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client, created_at_device, updated_at_device)
       VALUES ('old', 'r1', 's', 'photo', 'queued', 'evidence/old.jpg', 5, ?, 1, 1)`,
      ['a'.repeat(64)],
    );
    const store = createSqliteReturnStore(db);
    const pending = await store.listReturnsPendingRemote('s' as never, 5, 'u-1');
    expect(pending.map((r) => r.id)).toEqual(['r1']);
    const columns = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(return_cases)')).map(
      (c) => c.name,
    );
    expect(columns).toContain('remote_synced_at_device');
    await store.markReturnPublished('s' as never, 'r1' as never, 9);
    expect(await store.listReturnsPendingRemote('s' as never, 5, 'u-1')).toEqual([]);
  });

  it('không xóa ảnh đã nằm trong hồ sơ tranh chấp (kể cả hồ sơ đã đóng); ghi giữ không bị mất', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteReturnStore(db);
    const made = await store.createReturn(makeNewReturn({ shopId: 's' as never }));
    const returnId = made.returnCase.id;
    for (const id of ['held', 'free']) {
      await store.createMedia({
        id,
        shopId: 's' as never,
        returnId,
        kind: 'photo',
        atDevice: 1,
      });
    }
    await db.runAsync(
      `INSERT INTO disputes (id, shop_id, seq, code, status, subject_kind, return_id, subject_label, issue_type, created_at_device, updated_at_device)
       VALUES ('d1', 's', 1, 'TC-00001', 'closed', 'return', ?, 'HH', 'other', 1, 1)`,
      [returnId],
    );
    await db.runAsync(
      "INSERT INTO dispute_evidence (dispute_id, shop_id, evidence_id, added_at_device) VALUES ('d1', 's', 'held', 1)",
    );
    await expect(store.checkMediaDeletable('s' as never, 'held')).rejects.toMatchObject({
      code: 'RETURN_PHOTO_IN_USE',
    });
    await expect(store.deleteMedia('s' as never, 'held', 5, 'ev-x')).rejects.toMatchObject({
      code: 'RETURN_PHOTO_IN_USE',
    });
    // bị từ chối thì KHÔNG ghi sự kiện, KHÔNG mất dòng ảnh
    const events = await db.getAllAsync<{ kind: string }>(
      "SELECT kind FROM return_events WHERE kind = 'photo_deleted'",
    );
    expect(events).toEqual([]);
    expect(await store.listMedia('s' as never, returnId)).toHaveLength(2);
    // ảnh khác của cùng hồ sơ vẫn xóa được
    expect((await store.deleteMedia('s' as never, 'free', 6, 'ev-y')).ok).toBe(true);
    expect((await store.listMedia('s' as never, returnId)).map((m) => m.id)).toEqual(['held']);
  });

  it('xóa ảnh là một giao dịch: lỗi khi ghi sự kiện (ID sự kiện trùng) thì ảnh KHÔNG bị xóa', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteReturnStore(db);
    const made = await store.createReturn(makeNewReturn({ shopId: 's' as never }));
    await store.createMedia({
      id: 'm1',
      shopId: 's' as never,
      returnId: made.returnCase.id,
      kind: 'photo',
      atDevice: 1,
    });
    const duplicateEventId = made.events[0]?.id ?? '';
    await expect(store.deleteMedia('s' as never, 'm1', 5, duplicateEventId)).rejects.toMatchObject({
      code: 'RETURN_SAVE_FAILED',
    });
    expect(await store.listMedia('s' as never, made.returnCase.id)).toHaveLength(1);
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
