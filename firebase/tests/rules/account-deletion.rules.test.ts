import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';

// V1-14: `accountDeletions` client không đọc/ghi; shop `deleting` bị khóa với mọi client (kể cả thành viên
// còn sót); `evidenceReverify` (V1-04) không mở cho client.
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
    const db = ctx.firestore();
    await setDoc(doc(db, `accountDeletions/${USERS.ownerA}`), {
      uid: USERS.ownerA,
      shopIds: [SHOP_A],
      status: 'pending_purge',
    });
    for (const shop of [SHOP_A, SHOP_B]) {
      await setDoc(doc(db, `shops/${shop}/evidenceReverify/evidence-1`), {
        requestedAt: Timestamp.now(),
        requestedBy: 'seed',
        count: 1,
      });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

async function markDeleting(shopId: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), `shops/${shopId}`), {
      status: 'deleting',
      purgeAfter: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60_000),
      deletionRecordId: USERS.ownerA,
    });
  });
}

describe('accountDeletions', () => {
  it('chính chủ, thành viên, người lạ, chưa đăng nhập: không đọc, không ghi', async () => {
    for (const uid of [USERS.ownerA, USERS.managerA, USERS.ownerB, USERS.stranger]) {
      await assertFails(getDoc(doc(as(uid), `accountDeletions/${USERS.ownerA}`)));
      await assertFails(getDocs(collection(as(uid), 'accountDeletions')));
      await assertFails(setDoc(doc(as(uid), `accountDeletions/${uid}`), { uid, status: 'purged' }));
    }
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `accountDeletions/${USERS.ownerA}`)));
  });
});

describe('shop đang xóa (status deleting)', () => {
  it('trước khi đánh dấu: thành viên đọc được (đối chứng)', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}`)));
    await assertSucceeds(getDoc(doc(as(USERS.managerA), `shops/${SHOP_A}/orders/order-1`)));
  });

  it('thành viên còn sót không đọc được shop và MỌI collection con', async () => {
    await markDeleting(SHOP_A);
    for (const uid of [USERS.ownerA, USERS.managerA, USERS.packerA, USERS.viewerA]) {
      const db = as(uid);
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}`)));
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}/members/${uid}`)));
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1`)));
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1/packages/pkg-1`)));
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}/sessions/session-1`)));
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}/evidence/evidence-1`)));
      await assertFails(getDocs(collection(db, `shops/${SHOP_A}/orders`)));
    }
    await assertFails(getDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}/auditEvents/audit-1`)));
  });

  it('thành viên còn sót không ghi được (tạo đơn, sửa phiên, khai báo bằng chứng)', async () => {
    await markDeleting(SHOP_A);
    const db = as(USERS.ownerA);
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/orders/order-new`), {
        shopId: SHOP_A,
        orderCode: 'DH900',
        orderCodeNormalized: 'DH900',
        source: 'shopee',
        status: 'new',
        dataSource: 'user_entered',
        createdAt: serverTimestamp(),
        createdBy: USERS.ownerA,
        rev: 1,
      }),
    );
    await assertFails(
      updateDoc(doc(db, `shops/${SHOP_A}/sessions/session-1`), { status: 'ended' }),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/evidence-new`), {
        shopId: SHOP_A,
        sessionId: 'session-1',
        orderId: 'order-1',
        packageId: 'pkg-1',
        kind: 'original_video',
        origin: 'in_app_capture',
        clientFileState: 'queued',
        sha256Client: 'b'.repeat(64),
        sizeBytes: 2048,
        mimeType: 'video/mp4',
        capturedAtDevice: Timestamp.now(),
        createdAtServer: serverTimestamp(),
        createdBy: USERS.ownerA,
      }),
    );
    await assertFails(
      updateDoc(doc(db, `shops/${SHOP_A}/evidence/evidence-1`), { clientFileState: 'uploading' }),
    );
    await assertFails(updateDoc(doc(db, `shops/${SHOP_A}`), { status: 'active' }));
  });

  it('shop khác không bị ảnh hưởng (QA-11)', async () => {
    await markDeleting(SHOP_A);
    await assertSucceeds(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_B}`)));
    await assertSucceeds(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_B}/orders/order-1`)));
    await assertFails(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_A}/orders/order-1`)));
  });
});

describe('evidenceReverify (V1-04, không mở cho client)', () => {
  it('thành viên cùng shop không đọc, không ghi; chủ shop khác không đọc', async () => {
    for (const uid of [USERS.ownerA, USERS.managerA, USERS.packerA]) {
      const db = as(uid);
      await assertFails(getDoc(doc(db, `shops/${SHOP_A}/evidenceReverify/evidence-1`)));
      await assertFails(getDocs(collection(db, `shops/${SHOP_A}/evidenceReverify`)));
      await assertFails(
        setDoc(doc(db, `shops/${SHOP_A}/evidenceReverify/evidence-1`), {
          requestedAt: serverTimestamp(),
          requestedBy: uid,
          count: 1,
        }),
      );
      await assertFails(
        setDoc(doc(db, `shops/${SHOP_A}/evidenceReverify/evidence-2`), { requestedBy: uid }),
      );
    }
    await assertFails(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_A}/evidenceReverify/evidence-1`)));
  });
});
