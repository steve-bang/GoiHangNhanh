import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { returnAnchorWrite } from '@/features/returns/domain/remote-documents';

import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';

// Hình dạng bản neo hồ sơ hàng hoàn mà ỨNG DỤNG ghi (remote-documents.ts) phải qua Rules thật.
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

const returnCase = (shopId: string, overrides: Record<string, unknown> = {}) =>
  ({
    id: 'ret-app-1',
    shopId,
    code: 'RH-00001',
    createdAtDevice: 1_700_000_000_000,
    ...overrides,
  }) as never;

describe('đăng bản neo hồ sơ hàng hoàn đúng hình dạng Rules yêu cầu', () => {
  it('packer đăng được bản neo; hồ sơ chưa liên kết đơn vẫn hợp lệ (không có khóa đơn)', async () => {
    const w = returnAnchorWrite(returnCase(SHOP_A), USERS.packerA, values, '1.0.0');
    expect(Object.keys(w.data)).not.toContain('sourceOrderId');
    await assertSucceeds(setDoc(doc(as(USERS.packerA), w.path), w.data));
    await assertSucceeds(getDoc(doc(as(USERS.viewerA), w.path)));
  });

  it('thiếu appVersion vẫn qua (tùy chọn)', async () => {
    const w = returnAnchorWrite(returnCase(SHOP_A), USERS.packerA, values);
    await assertSucceeds(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('đăng lại cùng bản neo (thử lại sau khi mất phản hồi) bị Rules từ chối: createMissing phải kiểm tồn tại trước', async () => {
    const w = returnAnchorWrite(returnCase(SHOP_A), USERS.packerA, values);
    await assertSucceeds(setDoc(doc(as(USERS.packerA), w.path), w.data));
    await assertFails(setDoc(doc(as(USERS.packerA), w.path), w.data));
  });

  it('người xem và shop khác không đăng được; đăng danh nghĩa người khác bị từ chối', async () => {
    const a = returnAnchorWrite(returnCase(SHOP_A), USERS.viewerA, values);
    await assertFails(setDoc(doc(as(USERS.viewerA), a.path), a.data));
    const b = returnAnchorWrite(returnCase(SHOP_A), USERS.ownerB, values);
    await assertFails(setDoc(doc(as(USERS.ownerB), b.path), b.data));
    const c = returnAnchorWrite(returnCase(SHOP_B), USERS.packerA, values);
    await assertFails(setDoc(doc(as(USERS.packerA), c.path), c.data));
    const d = returnAnchorWrite(returnCase(SHOP_A), USERS.ownerA, values);
    await assertFails(setDoc(doc(as(USERS.packerA), d.path), d.data));
  });
});
