import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { runEvidenceFileStoreContract, seedFile } from './evidence-file-store.contract';
import { makeOrder } from './order-store.contract';
import { MIGRATIONS } from './sqlite-migrations';
import { createSqliteEvidenceFileStore } from './sqlite-evidence-file-store';
import { createSqliteOrderStore } from './sqlite-order-store';

// Chạy hợp đồng trên SQLite THẬT của Node (không phải expo-sqlite trên thiết bị). Kho đơn và kho
// tệp dùng CHUNG một kết nối, như khi chạy app.
const harness = async () => {
  const db = createNodeSqliteDatabase();
  return { files: createSqliteEvidenceFileStore(db), orders: createSqliteOrderStore(db), db };
};
runEvidenceFileStoreContract('SQLite (node:sqlite)', harness);

describe('kho tệp SQLite: schema và ràng buộc', () => {
  it('migration v3 tạo bảng evidence_files và nâng user_version', async () => {
    const { files, db } = await harness();
    await files.countUnsynced(LOCAL_SHOP_ID);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    const table = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE name = 'evidence_files'",
    );
    expect(table).not.toBeNull();
  });

  it('tệp phải gắn với phiên có thật (khóa ngoại): phiên lạ bị từ chối', async () => {
    const h = await harness();
    const input = await seedFile(h, 'FK');
    await expect(
      h.files.create({ ...input, id: 'ev-fk' as never, sessionId: 'khong-co' as never }),
    ).rejects.toMatchObject({ code: 'LOCAL_SAVE_UNAVAILABLE' });
  });

  it('giao dịch của kho đơn và kho tệp chạy đồng thời trên một kết nối không va nhau', async () => {
    const h = await harness();
    const input = await seedFile(h, 'PAR');
    await h.files.create(input);
    await Promise.all([
      h.orders.saveNewOrder(makeOrder('PAR2', { lines: [{ name: 'Áo' }] })),
      h.files.applyEvent(
        LOCAL_SHOP_ID,
        input.id,
        { type: 'STOP_RECORDING', origin: 'device' },
        5000,
      ),
      h.orders.saveNewOrder(makeOrder('PAR3', { lines: [{ name: 'Quần' }] })),
    ]);
    expect((await h.files.get(LOCAL_SHOP_ID, input.id))?.state).toBe('saving_local');
  });

  it('kho đơn thấy tệp bằng chứng: withoutVideo và số chưa đồng bộ theo shop/toàn máy', async () => {
    const h = await harness();
    const a = await seedFile(h, 'W1');
    await seedFile(h, 'W2', { id: 'ev-W2' });
    expect(await h.orders.countOrders(LOCAL_SHOP_ID, { withoutVideo: true })).toBe(2);
    expect(await h.orders.countUnsynced(LOCAL_SHOP_ID)).toBe(0);
    await h.files.create(a);
    expect(await h.orders.countOrders(LOCAL_SHOP_ID, { withoutVideo: true })).toBe(1);
    expect(await h.orders.countOrders(LOCAL_SHOP_ID, {})).toBe(2);
    expect(await h.orders.countUnsynced(LOCAL_SHOP_ID)).toBe(1);
    expect(await h.orders.countUnsyncedOnDevice()).toBe(1);
    expect(await h.orders.countUnsynced('shop-khac' as never)).toBe(0);
    await h.files.applyEvent(
      LOCAL_SHOP_ID,
      a.id,
      { type: 'MARK_UNRECOVERABLE', origin: 'device' },
      9000,
    );
    expect(await h.orders.countUnsynced(LOCAL_SHOP_ID)).toBe(0);
  });
});
