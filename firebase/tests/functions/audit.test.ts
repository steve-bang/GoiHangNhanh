import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

import {
  AUDITED_ENTITIES,
  auditEventId,
  changedFields,
  entityLocation,
  recordAuditForWrite,
  valuesEqual,
  type AuditedEntity,
} from '../../functions/src/audit';

// Chạy trên Firestore Emulator (FIRESTORE_EMULATOR_HOST do `firebase emulators:exec` đặt).
let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'audit-fn-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

let counter = 0;
const newShop = () => `shop-audit-${Date.now()}-${(counter += 1)}`;

const auditOf = async (shopId: string) =>
  (await db.collection(`shops/${shopId}/auditEvents`).get()).docs.map((d) => d.data());

/** Ghi tài liệu bằng Admin SDK rồi chạy logic trigger với bản trước/sau thật (có updateTime). */
async function write(
  entity: AuditedEntity,
  shopId: string,
  params: Record<string, string>,
  data: Record<string, unknown> | null,
  mode: 'set' | 'update' = 'set',
) {
  const { entityPath, entityId } = entityLocation(entity, { shopId, ...params });
  const ref = db.doc(`shops/${shopId}/${entityPath}`);
  const before = await ref.get();
  if (data === null) await ref.delete();
  else if (mode === 'update') await ref.update(data);
  else await ref.set(data);
  const after = await ref.get();
  const input = { entity, shopId, entityId, entityPath, before, after };
  return { input, outcome: await recordAuditForWrite(db, input) };
}

const SENSITIVE = ['DH-BI-MAT-001', 'SPX-VAN-DON-999', 'ghi chu rieng', 'Ao thun do size L'];

