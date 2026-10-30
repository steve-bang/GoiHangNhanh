import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';

// V1-04: kiểu/độ dài trường, trần dung lượng cho MỌI bằng chứng, auditEvents chỉ máy chủ ghi, và
// KHÔNG chặn bằng chứng theo trạng thái phiên hay theo giờ thiết bị.
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const shop of [SHOP_A, SHOP_B]) {
      await setDoc(doc(ctx.firestore(), `shops/${shop}/returns/ret-1`), {
        shopId: shop,
        code: 'RH-00001',
        dataSource: 'user_entered',
        createdAtDevice: Timestamp.now(),
        createdAt: Timestamp.now(),
        // V1-07b: chỉ người tạo bản neo khai báo bằng chứng của hồ sơ.
        createdBy: USERS.packerA,
      });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const DAY_MS = 24 * 60 * 60_000;

const packingEvidence = (uid: string, overrides: Record<string, unknown> = {}) => ({
  shopId: SHOP_A,
  sessionId: 'session-1',
  orderId: 'order-1',
  packageId: 'pkg-1',
  kind: 'original_video',
  origin: 'in_app_capture',
  clientFileState: 'queued',
  sha256Client: 'c'.repeat(64),
  sizeBytes: 2048,
  mimeType: 'video/mp4',
  capturedAtDevice: Timestamp.now(),
  createdAtServer: serverTimestamp(),
  createdBy: uid,
  ...overrides,
});

const returnEvidence = (uid: string, overrides: Record<string, unknown> = {}) => ({
  shopId: SHOP_A,
  ownerKind: 'return',
  returnId: 'ret-1',
  kind: 'photo',
  origin: 'in_app_capture',
  clientFileState: 'queued',
  sha256Client: 'd'.repeat(64),
  sizeBytes: 4096,
  mimeType: 'image/jpeg',
  capturedAtDevice: Timestamp.now(),
  createdAtServer: serverTimestamp(),
  createdBy: uid,
  ...overrides,
});

const newSession = (uid: string, overrides: Record<string, unknown> = {}) => ({
  shopId: SHOP_A,
  kind: 'packing',
  orderId: 'order-1',
  packageId: 'pkg-1',
  orderSnapshot: { orderCode: 'DH001', source: 'shopee', lines: [] },
  status: 'recording',
  startedAtDevice: Timestamp.now(),
  startedAtServer: serverTimestamp(),
  createdBy: uid,
  ...overrides,
});

const evidenceRef = (uid: string, id = 'ev-new', shop = SHOP_A) =>
  doc(as(uid), `shops/${shop}/evidence/${id}`);

describe('bằng chứng KHÔNG phụ thuộc trạng thái phiên (thứ tự đồng bộ)', () => {
  it.each(['confirmed', 'ended', 'interrupted'])(
    'phiên được đăng ở %s TRƯỚC, bằng chứng khai báo SAU vẫn qua',
    async (status) => {
      const db = as(USERS.packerA);
      // Đúng luồng app: tạo phiên ở `recording` rồi đăng trạng thái mới nhất (publishSession).
      await assertSucceeds(
        setDoc(doc(db, `shops/${SHOP_A}/sessions/s-${status}`), newSession(USERS.packerA)),
      );
      await assertSucceeds(updateDoc(doc(db, `shops/${SHOP_A}/sessions/s-${status}`), { status }));
      await assertSucceeds(
        setDoc(
          evidenceRef(USERS.packerA, `ev-${status}`),
          packingEvidence(USERS.packerA, { sessionId: `s-${status}` }),
        ),
      );
    },
  );

  it('capturedAtDevice SAU request.time (đồng hồ máy chạy nhanh) vẫn qua, cả đóng gói và hàng hoàn', async () => {
    const future = Timestamp.fromMillis(Date.now() + 2 * DAY_MS);
    await assertSucceeds(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-future'),
        packingEvidence(USERS.packerA, { capturedAtDevice: future }),
      ),
    );
    await assertSucceeds(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-future-ret'),
        returnEvidence(USERS.packerA, { capturedAtDevice: future }),
      ),
    );
  });

  it('startedAtDevice/endedAtDevice của phiên sau request.time vẫn qua', async () => {
    const db = as(USERS.packerA);
    const future = Timestamp.fromMillis(Date.now() + DAY_MS);
    await assertSucceeds(
      setDoc(
        doc(db, `shops/${SHOP_A}/sessions/s-future`),
        newSession(USERS.packerA, { startedAtDevice: future }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(db, `shops/${SHOP_A}/sessions/s-future`), {
        status: 'ended',
        endedAtDevice: future,
      }),
    );
  });

  it('bằng chứng cho phiên không tồn tại, hoặc phiên chỉ có ở shop khác, bị từ chối', async () => {
    await assertFails(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-x'),
        packingEvidence(USERS.packerA, { sessionId: 'khong-co' }),
      ),
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `shops/${SHOP_B}/sessions/chi-o-b`), {
        shopId: SHOP_B,
        orderId: 'order-1',
        packageId: 'pkg-1',
        status: 'confirmed',
      });
    });
    await assertFails(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-y'),
        packingEvidence(USERS.packerA, { sessionId: 'chi-o-b' }),
      ),
    );
    // Shop B khai báo vào shop A dùng phiên của shop A: từ chối (QA-11).
    await assertFails(setDoc(evidenceRef(USERS.ownerB, 'ev-z'), packingEvidence(USERS.ownerB)));
  });
});

