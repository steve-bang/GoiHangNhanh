import type { UploadSessionStore } from '@/platform';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { MIGRATIONS } from './sqlite-migrations';
import { migrateLocalDatabase } from './sqlite-order-store';
import {
  createLocalUploadSessionStore,
  createMemoryUploadSessionStore,
  createSqliteUploadSessionStore,
} from './upload-session-store';

const SESSION = { location: 'https://storage.example/upload/abc', sizeBytes: 5_000_000 };

function runContract(name: string, make: () => Promise<UploadSessionStore>) {
  describe(`kho phiên tải: ${name}`, () => {
    it('chưa có thì null; lưu rồi đọc lại đúng; lưu lại thì ghi đè', async () => {
      const store = await make();
      expect(await store.get('shop-a', 'ev-1')).toBeNull();
      await store.save('shop-a', 'ev-1', SESSION);
      expect(await store.get('shop-a', 'ev-1')).toEqual(SESSION);
      await store.save('shop-a', 'ev-1', {
        location: 'https://storage.example/upload/xyz',
        sizeBytes: 7,
      });
      expect(await store.get('shop-a', 'ev-1')).toEqual({
        location: 'https://storage.example/upload/xyz',
        sizeBytes: 7,
      });
    });

    it('cô lập theo shop: shop khác không đọc, không xóa, không ghi đè được', async () => {
      const store = await make();
      await store.save('shop-a', 'ev-1', SESSION);
      expect(await store.get('shop-b', 'ev-1')).toBeNull();
      await store.clear('shop-b', 'ev-1');
      await store.save('shop-b', 'ev-1', { location: 'https://khac', sizeBytes: 1 });
      expect(await store.get('shop-a', 'ev-1')).toEqual(SESSION);
      expect(await store.get('shop-b', 'ev-1')).toBeNull();
    });

    it('xóa chỉ bỏ đúng bằng chứng đó; xóa cái không có thì không lỗi', async () => {
      const store = await make();
      await store.save('shop-a', 'ev-1', SESSION);
      await store.save('shop-a', 'ev-2', SESSION);
      await store.clear('shop-a', 'ev-1');
      await store.clear('shop-a', 'khong-co');
      expect(await store.get('shop-a', 'ev-1')).toBeNull();
      expect(await store.get('shop-a', 'ev-2')).toEqual(SESSION);
    });
  });
}

runContract('bộ nhớ', async () => createMemoryUploadSessionStore());
runContract('SQLite', async () => createSqliteUploadSessionStore(createNodeSqliteDatabase()));
runContract('mở lười (SQLite)', async () => {
  const db = createNodeSqliteDatabase();
  return createLocalUploadSessionStore(async () => db);
});
runContract('mở lười (web, không có SQLite)', async () =>
  createLocalUploadSessionStore(async () => null),
);

describe('kho phiên tải: mở lười', () => {
  it('mở lỗi thì thao tác ném lỗi, lần sau thử mở lại', async () => {
    let calls = 0;
    const db = createNodeSqliteDatabase();
    const store = createLocalUploadSessionStore(async () => {
      calls += 1;
      if (calls === 1) throw new Error('mo loi');
      return db;
    });
    await expect(store.get('shop-a', 'ev-1')).rejects.toThrow('mo loi');
    expect(await store.get('shop-a', 'ev-1')).toBeNull();
    expect(calls).toBe(2);
  });
});

describe('migration v18 (phiên tải đang dở)', () => {
  it('v17 -> v18: dữ liệu cũ nguyên vẹn, bảng mới rỗng; chạy lại không đổi gì', async () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(18);
    const db = createNodeSqliteDatabase();
    for (const sql of MIGRATIONS.slice(0, 17)) await db.execAsync(sql);
    await db.execAsync('PRAGMA user_version = 17');
    await db.runAsync(
      `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device)
       VALUES ('o1', 'shop-a', 'DH-1', 'DH-1', 'shopee', 'entered_by_user', 1)`,
    );
    const snapshot = () => db.getAllAsync('SELECT * FROM orders');
    const before = await snapshot();

    await migrateLocalDatabase(db);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    expect(await snapshot()).toEqual(before);
    expect(await db.getAllAsync('SELECT * FROM upload_sessions')).toEqual([]);

    await migrateLocalDatabase(db);
    expect(await snapshot()).toEqual(before);
  });

  it('khi dùng kho, bảng được tạo qua migrate và có created_at_device', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteUploadSessionStore(db, () => 12345);
    await store.save('shop-a', 'ev-1', SESSION);
    expect(await db.getAllAsync('SELECT created_at_device FROM upload_sessions')).toEqual([
      { created_at_device: 12345 },
    ]);
  });
});
