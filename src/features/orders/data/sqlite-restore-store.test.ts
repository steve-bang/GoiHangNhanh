import type { RemoteListedDocument, RemoteListPage, RemoteListRequest } from '@/api/contract';
import type { ShopId } from '@/core/ids';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { createRestorer } from '../domain/restore';
import { createSqliteEvidenceFileStore } from './sqlite-evidence-file-store';
import { createSqliteOrderStore } from './sqlite-order-store';
import { createSqliteRestoreStore } from './sqlite-restore-store';

const SHOP = 'shop-1' as ShopId;
const UID = 'uid-1';
const ts = (ms: number) => ({ toMillis: () => ms });

/** Máy chủ giả: bộ sưu tập theo đường dẫn, sắp mới trước, phân trang bằng con trỏ là chỉ số. */
function fakeServer(collections: Record<string, RemoteListedDocument[]>) {
  const calls: RemoteListRequest[] = [];
  return {
    calls,
    docs: {
      listPage: async (request: RemoteListRequest): Promise<RemoteListPage> => {
        calls.push(request);
        const all = collections[request.path] ?? [];
        const from = request.after ? Number(request.after) : 0;
        const docs = all.slice(from, from + request.pageSize);
        const end = from + docs.length;
        return { docs, next: end < all.length ? String(end) : null };
      },
    },
  };
}

const orderDoc = (id: string, code: string, at: number): RemoteListedDocument => ({
  id,
  data: { orderCode: code, source: 'other_unknown', createdAt: ts(at), createdBy: 'uid-old' },
});

function seedCollections(orderCount: number) {
  const collections: Record<string, RemoteListedDocument[]> = {};
  const orders: RemoteListedDocument[] = [];
  const sessions: RemoteListedDocument[] = [];
  const evidence: RemoteListedDocument[] = [];
  for (let i = 0; i < orderCount; i += 1) {
    const id = `o${i}`;
    orders.push(orderDoc(id, `DH${i}`, 1000 + i));
    collections[`shops/${SHOP}/orders/${id}/lines`] = [
      { id: `l${i}`, data: { name: 'Áo', quantity: 2, position: 0, createdAt: ts(1000 + i) } },
    ];
    collections[`shops/${SHOP}/orders/${id}/packages`] = [
      { id: `p${i}`, data: { index: 1, createdAt: ts(1000 + i), createdBy: 'uid-old' } },
    ];
    sessions.push({
      id: `s${i}`,
      data: {
        kind: 'packing',
        orderId: id,
        packageId: `p${i}`,
        status: i === 0 ? 'recording' : 'confirmed',
        startedAtDevice: ts(5000 + i),
        createdBy: 'uid-old',
        orderSnapshot: {
          orderCode: `DH${i}`,
          source: 'other_unknown',
          trackingCode: null,
          lines: [{ name: 'Áo', variant: null, quantity: 2 }],
          packageIndex: 1,
          packageCount: 1,
          takenAtDevice: 5000 + i,
        },
      },
    });
    evidence.push({
      id: `e${i}`,
      data: {
        kind: 'original_video',
        orderId: id,
        packageId: `p${i}`,
        sessionId: `s${i}`,
        sizeBytes: 1024,
        durationMs: 9000,
        sha256Client: 'ab'.repeat(32),
        capturedAtDevice: ts(5100 + i),
        server: { state: i === 1 ? 'uploaded' : 'verified' },
      },
    });
  }
  // Không khôi phục: bằng chứng chưa có xác nhận máy chủ, bằng chứng hàng hoàn, đơn nguồn lạ.
  const { server: _unconfirmed, ...withoutServer } = evidence[0]?.data ?? {};
  evidence.push({ id: 'pending', data: withoutServer });
  evidence.push({ id: 'ret', data: { ownerKind: 'return', returnId: 'r1', kind: 'photo' } });
  orders.push({ id: 'bad', data: { orderCode: 'X', source: 'khac_la', createdAt: ts(1) } });
  collections[`shops/${SHOP}/orders`] = orders;
  collections[`shops/${SHOP}/sessions`] = sessions;
  collections[`shops/${SHOP}/evidence`] = evidence;
  return collections;
}

const setup = () => {
  const db = createNodeSqliteDatabase();
  return {
    db,
    restoreStore: createSqliteRestoreStore(db),
    orders: createSqliteOrderStore(db, { creatorUid: () => UID }),
    files: createSqliteEvidenceFileStore(db),
  };
};