describe('so sánh và tên trường đổi', () => {
  it('so sánh giá trị Firestore lồng nhau, Timestamp, mảng', () => {
    const t = Timestamp.fromMillis(1_700_000_000_000);
    expect(
      valuesEqual({ a: [1, { b: t }] }, { a: [1, { b: Timestamp.fromMillis(1_700_000_000_000) }] }),
    ).toBe(true);
    expect(valuesEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(valuesEqual(t, Timestamp.fromMillis(1))).toBe(false);
    expect(changedFields({ a: 1, b: 2, c: 3 }, { a: 1, b: 3, d: 4 })).toEqual(['b', 'c', 'd']);
  });

  it('id sự kiện cố định theo (đường dẫn, updateTime) và khác nhau giữa hai lần ghi', () => {
    const t1 = { seconds: 1, nanoseconds: 2 };
    expect(auditEventId('orders/o1', t1)).toBe(auditEventId('orders/o1', t1));
    expect(auditEventId('orders/o1', t1)).not.toBe(
      auditEventId('orders/o1', { seconds: 1, nanoseconds: 3 }),
    );
    expect(auditEventId('orders/o1', t1)).not.toBe(auditEventId('orders/o2', t1));
    expect(auditEventId('orders/o1', t1)).toMatch(/^write-[0-9a-f]{64}$/);
  });

  it('mỗi loại thực thể có đường dẫn trigger nằm dưới shops/{shopId}', () => {
    for (const path of Object.values(AUDITED_ENTITIES)) {
      expect(path.startsWith('shops/{shopId}/')).toBe(true);
    }
  });
});

describe('recordAuditForWrite', () => {
  it('tạo đơn: đúng một sự kiện order.created, người tạo từ createdBy, không lộ mã đơn/mã vận đơn/ghi chú', async () => {
    const shopId = newShop();
    const { outcome, input } = await write(
      'order',
      shopId,
      { orderId: 'o1' },
      {
        shopId,
        orderCode: SENSITIVE[0],
        orderCodeNormalized: SENSITIVE[0],
        trackingCode: SENSITIVE[1],
        trackingCodeNormalized: SENSITIVE[1],
        note: SENSITIVE[2],
        source: 'shopee',
        status: 'new',
        dataSource: 'user_entered',
        createdBy: 'u1',
        rev: 1,
      },
    );
    expect(outcome).toBe('recorded');
    const events = await auditOf(shopId);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'order.created',
        entity: 'order',
        entityId: 'o1',
        entityPath: 'orders/o1',
        actorUid: 'u1',
        actor: 'system:auditTrigger',
        before: null,
        after: expect.objectContaining({ status: 'new', source: 'shopee', rev: 1 }),
      }),
    ]);
    expect(events[0]?.changedFields).toEqual(
      expect.arrayContaining(['orderCode', 'trackingCode', 'note', 'status']),
    );
    // occurredAt = updateTime của tài liệu (lúc thay đổi xảy ra); at = lúc ghi sự kiện (không sớm hơn).
    const occurredAt = events[0]?.occurredAt as Timestamp;
    expect(occurredAt.isEqual(input.after.updateTime as Timestamp)).toBe(true);
    expect((events[0]?.at as Timestamp).toMillis()).toBeGreaterThanOrEqual(occurredAt.toMillis());
    const text = JSON.stringify(events);
    for (const secret of SENSITIVE) expect(text).not.toContain(secret);
  });

  it('sửa đơn: một sự kiện order.updated với trước/sau của trường an toàn, người sửa từ updatedBy; chạy lại không nhân đôi', async () => {
    const shopId = newShop();
    await write(
      'order',
      shopId,
      { orderId: 'o1' },
      {
        shopId,
        orderCode: SENSITIVE[0],
        status: 'new',
        createdBy: 'u1',
        rev: 1,
      },
    );
    const { input, outcome } = await write(
      'order',
      shopId,
      { orderId: 'o1' },
      { status: 'cancelled', orderCode: 'DH-MOI-002', rev: 2, updatedBy: 'u2' },
      'update',
    );
    expect(outcome).toBe('recorded');
    // Giao lặp cùng sự kiện (cùng updateTime): không nhân đôi.
    expect(await recordAuditForWrite(db, input)).toBe('duplicate');
    expect(await recordAuditForWrite(db, input)).toBe('duplicate');
    const updated = (await auditOf(shopId)).filter((e) => e.type === 'order.updated');
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      actorUid: 'u2',
      changedFields: ['orderCode', 'rev', 'status', 'updatedBy'],
      before: { status: 'new', rev: 1, updatedBy: null },
      after: { status: 'cancelled', rev: 2, updatedBy: 'u2' },
    });
    expect(JSON.stringify(updated)).not.toContain('DH-MOI-002');
  });

  it('mỗi lần cập nhật phiên tạo đúng một sự kiện (kể cả nhảy thẳng tới confirmed); ảnh chụp đơn không vào kiểm toán', async () => {
    const shopId = newShop();
    await write(
      'session',
      shopId,
      { sessionId: 's1' },
      {
        shopId,
        kind: 'packing',
        orderId: 'o1',
        packageId: 'p1',
        orderSnapshot: { orderCode: SENSITIVE[0], trackingCode: SENSITIVE[1], lines: [] },
        status: 'recording',
        createdBy: 'u1',
      },
    );
    await write('session', shopId, { sessionId: 's1' }, { status: 'confirmed' }, 'update');
    await write('session', shopId, { sessionId: 's1' }, { note: SENSITIVE[2] }, 'update');
    const events = await auditOf(shopId);
    expect(events.map((e) => e.type).sort()).toEqual([
      'session.created',
      'session.updated',
      'session.updated',
    ]);
    const statusChange = events.find((e) => e.changedFields?.includes('status') && e.before);
    expect(statusChange).toMatchObject({
      before: { status: 'recording' },
      after: { status: 'confirmed' },
      actorUid: null,
    });
    const noteChange = events.find((e) => e.changedFields?.[0] === 'note');
    expect(noteChange).toMatchObject({ before: {}, after: {} });
    const text = JSON.stringify(events);
    for (const secret of SENSITIVE) expect(text).not.toContain(secret);
  });

  it('dòng và kiện: tên/variant sản phẩm và nhãn kiện không vào kiểm toán, số lượng có', async () => {
    const shopId = newShop();
    await write(
      'order_line',
      shopId,
      { orderId: 'o1', lineId: 'l1' },
      {
        shopId,
        orderId: 'o1',
        name: SENSITIVE[3],
        variant: 'Do / L',
        quantity: 1,
        createdBy: 'u1',
      },
    );
    await write('order_line', shopId, { orderId: 'o1', lineId: 'l1' }, { quantity: 3 }, 'update');
    await write(
      'package',
      shopId,
      { orderId: 'o1', packageId: 'p1' },
      {
        shopId,
        orderId: 'o1',
        index: 1,
        createdBy: 'u1',
      },
    );
    await write(
      'package',
      shopId,
      { orderId: 'o1', packageId: 'p1' },
      { label: SENSITIVE[2] },
      'update',
    );
    const events = await auditOf(shopId);
    expect(events).toHaveLength(4);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'order_line.updated',
          entityPath: 'orders/o1/lines/l1',
          before: { quantity: 1 },
          after: { quantity: 3 },
        }),
        expect.objectContaining({
          type: 'package.updated',
          entityPath: 'orders/o1/packages/p1',
          changedFields: ['label'],
        }),
      ]),
    );
    const text = JSON.stringify(events);
    for (const secret of [...SENSITIVE, 'Do / L']) expect(text).not.toContain(secret);
  });

  it('bằng chứng: trạng thái máy chủ chỉ ghi server.state (không mã băm), lastError không ghi giá trị', async () => {
    const shopId = newShop();
    await write(
      'evidence',
      shopId,
      { evidenceId: 'e1' },
      {
        shopId,
        sessionId: 's1',
        kind: 'original_video',
        clientFileState: 'queued',
        sha256Client: 'a'.repeat(64),
        sizeBytes: 10,
        createdBy: 'u1',
      },
    );
    await write(
      'evidence',
      shopId,
      { evidenceId: 'e1' },
      { server: { state: 'verified', sha256Server: 'b'.repeat(64) } },
      'update',
    );
    await write(
      'evidence',
      shopId,
      { evidenceId: 'e1' },
      { clientFileState: 'upload_failed', lastError: 'chuoi tu do ' + SENSITIVE[0] },
      'update',
    );
    const events = await auditOf(shopId);
    expect(events).toHaveLength(3);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'evidence.updated',
          changedFields: ['server'],
          before: { server: { state: null } },
          after: { server: { state: 'verified' } },
        }),
        expect.objectContaining({
          changedFields: ['clientFileState', 'lastError'],
          after: { clientFileState: 'upload_failed' },
        }),
      ]),
    );
    const text = JSON.stringify(events);
    expect(text).not.toContain('b'.repeat(64));
    expect(text).not.toContain(SENSITIVE[0]);
  });

  it('bản neo hàng hoàn: return.created', async () => {
    const shopId = newShop();
    await write(
      'return',
      shopId,
      { returnId: 'r1' },
      {
        shopId,
        code: 'RH-00001',
        dataSource: 'user_entered',
        createdBy: 'u1',
      },
    );
    expect(await auditOf(shopId)).toEqual([
      expect.objectContaining({ type: 'return.created', entityId: 'r1', actorUid: 'u1' }),
    ]);
  });

  it('xóa (chỉ máy chủ, purge V1-14) và ghi y nguyên không tạo sự kiện', async () => {
    const shopId = newShop();
    const data = { shopId, status: 'new', createdBy: 'u1', rev: 1 };
    await write('order', shopId, { orderId: 'o1' }, data);
    const same = await write('order', shopId, { orderId: 'o1' }, data);
    const removed = await write('order', shopId, { orderId: 'o1' }, null);
    expect(same.outcome).toBe('skipped_no_change');
    expect(removed.outcome).toBe('skipped_delete');
    expect(await auditOf(shopId)).toHaveLength(1);
  });

  it('danh tính sự kiện (auth context) được ghi riêng khi có', async () => {
    const shopId = newShop();
    const { input } = await write(
      'session',
      shopId,
      { sessionId: 's9' },
      {
        shopId,
        status: 'recording',
        createdBy: 'u1',
      },
    );
    await db
      .doc(`shops/${shopId}/auditEvents/${auditEventId(input.entityPath, input.after.updateTime)}`)
      .delete();
    await recordAuditForWrite(db, { ...input, authType: 'unknown', authId: 'u1' });
    expect(await auditOf(shopId)).toEqual([
      expect.objectContaining({ auth: { type: 'unknown', id: 'u1' } }),
    ]);
  });

  it('cô lập theo shop: sự kiện chỉ nằm trong shop của tài liệu', async () => {
    const a = newShop();
    const b = newShop();
    await write(
      'order',
      a,
      { orderId: 'o1' },
      { shopId: a, status: 'new', createdBy: 'u1', rev: 1 },
    );
    expect(await auditOf(a)).toHaveLength(1);
    expect(await auditOf(b)).toEqual([]);
  });
});
