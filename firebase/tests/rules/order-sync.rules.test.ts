import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

import { makeOrderFixture } from './order-sync.fixture';
import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';
import {
  orderWrites,
  sessionWrite,
  type RemoteValues,
} from '@/features/orders/domain/remote-documents';

// Hình dạng tài liệu mà ỨNG DỤNG thật sự ghi (module remote-documents) phải qua được Rules thật.
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

const values: RemoteValues = {
  serverTimestamp: () => serverTimestamp(),
  timestamp: (ms) => Timestamp.fromMillis(ms),
};
const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('đăng đơn và phiên đúng hình dạng Rules yêu cầu', () => {
  it('packer đăng được đơn + dòng + kiện bằng một batch', async () => {
    const { details } = makeOrderFixture(SHOP_A, 'sync-order-1');
    const db = as(USERS.packerA);
    const batch = writeBatch(db);
    for (const w of orderWrites(details, USERS.packerA, values)) {
      batch.set(doc(db, w.path), w.data);
    }
    await assertSucceeds(batch.commit());
  });

  it('đơn nguồn "Khác" (app `other`) đăng được qua ánh xạ thật, phiên đăng tiếp được', async () => {
    const { details, session } = makeOrderFixture(SHOP_A, 'sync-order-other', 'other');
    expect(details.order.source).toBe('other');
    const db = as(USERS.packerA);
    const batch = writeBatch(db);
    const writes = orderWrites(details, USERS.packerA, values);
    expect(writes[0]?.data.source).toBe('other_unknown');
    for (const w of writes) batch.set(doc(db, w.path), w.data);
    await assertSucceeds(batch.commit());
    const write = sessionWrite(session, USERS.packerA, values);
    await assertSucceeds(setDoc(doc(db, write.path), write.data));
  });

  it('giá trị `other` của app gửi thẳng (bỏ qua ánh xạ) vẫn bị Rules từ chối', async () => {
    const { details } = makeOrderFixture(SHOP_A, 'sync-order-raw', 'other');
    const db = as(USERS.packerA);
    const [orderDoc] = orderWrites(details, USERS.packerA, values);
    if (!orderDoc) throw new Error('fixture');
    await assertFails(setDoc(doc(db, orderDoc.path), { ...orderDoc.data, source: 'other' }));
  });

  it('createdBy khác uid đang đăng nhập bị từ chối (đơn, kiện, phiên): không đăng thay người khác', async () => {
    const { details, session } = makeOrderFixture(SHOP_A, 'sync-order-7');
    const db = as(USERS.packerA);
    for (const w of orderWrites(details, 'nguoi-khac', values)) {
      await assertFails(setDoc(doc(db, w.path), w.data));
    }
    const mine = writeBatch(db);
    for (const w of orderWrites(details, USERS.packerA, values)) mine.set(doc(db, w.path), w.data);
    await assertSucceeds(mine.commit());
    const write = sessionWrite(session, 'nguoi-khac', values);
    await assertFails(setDoc(doc(db, write.path), write.data));
  });

  it('đăng phiên sau đơn với trạng thái recording, rồi đổi sang ended', async () => {
    const { details, session } = makeOrderFixture(SHOP_A, 'sync-order-2');
    const db = as(USERS.packerA);
    const batch = writeBatch(db);
    for (const w of orderWrites(details, USERS.packerA, values)) batch.set(doc(db, w.path), w.data);
    await assertSucceeds(batch.commit());
    const write = sessionWrite(session, USERS.packerA, values, '1.0.0');
    await assertSucceeds(setDoc(doc(db, write.path), write.data));
    await assertSucceeds(updateDoc(doc(db, write.path), { status: 'ended' }));
  });

  it('phiên không đăng được khi đơn/kiện chưa có trên máy chủ', async () => {
    const { session } = makeOrderFixture(SHOP_A, 'sync-order-3');
    const db = as(USERS.packerA);
    const write = sessionWrite(session, USERS.packerA, values);
    await assertFails(setDoc(doc(db, write.path), write.data));
  });

  it('người xem (viewer) và shop khác không đăng được', async () => {
    const { details } = makeOrderFixture(SHOP_A, 'sync-order-4');
    for (const uid of [USERS.viewerA, USERS.ownerB]) {
      const db = as(uid);
      const [first] = orderWrites(details, uid, values);
      if (!first) throw new Error('fixture');
      await assertFails(setDoc(doc(db, first.path), first.data));
    }
    // Đơn của shop B bằng tài khoản shop A cũng bị từ chối.
    const other = makeOrderFixture(SHOP_B, 'sync-order-5').details;
    const [first] = orderWrites(other, USERS.packerA, values);
    if (!first) throw new Error('fixture');
    await assertFails(setDoc(doc(as(USERS.packerA), first.path), first.data));
  });

  it('đăng lại cùng đơn (không còn là tạo) bị Rules từ chối: bên ghi phải kiểm tra tồn tại trước', async () => {
    const { details } = makeOrderFixture(SHOP_A, 'sync-order-6');
    const db = as(USERS.packerA);
    const [first] = orderWrites(details, USERS.packerA, values);
    if (!first) throw new Error('fixture');
    await assertSucceeds(setDoc(doc(db, first.path), first.data));
    await assertFails(setDoc(doc(db, first.path), first.data));
  });
});
