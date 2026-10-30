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
      request(SHOP_A, { durationMs: null, kind: 'photo', mimeType: 'image/jpeg' }),
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
          createdBy: USERS.packerA,
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

// V1-07b (Q-24g, v1 một máy một tài khoản): chỉ người tạo phiên/bản neo khai báo bằng chứng của nó.
describe('người khai báo: người tạo phiên (đóng gói) hoặc người tạo media (hàng hoàn) (V1-07b)', () => {
  const returnRequest = (shopId: string, overrides: Record<string, unknown> = {}) =>
    request(shopId, {
      owner: { kind: 'return', returnId: 'ret-v7b' },
      kind: 'photo',
      mimeType: 'image/jpeg',
      durationMs: null,
      ...overrides,
    });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Bản neo do packerA tạo; phiên session-ownerA do ownerA tạo (cùng đơn/kiện nền).
      await setDoc(doc(db, `shops/${SHOP_A}/returns/ret-v7b`), {
        shopId: SHOP_A,
        code: 'RH-00002',
        dataSource: 'user_entered',
        createdAtDevice: Timestamp.now(),
        createdAt: Timestamp.now(),
        createdBy: USERS.packerA,
      });
      await setDoc(doc(db, `shops/${SHOP_A}/sessions/session-ownerA`), {
        shopId: SHOP_A,
        kind: 'packing',
        orderId: 'order-1',
        packageId: 'pkg-1',
        orderSnapshot: { orderCode: 'DH001', source: 'shopee', lines: [] },
        status: 'confirmed',
        startedAtDevice: Timestamp.now(),
        startedAtServer: Timestamp.now(),
        createdBy: USERS.ownerA,
      });
      // Phiên không rõ người tạo (dữ liệu lỗi): không ai khai báo được.
      await setDoc(doc(db, `shops/${SHOP_A}/sessions/session-no-creator`), {
        shopId: SHOP_A,
        kind: 'packing',
        orderId: 'order-1',
        packageId: 'pkg-1',
        orderSnapshot: { orderCode: 'DH001', source: 'shopee', lines: [] },
        status: 'confirmed',
        startedAtDevice: Timestamp.now(),
        startedAtServer: Timestamp.now(),
      });
    });
  });

  const declare = (uid: string, req: never) => {
    const w = evidenceWrite(req, uid, values);
    return setDoc(doc(as(uid), w.path), w.data);
  };

  it('đúng người tạo phiên khai báo được (packer và cả chủ shop với phiên của chính mình)', async () => {
    await assertSucceeds(declare(USERS.packerA, request(SHOP_A)));
    await assertSucceeds(
      declare(
        USERS.ownerA,
        request(SHOP_A, {
          evidenceId: 'ev-owner',
          owner: packingOwner({ sessionId: 'session-ownerA' }),
        }),
      ),
    );
  });

  it('thành viên khác cùng shop (chủ, quản lý) không khai báo được cho phiên của packer', async () => {
    for (const uid of [USERS.ownerA, USERS.managerA]) {
      await assertFails(declare(uid, request(SHOP_A)));
    }
  });

  it('packer không khai báo được cho phiên do chủ shop tạo, hay phiên không rõ người tạo', async () => {
    await assertFails(
      declare(
        USERS.packerA,
        request(SHOP_A, { owner: packingOwner({ sessionId: 'session-ownerA' }) }),
      ),
    );
    for (const uid of [USERS.packerA, USERS.ownerA]) {
      await assertFails(
        declare(uid, request(SHOP_A, { owner: packingOwner({ sessionId: 'session-no-creator' }) })),
      );
    }
  });

  it('người ngoài shop (chủ shop B, tài khoản không thuộc shop nào) không khai báo được', async () => {
    for (const uid of [USERS.ownerB, USERS.stranger]) {
      await assertFails(declare(uid, request(SHOP_A)));
      await assertFails(declare(uid, returnRequest(SHOP_A)));
    }
  });

  it('phiên không tồn tại bị từ chối với mọi người', async () => {
    for (const uid of [USERS.packerA, USERS.ownerA]) {
      await assertFails(
        declare(uid, request(SHOP_A, { owner: packingOwner({ sessionId: 'khong-co' }) })),
      );
    }
  });

  it('hàng hoàn: media là đơn vị sở hữu; thành viên khác cùng shop khai báo được media CỦA MÌNH trong hồ sơ có bản neo do người khác tạo (review PR #64)', async () => {
    // Bản neo ret-v7b do packerA tạo; chủ shop/quản lý chụp thêm ảnh rồi khai báo ảnh của chính họ.
    await assertSucceeds(declare(USERS.packerA, returnRequest(SHOP_A)));
    for (const uid of [USERS.ownerA, USERS.managerA]) {
      await assertSucceeds(declare(uid, returnRequest(SHOP_A, { evidenceId: `ev-${uid}` })));
    }
  });

  it('khai báo thay người khác (createdBy = tài khoản khác) bị từ chối, cả hàng hoàn và đóng gói', async () => {
    const forReturn = evidenceWrite(
      returnRequest(SHOP_A, { evidenceId: 'ev-mao-danh' }),
      USERS.packerA,
      values,
    );
    await assertFails(setDoc(doc(as(USERS.ownerA), forReturn.path), forReturn.data));
    const forPacking = evidenceWrite(
      request(SHOP_A, { evidenceId: 'ev-mao-danh-2' }),
      USERS.packerA,
      values,
    );
    await assertFails(setDoc(doc(as(USERS.ownerA), forPacking.path), forPacking.data));
  });

  it('hàng hoàn: media của người khác không cập nhật được, kể cả người tạo bản neo', async () => {
    const w = evidenceWrite(
      returnRequest(SHOP_A, { evidenceId: 'ev-cua-owner' }),
      USERS.ownerA,
      values,
    );
    await assertSucceeds(setDoc(doc(as(USERS.ownerA), w.path), w.data));
    await assertSucceeds(
      updateDoc(doc(as(USERS.ownerA), w.path), { clientFileState: 'uploading' }),
    );
    for (const uid of [USERS.packerA, USERS.managerA, USERS.ownerB]) {
      await assertFails(updateDoc(doc(as(uid), w.path), { clientFileState: 'upload_failed' }));
    }
  });

  it('hàng hoàn: bản neo không tồn tại bị từ chối', async () => {
    await assertFails(
      declare(
        USERS.packerA,
        returnRequest(SHOP_A, { owner: { kind: 'return', returnId: 'khong-co' } }),
      ),
    );
  });

  it('cập nhật trạng thái phía thiết bị chỉ người đã khai báo; thành viên khác cùng shop bị từ chối', async () => {
    const path = `shops/${SHOP_A}/evidence/evidence-1`; // nền: packerA khai báo
    await assertSucceeds(updateDoc(doc(as(USERS.packerA), path), { clientFileState: 'uploading' }));
    for (const uid of [USERS.ownerA, USERS.managerA, USERS.ownerB, USERS.stranger]) {
      await assertFails(updateDoc(doc(as(uid), path), { clientFileState: 'upload_failed' }));
    }
  });
});
