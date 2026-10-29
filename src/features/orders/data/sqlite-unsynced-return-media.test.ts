import { createSqliteReturnStore } from '@/features/returns';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { createSqliteOrderStore } from './sqlite-order-store';

let counter = 0;
const newReturn = (shopId: never) => ({
  id: `ret-${(counter += 1)}` as never,
  shopId,
  atDevice: 1000,
  eventId: `ev-${counter}`,
  observedCode: null,
  link: null,
  lines: [],
});

describe('ảnh hàng hoàn chưa đồng bộ chặn đăng xuất/chuyển cửa hàng', () => {
  const dev = (type: 'STOP_RECORDING' | 'LOCAL_FILE_READABLE') =>
    ({ type, origin: 'device' }) as const;

  it('countUnsynced / countUnsyncedOnDevice của kho đơn tính cả ảnh hàng hoàn, đúng theo shop', async () => {
    const db = createNodeSqliteDatabase();
    const orders = createSqliteOrderStore(db);
    const returns = createSqliteReturnStore(db);
    const shopA = 'shop-a' as never;
    const shopB = 'shop-b' as never;
    expect(await orders.countUnsynced(shopA)).toBe(0);
    const a = await returns.createReturn(newReturn(shopA));
    const b = await returns.createReturn(newReturn(shopB));
    // Ảnh vừa tạo (đang ghi) đã là dữ liệu chỉ có trên máy.
    await returns.createMedia({
      id: 'm1',
      shopId: shopA,
      returnId: a.returnCase.id,
      kind: 'photo',
      atDevice: 1,
    });
    expect(await orders.countUnsynced(shopA)).toBe(1);
    await returns.applyMediaEvent(shopA, 'm1', dev('STOP_RECORDING'), 2, { localPath: 'tmp.jpg' });
    await returns.applyMediaEvent(shopA, 'm1', dev('LOCAL_FILE_READABLE'), 3, {
      localPath: 'evidence/m1.jpg',
      sizeBytes: 10,
      sha256Client: 'a'.repeat(64),
    });
    // Đã lưu trên máy (queued) nhưng máy chủ chưa có: vẫn chưa đồng bộ.
    expect(await orders.countUnsynced(shopA)).toBe(1);
    expect(await orders.countUnsynced(shopB)).toBe(0);
    await returns.createMedia({
      id: 'm2',
      shopId: shopB,
      returnId: b.returnCase.id,
      kind: 'photo',
      atDevice: 4,
    });
    expect(await orders.countUnsyncedOnDevice()).toBe(2);
    expect(await orders.countUnsynced(shopB)).toBe(1);
  });

  it('media hàng hoàn hết chặn chỉ khi máy chủ đã nhận (uploaded/verified); đang tải, lỗi, lệch mã băm vẫn chặn', async () => {
    const db = createNodeSqliteDatabase();
    const orders = createSqliteOrderStore(db);
    const returns = createSqliteReturnStore(db);
    const shop = 'shop-a' as never;
    const made = await returns.createReturn(newReturn(shop));
    const device = (type: string) => ({ type, origin: 'device' }) as never;
    const server = (type: string) => ({ type, origin: 'server' }) as never;
    await returns.createMedia({
      id: 'm1',
      shopId: shop,
      returnId: made.returnCase.id,
      kind: 'photo',
      atDevice: 1,
    });
    await returns.applyMediaEvent(shop, 'm1', device('STOP_RECORDING'), 2, {
      localPath: 'tmp.jpg',
    });
    await returns.applyMediaEvent(shop, 'm1', device('LOCAL_FILE_READABLE'), 3, {
      localPath: 'evidence/m1.jpg',
      sizeBytes: 10,
      sha256Client: 'a'.repeat(64),
    });
    const step = async (event: unknown, expected: number, patch?: Record<string, unknown>) => {
      const result = await returns.applyMediaEvent(shop, 'm1', event as never, 9, patch);
      expect(result.ok).toBe(true);
      expect(await orders.countUnsynced(shop)).toBe(expected);
      expect(await orders.countUnsyncedOnDevice()).toBe(expected);
    };
    await step(device('UPLOAD_STARTED'), 1);
    await step(device('UPLOAD_FAILED'), 1, { attemptCount: 1, lastErrorCode: 'NETWORK' });
    await step(device('RETRY_UPLOAD'), 1);
    await step(device('UPLOAD_STARTED'), 1);
    await step(server('SERVER_RECEIVED'), 0); // máy chủ đã nhận đủ
    await step(server('SERVER_HASH_MISMATCH'), 1); // lệch mã băm: KHÔNG được coi là đã sao lưu
  });
});
