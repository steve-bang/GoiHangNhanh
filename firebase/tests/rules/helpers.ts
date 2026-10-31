import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'demo-doncung';

export const SHOP_A = 'shop-a';
export const SHOP_B = 'shop-b';

/** Người dùng mẫu. UID tách biệt với vai trò để test quyền theo shop. */
export const USERS = {
  ownerA: 'u-owner-a',
  managerA: 'u-manager-a',
  packerA: 'u-packer-a',
  returnsA: 'u-returns-a',
  viewerA: 'u-viewer-a',
  revokedA: 'u-revoked-a',
  ownerB: 'u-owner-b',
  stranger: 'u-stranger', // đăng nhập nhưng không thuộc shop nào
} as const;

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const root = resolve(__dirname, '../..');
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(root, 'storage.rules'), 'utf8') },
  });
}

/** Dữ liệu nền (bỏ qua Rules): hai shop, mỗi shop có thành viên, đơn, kiện, phiên, bằng chứng. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const member = (shop: string, uid: string, roles: string[], status = 'active') =>
      setDoc(doc(db, `shops/${shop}/members/${uid}`), { roles, status });

    await member(SHOP_A, USERS.ownerA, ['owner']);
    await member(SHOP_A, USERS.managerA, ['manager']);
    await member(SHOP_A, USERS.packerA, ['packer']);
    await member(SHOP_A, USERS.returnsA, ['returns_staff']);
    await member(SHOP_A, USERS.viewerA, ['viewer']);
    await member(SHOP_A, USERS.revokedA, ['packer'], 'revoked');
    await member(SHOP_B, USERS.ownerB, ['owner']);

    for (const shop of [SHOP_A, SHOP_B]) {
      const now = Timestamp.now();
      await setDoc(doc(db, `shops/${shop}`), { name: shop });
      await setDoc(doc(db, `shops/${shop}/orders/order-1`), {
        shopId: shop,
        orderCode: 'DH001',
        orderCodeNormalized: 'dh001',
        source: 'shopee',
        status: 'new',
        dataSource: 'user_entered',
        createdAt: now,
        createdBy: 'seed',
        rev: 1,
      });
      await setDoc(doc(db, `shops/${shop}/orders/order-1/packages/pkg-1`), {
        shopId: shop,
        orderId: 'order-1',
        index: 1,
        createdAt: now,
        createdBy: 'seed',
      });
      await setDoc(doc(db, `shops/${shop}/orders/order-1/packages/pkg-2`), {
        shopId: shop,
        orderId: 'order-1',
        index: 2,
        createdAt: now,
        createdBy: 'seed',
      });
      await setDoc(doc(db, `shops/${shop}/orders/order-2/packages/pkg-9`), {
        shopId: shop,
        orderId: 'order-2',
        index: 1,
        createdAt: now,
        createdBy: 'seed',
      });
      await setDoc(doc(db, `shops/${shop}/orders/order-2`), {
        shopId: shop,
        orderCode: 'DH002',
        orderCodeNormalized: 'dh002',
        source: 'lazada',
        status: 'new',
        dataSource: 'user_entered',
        createdAt: now,
        createdBy: 'seed',
        rev: 1,
      });
      await setDoc(doc(db, `shops/${shop}/sessions/session-1`), {
        shopId: shop,
        kind: 'packing',
        orderId: 'order-1',
        packageId: 'pkg-1',
        orderSnapshot: { orderCode: 'DH001', source: 'shopee', lines: [] },
        status: 'recording',
        startedAtDevice: now,
        startedAtServer: now,
        // V1-07b: chỉ người tạo phiên khai báo/cập nhật bằng chứng của phiên; nền dùng packerA của mỗi
        // shop (shop B không có packerA nên chỉ dùng để thử truy cập chéo shop).
        createdBy: USERS.packerA,
      });
      await setDoc(doc(db, `shops/${shop}/evidence/evidence-1`), {
        shopId: shop,
        sessionId: 'session-1',
        orderId: 'order-1',
        packageId: 'pkg-1',
        kind: 'original_video',
        origin: 'in_app_capture',
        clientFileState: 'queued',
        sha256Client: 'a'.repeat(64),
        sizeBytes: 1024,
        mimeType: 'video/mp4',
        capturedAtDevice: now,
        createdAtServer: now,
        createdBy: USERS.packerA,
      });
      await setDoc(doc(db, `shops/${shop}/auditEvents/audit-1`), {
        shopId: shop,
        action: 'order.created',
        entityId: 'order-1',
      });
    }
  });
}
