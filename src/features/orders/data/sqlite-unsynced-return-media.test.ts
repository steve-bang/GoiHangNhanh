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
});
