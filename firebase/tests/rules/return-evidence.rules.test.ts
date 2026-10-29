import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';

// Bản neo hồ sơ hàng hoàn (`returns`) và bằng chứng hàng hoàn (Q-28): cô lập theo shop, client không
// đặt được trạng thái máy chủ, hồ sơ chưa liên kết đơn vẫn hợp lệ.
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
  // Hồ sơ hoàn "return-1" đã đăng ở cả hai shop (bỏ qua Rules). KHÔNG có đơn gốc nào liên quan.
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const shop of [SHOP_A, SHOP_B]) {
      await setDoc(doc(ctx.firestore(), `shops/${shop}/returns/return-1`), {
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

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const validReturn = (uid: string, overrides: Record<string, unknown> = {}) => ({
  shopId: SHOP_A,
  code: 'RH-00007',
  dataSource: 'user_entered',
  createdAtDevice: Timestamp.now(),
  createdAt: serverTimestamp(),
  createdBy: uid,
  ...overrides,
});

const validPhoto = (uid: string, overrides: Record<string, unknown> = {}) => ({
  shopId: SHOP_A,
  ownerKind: 'return',
  returnId: 'return-1',
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

const validVideo = (uid: string, overrides: Record<string, unknown> = {}) =>
  validPhoto(uid, {
    kind: 'original_video',
    mimeType: 'video/mp4',
    durationMs: 45_000,
    sizeBytes: 9_000_000,
    ...overrides,
  });

const evidencePath = (id: string, shop = SHOP_A) => `shops/${shop}/evidence/${id}`;

describe('returns: bản neo hồ sơ hàng hoàn', () => {
  it.each([[USERS.ownerA], [USERS.managerA], [USERS.packerA]])(
    'thành viên %s tạo được bản neo của shop mình (không cần đơn gốc)',
    async (uid) => {
      await assertSucceeds(
        setDoc(doc(as(uid), `shops/${SHOP_A}/returns/return-new`), validReturn(uid)),
      );
    },
  );

  it('người xem, người bị thu hồi, người lạ và chưa đăng nhập không tạo được', async () => {
    for (const uid of [USERS.viewerA, USERS.revokedA, USERS.stranger]) {
      await assertFails(
        setDoc(doc(as(uid), `shops/${SHOP_A}/returns/return-new`), validReturn(uid)),
      );
    }
    await assertFails(
      setDoc(doc(anon(), `shops/${SHOP_A}/returns/return-new`), validReturn('anon')),
    );
  });

  it('chéo shop: chủ shop B không ghi vào shop A, kể cả khi khai báo shopId của A', async () => {
    await assertFails(
      setDoc(
        doc(as(USERS.ownerB), `shops/${SHOP_A}/returns/return-new`),
        validReturn(USERS.ownerB),
      ),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.ownerA), `shops/${SHOP_B}/returns/return-new`),
        validReturn(USERS.ownerA, { shopId: SHOP_B }),
      ),
    );
    // Khai báo shopId khác với đường dẫn cũng bị từ chối.
    await assertFails(
      setDoc(
        doc(as(USERS.ownerA), `shops/${SHOP_A}/returns/return-new`),
        validReturn(USERS.ownerA, { shopId: SHOP_B }),
      ),
    );
  });

  it('chéo shop: không đọc được bản neo của shop khác dù đoán đúng ID', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.packerA), `shops/${SHOP_A}/returns/return-1`)));
    await assertFails(getDoc(doc(as(USERS.ownerB), `shops/${SHOP_A}/returns/return-1`)));
    await assertFails(getDoc(doc(as(USERS.stranger), `shops/${SHOP_A}/returns/return-1`)));
    await assertFails(getDoc(doc(anon(), `shops/${SHOP_A}/returns/return-1`)));
    await assertFails(getDocs(collection(as(USERS.ownerB), `shops/${SHOP_A}/returns`)));
  });

  it('không giả người tạo, không dùng giờ của client thay giờ máy chủ', async () => {
    const db = as(USERS.packerA);
    const path = `shops/${SHOP_A}/returns/return-new`;
    await assertFails(setDoc(doc(db, path), validReturn(USERS.managerA)));
    await assertFails(
      setDoc(doc(db, path), validReturn(USERS.packerA, { createdAt: Timestamp.now() })),
    );
    await assertFails(setDoc(doc(db, path), validReturn(USERS.packerA, { createdAtDevice: 5 })));
  });

  it('chỉ nhận đúng tập khóa: thiếu, thừa (đơn gốc, trạng thái, vị trí) đều bị từ chối', async () => {
    const db = as(USERS.packerA);
    const path = `shops/${SHOP_A}/returns/return-new`;
    const { code: _code, ...withoutCode } = validReturn(USERS.packerA);
    await assertFails(setDoc(doc(db, path), withoutCode));
    for (const extra of [
      { sourceOrderId: 'order-1' },
      { status: 'confirmed' },
      { lat: 10.1, lng: 106.2 },
      { exterior: { signs: ['intact'] } },
    ]) {
      await assertFails(setDoc(doc(db, path), validReturn(USERS.packerA, extra)));
    }
    await assertSucceeds(
      setDoc(doc(db, path), validReturn(USERS.packerA, { appVersion: '1.0.0' })),
    );
  });

  it('nhãn hiển thị phải là chuỗi 1-32 ký tự; nguồn dữ liệu luôn user_entered', async () => {
    const db = as(USERS.packerA);
    const path = `shops/${SHOP_A}/returns/return-new`;
    await assertFails(setDoc(doc(db, path), validReturn(USERS.packerA, { code: '' })));
    await assertFails(setDoc(doc(db, path), validReturn(USERS.packerA, { code: 'x'.repeat(33) })));
    await assertFails(setDoc(doc(db, path), validReturn(USERS.packerA, { code: 7 })));
    await assertFails(
      setDoc(doc(db, path), validReturn(USERS.packerA, { dataSource: 'marketplace_api' })),
    );
  });

  it('bất biến: không ai sửa hoặc xóa được bản neo, kể cả chủ shop', async () => {
    const db = as(USERS.ownerA);
    await assertFails(updateDoc(doc(db, `shops/${SHOP_A}/returns/return-1`), { code: 'RH-99999' }));
    await assertFails(deleteDoc(doc(db, `shops/${SHOP_A}/returns/return-1`)));
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/returns/return-1`), validReturn(USERS.ownerA)),
    );
  });
});

describe('evidence hàng hoàn: khai báo', () => {
  it('khai báo được ảnh và video khi bản neo hồ sơ đã có; hồ sơ không cần liên kết đơn', async () => {
    const db = as(USERS.packerA);
    await assertSucceeds(setDoc(doc(db, evidencePath('ph-1')), validPhoto(USERS.packerA)));
    await assertSucceeds(setDoc(doc(db, evidencePath('vid-1')), validVideo(USERS.packerA)));
    await assertSucceeds(
      setDoc(
        doc(db, evidencePath('ph-2')),
        validPhoto(USERS.packerA, { mimeType: 'image/png', appVersion: '1.0.0' }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(db, evidencePath('vid-2')),
        validVideo(USERS.packerA, { mimeType: 'video/quicktime' }),
      ),
    );
  });

  it('bản neo chưa đăng (hoặc đoán ID) thì bị từ chối', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(doc(db, evidencePath('ph-x')), validPhoto(USERS.packerA, { returnId: 'chua-dang' })),
    );
  });

  it('chéo shop: bản neo của shop khác không dùng được; shop khác không khai báo vào shop mình', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `shops/${SHOP_B}/returns/only-in-b`), {
        shopId: SHOP_B,
        code: 'RH-00002',
        dataSource: 'user_entered',
        createdAtDevice: Timestamp.now(),
        createdAt: Timestamp.now(),
        createdBy: 'seed',
      });
    });
    const a = as(USERS.packerA);
    // Hồ sơ chỉ tồn tại ở shop B: khai báo ở shop A không được trỏ tới nó.
    await assertFails(
      setDoc(doc(a, evidencePath('ph-x')), validPhoto(USERS.packerA, { returnId: 'only-in-b' })),
    );
    // Chủ shop B ghi vào shop A (đúng hay giả shopId) đều bị từ chối.
    await assertFails(
      setDoc(doc(as(USERS.ownerB), evidencePath('ph-y')), validPhoto(USERS.ownerB)),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.ownerB), evidencePath('ph-y', SHOP_B)),
        validPhoto(USERS.ownerB, { shopId: SHOP_A }),
      ),
    );
  });

  it('người xem, người bị thu hồi, người lạ không khai báo được', async () => {
    for (const uid of [USERS.viewerA, USERS.revokedA, USERS.stranger]) {
      await assertFails(setDoc(doc(as(uid), evidencePath('ph-z')), validPhoto(uid)));
    }
    await assertFails(setDoc(doc(anon(), evidencePath('ph-z')), validPhoto('anon')));
  });

  it('giữ nguyên các ràng buộc chung: người tạo, giờ máy chủ, đã đóng tệp, nguồn', async () => {
    const db = as(USERS.packerA);
    const bad: Record<string, unknown>[] = [
      { createdBy: USERS.managerA },
      { createdAtServer: Timestamp.now() },
      { capturedAtDevice: 1_700_000_000_000 },
      { origin: 'library_import' },
      { clientFileState: 'saving_local' },
      { sha256Client: 'abc' },
      { sha256Client: 5 },
    ];
    for (const overrides of bad) {
      await assertFails(
        setDoc(doc(db, evidencePath('ph-b')), validPhoto(USERS.packerA, overrides)),
      );
    }
  });

  it('client không đặt được trạng thái do máy chủ sở hữu khi khai báo', async () => {
    const db = as(USERS.packerA);
    for (const state of ['uploaded', 'verified', 'hash_mismatch']) {
      await assertFails(
        setDoc(
          doc(db, evidencePath('ph-s')),
          validPhoto(USERS.packerA, { clientFileState: state }),
        ),
      );
    }
    await assertFails(
      setDoc(
        doc(db, evidencePath('ph-s')),
        validPhoto(USERS.packerA, { server: { state: 'verified', verifiedAt: Timestamp.now() } }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, evidencePath('ph-s')),
        validPhoto(USERS.packerA, { retention: { hold: false } }),
      ),
    );
  });

  it('kiểu tệp và kích thước: ảnh chỉ ảnh, video chỉ video; kích thước là số nguyên dương', async () => {
    const db = as(USERS.packerA);
    const bad: Record<string, unknown>[] = [
      { mimeType: 'application/zip' },
      { mimeType: 'video/mp4' }, // ảnh mà mime video
      { mimeType: 5 },
      { sizeBytes: 0 },
      { sizeBytes: -1 },
      { sizeBytes: 1.5 },
      { sizeBytes: '4096' },
      { kind: 'thumbnail' }, // bản dẫn xuất: chỉ máy chủ
      { kind: 'derived_video' },
    ];
    for (const overrides of bad) {
      await assertFails(
        setDoc(doc(db, evidencePath('ph-f')), validPhoto(USERS.packerA, overrides)),
      );
    }
    await assertFails(
      setDoc(doc(db, evidencePath('vid-f')), validVideo(USERS.packerA, { mimeType: 'image/jpeg' })),
    );
    await assertFails(
      setDoc(doc(db, evidencePath('vid-f')), validVideo(USERS.packerA, { durationMs: -5 })),
    );
    await assertFails(
      setDoc(doc(db, evidencePath('vid-f')), validVideo(USERS.packerA, { durationMs: 1.5 })),
    );
  });

  it('chỉ đúng tập khóa: không kèm phiên/đơn/kiện, không thiếu returnId, không ownerKind lạ', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(
        doc(db, evidencePath('ph-k')),
        validPhoto(USERS.packerA, {
          sessionId: 'session-1',
          orderId: 'order-1',
          packageId: 'pkg-1',
        }),
      ),
    );
    await assertFails(
      setDoc(doc(db, evidencePath('ph-k')), validPhoto(USERS.packerA, { orderId: 'order-1' })),
    );
    const { returnId: _returnId, ...withoutReturn } = validPhoto(USERS.packerA);
    await assertFails(setDoc(doc(db, evidencePath('ph-k')), withoutReturn));
    await assertFails(
      setDoc(doc(db, evidencePath('ph-k')), validPhoto(USERS.packerA, { ownerKind: 'order' })),
    );
    await assertFails(
      setDoc(doc(db, evidencePath('ph-k')), validPhoto(USERS.packerA, { returnId: 5 })),
    );
  });

  it('không dùng hình dạng đóng gói để lách: ownerKind lạ hoặc mime sai bị từ chối', async () => {
    const db = as(USERS.packerA);
    const packing = {
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
      createdBy: USERS.packerA,
    };
    await assertSucceeds(setDoc(doc(db, evidencePath('pk-1')), packing));
    await assertFails(setDoc(doc(db, evidencePath('pk-2')), { ...packing, ownerKind: 'return' }));
    await assertFails(
      setDoc(doc(db, evidencePath('pk-3')), { ...packing, mimeType: 'application/zip' }),
    );
  });
});

describe('evidence hàng hoàn: sau khi khai báo', () => {
  beforeEach(async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.packerA), evidencePath('ph-1')), validPhoto(USERS.packerA)),
    );
  });

  it('tạo một lần: ghi đè tài liệu đã có (đổi mã băm, hồ sơ, kích thước) bị từ chối', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(
        doc(db, evidencePath('ph-1')),
        validPhoto(USERS.packerA, { sha256Client: 'e'.repeat(64) }),
      ),
    );
    await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { sha256Client: 'e'.repeat(64) }));
    await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { sizeBytes: 1 }));
    await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { returnId: 'return-2' }));
    await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { createdBy: USERS.ownerA }));
  });

  it('client chỉ đổi được trạng thái phía thiết bị; không đặt uploaded/verified/hash_mismatch/server', async () => {
    const db = as(USERS.packerA);
    await assertSucceeds(
      updateDoc(doc(db, evidencePath('ph-1')), { clientFileState: 'uploading' }),
    );
    await assertSucceeds(
      updateDoc(doc(db, evidencePath('ph-1')), {
        clientFileState: 'upload_failed',
        lastError: 'NETWORK',
        retryCount: 2,
      }),
    );
    for (const state of ['uploaded', 'verified', 'hash_mismatch']) {
      await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { clientFileState: state }));
    }
    await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { 'server.state': 'verified' }));
    await assertFails(updateDoc(doc(db, evidencePath('ph-1')), { server: { state: 'verified' } }));
  });

  it('không ai xóa được; người xem và người lạ không sửa được', async () => {
    await assertFails(deleteDoc(doc(as(USERS.ownerA), evidencePath('ph-1'))));
    await assertFails(deleteDoc(doc(as(USERS.packerA), evidencePath('ph-1'))));
    await assertFails(
      updateDoc(doc(as(USERS.viewerA), evidencePath('ph-1')), { clientFileState: 'uploading' }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.ownerB), evidencePath('ph-1')), { clientFileState: 'uploading' }),
    );
  });

  it('chéo shop: không đọc được bằng chứng hàng hoàn của shop khác dù đoán ID', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.viewerA), evidencePath('ph-1'))));
    await assertFails(getDoc(doc(as(USERS.ownerB), evidencePath('ph-1'))));
    await assertFails(getDocs(collection(as(USERS.ownerB), `shops/${SHOP_A}/evidence`)));
    await assertFails(getDoc(doc(anon(), evidencePath('ph-1'))));
  });
});
