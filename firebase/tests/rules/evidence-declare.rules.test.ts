import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

import { evidenceWrite } from '@/features/upload/domain/evidence-document';

import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';

// Hình dạng tài liệu bằng chứng mà ỨNG DỤNG ghi (evidence-document.ts) phải qua Rules thật.
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
});

const values = {
  serverTimestamp: () => serverTimestamp(),
  timestamp: (ms: number) => Timestamp.fromMillis(ms),
};
const as = (uid: string) => env.authenticatedContext(uid).firestore();

// Phiên nền của helpers.ts: session-1 / order-1 / pkg-1.
const request = (shopId: string, overrides: Record<string, unknown> = {}) =>
  ({
    evidenceId: 'ev-new',
    shopId,
    owner: { kind: 'packing', orderId: 'order-1', sessionId: 'session-1', packageId: 'pkg-1' },
    kind: 'video',
    createdAtDevice: 1_700_000_000_000,
    durationMs: 61_000,
    localPath: 'file:///x.mp4',
    sizeBytes: 2048,
    sha256Client: 'a'.repeat(64),
    mimeType: 'video/mp4',
    ...overrides,
  }) as never;

const packingOwner = (overrides: Record<string, unknown> = {}) => ({
  kind: 'packing',
  orderId: 'order-1',
  sessionId: 'session-1',
  packageId: 'pkg-1',
  ...overrides,
});

describe('khai báo bằng chứng đúng hình dạng Rules yêu cầu', () => {
  it('packer khai báo được khi phiên/đơn/kiện khớp', async () => {
    const w = evidenceWrite(request(SHOP_A), USERS.packerA, values, '1.0.0');
    await assertSucceeds(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('thiếu durationMs vẫn qua (tùy chọn)', async () => {
    const w = evidenceWrite(
      request(SHOP_A, { durationMs: null, kind: 'photo' }),
      USERS.packerA,
      values,
    );
    await assertSucceeds(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('kiện không thuộc phiên bị từ chối (liên kết sai)', async () => {
    const w = evidenceWrite(
      request(SHOP_A, { owner: packingOwner({ packageId: 'pkg-2' }) }),
      USERS.packerA,
      values,
    );
    await assertFails(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('phiên chưa đăng lên máy chủ bị từ chối', async () => {
    const w = evidenceWrite(
      request(SHOP_A, { owner: packingOwner({ sessionId: 'chua-dang' }) }),
      USERS.packerA,
      values,
    );
    await assertFails(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('người xem và shop khác không khai báo được', async () => {
    const a = evidenceWrite(request(SHOP_A), USERS.viewerA, values);
    await assertFails(setDoc(doc(as(USERS.viewerA), a.path), a.data));
    const b = evidenceWrite(request(SHOP_B), USERS.packerA, values);
    await assertFails(setDoc(doc(as(USERS.packerA), b.path), b.data));
  });

  it('client không tự đặt trạng thái máy chủ sau khi khai báo', async () => {
    const w = evidenceWrite(request(SHOP_A), USERS.packerA, values);
    const db = as(USERS.packerA);
    await assertSucceeds(setDoc(doc(db, w.path), w.data));
    await assertFails(updateDoc(doc(db, w.path), { server: { state: 'verified' } }));
    await assertSucceeds(updateDoc(doc(db, w.path), { clientFileState: 'uploading' }));
  });
});

describe('khai báo bằng chứng HÀNG HOÀN đúng hình dạng Rules yêu cầu (Q-28)', () => {
  const returnRequest = (shopId: string, overrides: Record<string, unknown> = {}) =>
    request(shopId, { owner: { kind: 'return', returnId: 'ret-1' }, ...overrides });

  beforeEach(async () => {
    // Bản neo hồ sơ hàng hoàn đã đăng ở cả hai shop; KHÔNG có đơn gốc liên kết.
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const shop of [SHOP_A, SHOP_B]) {
        await setDoc(doc(ctx.firestore(), `shops/${shop}/returns/ret-1`), {
          shopId: shop,
          code: 'RH-00001',
          dataSource: 'user_entered',
          createdAtDevice: Timestamp.now(),
          createdAt: Timestamp.now(),
          createdBy: 'seed',
        });
      }
    });
  });

  it('ảnh và video hàng hoàn khai báo được khi bản neo đã có (hồ sơ không cần đơn)', async () => {
    const photo = evidenceWrite(
      returnRequest(SHOP_A, { kind: 'photo', mimeType: 'image/jpeg', durationMs: null }),
      USERS.packerA,
      values,
      '1.0.0',
    );
    expect(Object.keys(photo.data)).not.toContain('sessionId');
    expect(photo.data).toMatchObject({ ownerKind: 'return', returnId: 'ret-1', kind: 'photo' });
    await assertSucceeds(setDoc(doc(as(USERS.packerA), photo.path), photo.data));
    const video = evidenceWrite(
      returnRequest(SHOP_A, { evidenceId: 'ev-video' }),
      USERS.packerA,
      values,
    );
    await assertSucceeds(setDoc(doc(as(USERS.packerA), video.path), video.data));
  });

  it('bản neo chưa đăng thì bị từ chối (hàng đợi phải đợi đăng neo)', async () => {
    const w = evidenceWrite(
      returnRequest(SHOP_A, { owner: { kind: 'return', returnId: 'chua-dang' } }),
      USERS.packerA,
      values,
    );
    await assertFails(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('người xem và shop khác không khai báo được', async () => {
    const a = evidenceWrite(returnRequest(SHOP_A), USERS.viewerA, values);
    await assertFails(setDoc(doc(as(USERS.viewerA), a.path), a.data));
    const b = evidenceWrite(returnRequest(SHOP_A), USERS.ownerB, values);
    await assertFails(setDoc(doc(as(USERS.ownerB), b.path), b.data));
  });
});