describe('trần dung lượng cho MỌI bằng chứng (Q-24c)', () => {
  const cases = [
    { owner: 'đóng gói', make: packingEvidence },
    { owner: 'hàng hoàn', make: returnEvidence },
  ];

  it.each(cases)('ảnh $owner: 25 000 000 qua, 25 000 001 bị từ chối', async ({ make }) => {
    const photo = { kind: 'photo', mimeType: 'image/jpeg' };
    await assertSucceeds(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-p1'),
        make(USERS.packerA, { ...photo, sizeBytes: 25_000_000 }),
      ),
    );
    await assertFails(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-p2'),
        make(USERS.packerA, { ...photo, sizeBytes: 25_000_001 }),
      ),
    );
  });

  it.each(cases)('video $owner: 2 000 000 000 qua, 2 000 000 001 bị từ chối', async ({ make }) => {
    const video = { kind: 'original_video', mimeType: 'video/mp4' };
    await assertSucceeds(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-v1'),
        make(USERS.packerA, { ...video, sizeBytes: 2_000_000_000 }),
      ),
    );
    await assertFails(
      setDoc(
        evidenceRef(USERS.packerA, 'ev-v2'),
        make(USERS.packerA, { ...video, sizeBytes: 2_000_000_001 }),
      ),
    );
  });

  it.each(cases)('$owner: loại và mime phải khớp; durationMs nguyên không âm', async ({ make }) => {
    for (const bad of [
      { kind: 'photo', mimeType: 'video/mp4' },
      { kind: 'original_video', mimeType: 'image/png' },
      { kind: 'original_video', mimeType: 'video/mp4', durationMs: -1 },
      { kind: 'original_video', mimeType: 'video/mp4', durationMs: 1.5 },
      { kind: 'original_video', mimeType: 'video/mp4', sizeBytes: 0 },
    ]) {
      await assertFails(setDoc(evidenceRef(USERS.packerA, 'ev-bad'), make(USERS.packerA, bad)));
    }
  });
});