describe('khôi phục từ máy chủ xuống SQLite', () => {
  it('máy trống: lấy đủ đơn, dòng, kiện, phiên, bằng chứng; giữ người tạo gốc; không có tệp cục bộ', async () => {
    const { restoreStore, orders, files } = setup();
    const server = fakeServer(seedCollections(3));
    const restorer = createRestorer({
      docs: server.docs,
      store: restoreStore,
      now: () => 9999,
      pageSize: 2,
    });
    const seen: number[] = [];
    await expect(restorer.run(SHOP, UID, (c) => seen.push(c.orders))).resolves.toBe(true);

    const order = await orders.getOrder(SHOP, 'o1' as never);
    expect(order?.order).toMatchObject({
      orderCode: 'DH1',
      source: 'other',
      createdBy: 'uid-old',
    });
    expect(order?.lines).toHaveLength(1);
    expect(order?.packages[0]).toMatchObject({ index: 1, createdBy: 'uid-old' });

    // Phiên còn "recording" trên máy chủ -> gián đoạn trên máy này, không phải đang quay.
    expect((await orders.getSession(SHOP, 's0' as never))?.sessionStatus).toBe('interrupted');
    expect((await orders.getSession(SHOP, 's1' as never))?.sessionStatus).toBe('confirmed');
    await expect(orders.hasRecordingInProgress(SHOP)).resolves.toBe(false);

    const verified = await files.get(SHOP, 'e0' as never);
    expect(verified).toMatchObject({ state: 'verified', localPath: null, group: 'pack' });
    expect((await files.get(SHOP, 'e1' as never))?.state).toBe('uploaded');
    // Bằng chứng chưa được máy chủ xác nhận và bằng chứng hàng hoàn không khôi phục.
    expect(await files.get(SHOP, 'pending' as never)).toBeNull();
    expect(await files.get(SHOP, 'ret' as never)).toBeNull();
    // Đơn có nguồn lạ bị bỏ qua, không đoán thành "Khác".
    expect(await orders.getOrder(SHOP, 'bad' as never)).toBeNull();
    // Phân trang: nhiều hơn một lượt đọc đơn.
    expect(server.calls.filter((c) => c.path === `shops/${SHOP}/orders`).length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(3);
  });

  it('không đăng ngược: bản khôi phục đã đánh dấu đã đăng, người tạo khác không vào danh sách chờ', async () => {
    const { restoreStore, orders } = setup();
    const server = fakeServer(seedCollections(2));
    await createRestorer({ docs: server.docs, store: restoreStore, now: () => 1 }).run(SHOP, UID);
    await expect(orders.listOrdersPendingRemote(SHOP, 50, UID)).resolves.toEqual([]);
    await expect(orders.listOrdersPendingRemote(SHOP, 50, 'uid-old')).resolves.toEqual([]);
    await expect(orders.isSessionPublished(SHOP, 's1' as never)).resolves.toBe(true);
  });

  it('chạy lại không nhân đôi và không ghi đè bản ghi đã có trên máy', async () => {
    const { db, restoreStore, orders } = setup();
    const collections = seedCollections(2);
    const server = fakeServer(collections);
    await createRestorer({ docs: server.docs, store: restoreStore, now: () => 1 }).run(SHOP, UID);
    // Người dùng sửa dữ liệu cục bộ rồi chạy lại từ đầu (xóa tiến độ): bản cục bộ phải giữ nguyên.
    await db.runAsync("UPDATE orders SET order_code = 'SUA' WHERE id = 'o0'");
    await db.runAsync('DELETE FROM restore_progress');
    await createRestorer({ docs: server.docs, store: restoreStore, now: () => 2 }).run(SHOP, UID);
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM orders');
    expect(count?.n).toBe(2);
    expect((await orders.getOrder(SHOP, 'o0' as never))?.order.orderCode).toBe('SUA');
    const evidenceCount = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM evidence_files',
    );
    expect(evidenceCount?.n).toBe(2);
  });

  it('ngắt giữa chừng thì chạy tiếp từ trang đang dở, không đọc lại từ đầu', async () => {
    const { restoreStore, orders } = setup();
    const server = fakeServer(seedCollections(4));
    let failAfter = 2;
    const flaky = {
      listPage: async (request: RemoteListRequest) => {
        if (request.path === `shops/${SHOP}/orders` && failAfter-- === 0) {
          throw Object.assign(new Error('x'), { code: 'unavailable' });
        }
        return server.docs.listPage(request);
      },
    };
    await expect(
      createRestorer({ docs: flaky, store: restoreStore, now: () => 1, pageSize: 2 }).run(
        SHOP,
        UID,
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const progress = await restoreStore.readProgress(SHOP, UID);
    expect(progress.orders.done).toBe(false);
    expect(progress.orders.cursor).not.toBeNull();

    server.calls.length = 0;
    await createRestorer({ docs: server.docs, store: restoreStore, now: () => 2, pageSize: 2 }).run(
      SHOP,
      UID,
    );
    expect(server.calls[0]?.after).toBe(progress.orders.cursor);
    expect((await orders.getOrder(SHOP, 'o3' as never))?.order.orderCode).toBe('DH3');
    expect((await restoreStore.readProgress(SHOP, UID)).evidence.done).toBe(true);
  });

  it('lần đã hoàn tất thì không đọc máy chủ nữa', async () => {
    const { restoreStore } = setup();
    const server = fakeServer(seedCollections(1));
    const restorer = createRestorer({ docs: server.docs, store: restoreStore, now: () => 1 });
    await restorer.run(SHOP, UID);
    server.calls.length = 0;
    await restorer.run(SHOP, UID);
    expect(server.calls).toHaveLength(0);
  });
});