describe('bằng chứng: cập nhật phía thiết bị có kiểu/trần', () => {
  const ref = () => doc(as(USERS.packerA), `shops/${SHOP_A}/evidence/evidence-1`);

  it('lastError là mã ngắn hoặc null; retryCount nguyên 0..1000', async () => {
    await assertSucceeds(
      updateDoc(ref(), {
        clientFileState: 'upload_failed',
        lastError: 'UPLOAD_FAILED',
        retryCount: 3,
      }),
    );
    await assertSucceeds(updateDoc(ref(), { lastError: null }));
    await assertFails(updateDoc(ref(), { lastError: 'x'.repeat(201) }));
    await assertFails(updateDoc(ref(), { lastError: { message: 'x' } }));
    await assertFails(updateDoc(ref(), { retryCount: -1 }));
    await assertFails(updateDoc(ref(), { retryCount: 1001 }));
    await assertFails(updateDoc(ref(), { retryCount: '3' }));
  });

  it('shop khác không cập nhật được dù đúng kiểu (QA-11)', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.ownerB), `shops/${SHOP_A}/evidence/evidence-1`), { retryCount: 1 }),
    );
  });
});

describe('đơn, dòng, kiện, phiên: kiểu và độ dài', () => {
  const orderRef = (uid: string, shop = SHOP_A) => doc(as(uid), `shops/${shop}/orders/order-1`);
  const update = (overrides: Record<string, unknown>) => ({
    updatedAt: serverTimestamp(),
    updatedBy: USERS.packerA,
    rev: 2,
    ...overrides,
  });

  it('tạo đơn: mã vận đơn, ghi chú có trần; mã rỗng/quá dài bị từ chối', async () => {
    const base = {
      shopId: SHOP_A,
      orderCode: 'DH-NEW',
      orderCodeNormalized: 'DH-NEW',
      source: 'shopee',
      status: 'new',
      dataSource: 'user_entered',
      createdAt: serverTimestamp(),
      createdBy: USERS.packerA,
      rev: 1,
    };
    const db = as(USERS.packerA);
    await assertSucceeds(
      setDoc(doc(db, `shops/${SHOP_A}/orders/o-ok`), {
        ...base,
        orderCode: 'x'.repeat(64),
        trackingCode: 'y'.repeat(64),
        trackingCodeNormalized: 'Y'.repeat(192),
        note: 'n'.repeat(500),
      }),
    );
    for (const bad of [
      { orderCode: 'x'.repeat(65) },
      { orderCodeNormalized: '' },
      { orderCodeNormalized: 'x'.repeat(193) },
      { trackingCode: '' },
      { trackingCode: 'y'.repeat(65) },
      { trackingCode: 123 },
      { trackingCodeNormalized: 'Y'.repeat(193) },
      { note: 'n'.repeat(501) },
      { note: ['x'] },
    ]) {
      await assertFails(setDoc(doc(db, `shops/${SHOP_A}/orders/o-bad`), { ...base, ...bad }));
    }
  });

  it('sửa đơn: cùng ràng buộc kiểu/độ dài như khi tạo; hợp lệ thì qua; shop khác bị từ chối', async () => {
    await assertFails(updateDoc(orderRef(USERS.packerA), update({ orderCode: '' })));
    await assertFails(updateDoc(orderRef(USERS.packerA), update({ orderCode: 'x'.repeat(65) })));
    await assertFails(updateDoc(orderRef(USERS.packerA), update({ orderCode: 42 })));
    await assertFails(updateDoc(orderRef(USERS.packerA), update({ trackingCode: 'y'.repeat(65) })));
    await assertFails(updateDoc(orderRef(USERS.packerA), update({ note: 'n'.repeat(501) })));
    await assertSucceeds(
      updateDoc(
        orderRef(USERS.packerA),
        update({ trackingCode: 'SPX1', trackingCodeNormalized: 'SPX1', note: 'ok' }),
      ),
    );
    await assertFails(
      updateDoc(orderRef(USERS.ownerB), {
        ...update({ note: 'ok' }),
        updatedBy: USERS.ownerB,
        rev: 3,
      }),
    );
  });

  it('sửa đơn: bỏ mã vận đơn (xóa trường) vẫn hợp lệ', async () => {
    await assertSucceeds(updateDoc(orderRef(USERS.packerA), update({ note: 'x' })));
    await assertSucceeds(
      updateDoc(orderRef(USERS.packerA), { ...update({ note: deleteField() }), rev: 3 }),
    );
  });

  it('dòng: tên 1..200, variant <= 200, số lượng 1..99 999 khi tạo và khi sửa', async () => {
    const db = as(USERS.packerA);
    const line = {
      shopId: SHOP_A,
      orderId: 'order-1',
      name: 'Áo',
      variant: 'Đen / XL',
      quantity: 1,
      dataSource: 'user_entered',
      createdAt: serverTimestamp(),
      createdBy: USERS.packerA,
    };
    const path = `shops/${SHOP_A}/orders/order-1/lines/l1`;
    for (const bad of [
      { name: 'x'.repeat(201) },
      { variant: 'v'.repeat(201) },
      { variant: 5 },
      { quantity: 100000 },
    ]) {
      await assertFails(setDoc(doc(db, path), { ...line, ...bad }));
    }
    await assertSucceeds(setDoc(doc(db, path), { ...line, quantity: 99999 }));
    await assertFails(updateDoc(doc(db, path), { name: '' }));
    await assertFails(updateDoc(doc(db, path), { variant: 'v'.repeat(201) }));
    await assertFails(updateDoc(doc(db, path), { quantity: 100000 }));
    await assertSucceeds(updateDoc(doc(db, path), { quantity: 2, variant: 'Trắng' }));
    await assertFails(updateDoc(doc(as(USERS.ownerB), path), { quantity: 3 }));
  });

  it('kiện: nhãn <= 100 ký tự', async () => {
    const path = `shops/${SHOP_A}/orders/order-1/packages/pkg-1`;
    await assertFails(updateDoc(doc(as(USERS.packerA), path), { label: 'x'.repeat(101) }));
    await assertFails(updateDoc(doc(as(USERS.packerA), path), { label: 7 }));
    await assertSucceeds(updateDoc(doc(as(USERS.packerA), path), { label: 'Hộp 1' }));
    await assertFails(updateDoc(doc(as(USERS.ownerB), path), { label: 'Hộp B' }));
  });

  it('phiên: ghi chú <= 500, interruptions là danh sách <= 100, endedAtDevice là thời gian', async () => {
    const ref = (uid: string) => doc(as(uid), `shops/${SHOP_A}/sessions/session-1`);
    await assertFails(updateDoc(ref(USERS.packerA), { note: 'n'.repeat(501) }));
    await assertFails(updateDoc(ref(USERS.packerA), { interruptions: 'call' }));
    await assertFails(
      updateDoc(ref(USERS.packerA), {
        interruptions: Array.from({ length: 101 }, () => ({ reason: 'x' })),
      }),
    );
    await assertFails(updateDoc(ref(USERS.packerA), { endedAtDevice: 'hom nay' }));
    await assertSucceeds(
      updateDoc(ref(USERS.packerA), {
        status: 'interrupted',
        note: 'ok',
        interruptions: [{ reason: 'call' }],
        endedAtDevice: Timestamp.now(),
      }),
    );
    await assertFails(updateDoc(ref(USERS.ownerB), { note: 'b' }));
  });
});

describe('auditEvents chỉ máy chủ ghi (bất biến 7)', () => {
  it('không ai từ client tạo/sửa/xóa được, kể cả chủ shop, quản lý, shop khác', async () => {
    for (const uid of [USERS.ownerA, USERS.managerA, USERS.packerA, USERS.ownerB]) {
      const db = as(uid);
      await assertFails(
        setDoc(doc(db, `shops/${SHOP_A}/auditEvents/write-forged`), {
          type: 'order.updated',
          actor: 'system:auditTrigger',
        }),
      );
      await assertFails(updateDoc(doc(db, `shops/${SHOP_A}/auditEvents/audit-1`), { type: 'x' }));
      await assertFails(deleteDoc(doc(db, `shops/${SHOP_A}/auditEvents/audit-1`)));
    }
  });

  it('shop khác không đọc được nhật ký của shop A (QA-11)', async () => {
    await assertFails(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_A}/auditEvents/audit-1`)));
    await assertSucceeds(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_B}/auditEvents/audit-1`)));
  });
});
