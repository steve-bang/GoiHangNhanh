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
  writeBatch,
} from 'firebase/firestore';

import { createTestEnv, SHOP_A, SHOP_B, seed, USERS } from './helpers';

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

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// ---------------------------------------------------------------------------
// QA-11 - Truy cập chéo shop
// ---------------------------------------------------------------------------
describe('QA-11 cô lập theo shop', () => {
  it('chưa đăng nhập: không đọc/ghi được gì', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1`)));
    await assertFails(getDocs(collection(db, `shops/${SHOP_A}/orders`)));
    await assertFails(setDoc(doc(db, `shops/${SHOP_A}/orders/x`), { a: 1 }));
  });

  it('thành viên shop A đọc được dữ liệu shop A', async () => {
    const db = as(USERS.packerA);
    await assertSucceeds(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1`)));
    await assertSucceeds(getDocs(collection(db, `shops/${SHOP_A}/orders`)));
    await assertSucceeds(getDoc(doc(db, `shops/${SHOP_A}/evidence/evidence-1`)));
    await assertSucceeds(getDoc(doc(db, `shops/${SHOP_A}/sessions/session-1`)));
  });

  it.each([
    ['orders/order-1'],
    ['orders/order-1/packages/pkg-1'],
    ['sessions/session-1'],
    ['evidence/evidence-1'],
    ['members/' + USERS.ownerB],
  ])('shop A đoán đúng ID %s của shop B vẫn bị từ chối (cả chủ shop)', async (path) => {
    await assertFails(getDoc(doc(as(USERS.packerA), `shops/${SHOP_B}/${path}`)));
    await assertFails(getDoc(doc(as(USERS.ownerA), `shops/${SHOP_B}/${path}`)));
  });

  it('shop A không liệt kê được collection của shop B', async () => {
    const db = as(USERS.ownerA);
    await assertFails(getDocs(collection(db, `shops/${SHOP_B}/orders`)));
    await assertFails(getDocs(collection(db, `shops/${SHOP_B}/evidence`)));
    await assertFails(getDocs(collection(db, `shops/${SHOP_B}/auditEvents`)));
  });

  it('shop A không ghi được vào shop B (tạo, sửa, xóa)', async () => {
    const db = as(USERS.ownerA);
    await assertFails(updateDoc(doc(db, `shops/${SHOP_B}/orders/order-1`), { note: 'x', rev: 2 }));
    await assertFails(deleteDoc(doc(db, `shops/${SHOP_B}/orders/order-1`)));
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_B}/orders/new`), validOrder(SHOP_B, USERS.ownerA)),
    );
  });

  it('không thể mạo shopId của shop B trong tài liệu tạo ở shop A', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/orders/new`), {
        ...validOrder(SHOP_A, USERS.packerA),
        shopId: SHOP_B,
      }),
    );
  });

  it('người dùng đăng nhập nhưng không thuộc shop nào bị từ chối hoàn toàn', async () => {
    const db = as(USERS.stranger);
    await assertFails(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1`)));
    await assertFails(getDoc(doc(db, `shops/${SHOP_A}`)));
  });

  it('thành viên đã bị thu hồi mất quyền ngay', async () => {
    const db = as(USERS.revokedA);
    await assertFails(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1`)));
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/orders/new`), validOrder(SHOP_A, USERS.revokedA)),
    );
  });

  it('không liệt kê được danh sách shop; chỉ đọc được shop mình thuộc về', async () => {
    await assertFails(getDocs(collection(as(USERS.ownerA), 'shops')));
    await assertSucceeds(getDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}`)));
    await assertFails(getDoc(doc(as(USERS.ownerA), `shops/${SHOP_B}`)));
  });

  it('đường dẫn ngoài mô hình bị từ chối mặc định (ví dụ disputes chưa có rule)', async () => {
    const db = as(USERS.ownerA);
    await assertFails(getDoc(doc(db, `shops/${SHOP_A}/disputes/d1`)));
    await assertFails(setDoc(doc(db, `shops/${SHOP_A}/disputes/d1`), { a: 1 }));
    await assertFails(getDoc(doc(db, 'users/anyone')));
  });
});

// ---------------------------------------------------------------------------
// Thành viên và vai trò
// ---------------------------------------------------------------------------
describe('thành viên và vai trò', () => {
  it('client không tự nâng quyền hoặc tự thêm mình làm thành viên', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.packerA), `shops/${SHOP_A}/members/${USERS.packerA}`), {
        roles: ['owner'],
      }),
    );
    await assertFails(
      setDoc(doc(as(USERS.stranger), `shops/${SHOP_A}/members/${USERS.stranger}`), {
        roles: ['owner'],
        status: 'active',
      }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}/members/${USERS.packerA}`), {
        status: 'revoked',
      }),
    );
  });

  it('người chỉ xem đọc được nhưng không tạo/sửa đơn', async () => {
    const db = as(USERS.viewerA);
    await assertSucceeds(getDoc(doc(db, `shops/${SHOP_A}/orders/order-1`)));
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/orders/new`), validOrder(SHOP_A, USERS.viewerA)),
    );
    await assertFails(
      updateDoc(doc(db, `shops/${SHOP_A}/orders/order-1`), {
        note: 'x',
        updatedAt: serverTimestamp(),
        updatedBy: USERS.viewerA,
        rev: 2,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Đơn hàng
// ---------------------------------------------------------------------------
describe('đơn hàng', () => {
  it('nhân viên đóng gói tạo đơn hợp lệ (nguồn user_entered)', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(USERS.packerA), `shops/${SHOP_A}/orders/new`),
        validOrder(SHOP_A, USERS.packerA),
      ),
    );
  });

  it('tạo lại cùng ID (thử lại) không ghi đè được dữ liệu đã có', async () => {
    // Lần 2 là một update; update đòi rev+1 và updatedAt nên bản tạo-lại bị từ chối.
    const db = as(USERS.packerA);
    await assertSucceeds(
      setDoc(doc(db, `shops/${SHOP_A}/orders/new`), validOrder(SHOP_A, USERS.packerA)),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/orders/new`), validOrder(SHOP_A, USERS.packerA)),
    );
  });

  it('client không tạo được dữ liệu giả làm nguồn đồng bộ từ sàn', async () => {
    await assertFails(
      setDoc(doc(as(USERS.packerA), `shops/${SHOP_A}/orders/new`), {
        ...validOrder(SHOP_A, USERS.packerA),
        dataSource: 'synced',
      }),
    );
  });

  it('từ chối: thời gian tạo do client đặt, người tạo giả, rev sai, nguồn bán lạ, trường thừa', async () => {
    const db = as(USERS.packerA);
    const base = validOrder(SHOP_A, USERS.packerA);
    const bad = [
      { ...base, createdAt: Timestamp.fromDate(new Date('2020-01-01')) },
      { ...base, createdBy: USERS.ownerA },
      { ...base, rev: 5 },
      { ...base, source: 'amazon' },
      { ...base, extraField: true },
      { ...base, orderCode: '' },
    ];
    for (const [i, data] of bad.entries()) {
      await assertFails(setDoc(doc(db, `shops/${SHOP_A}/orders/bad-${i}`), data));
    }
  });

  it('cập nhật cần rev tăng đúng 1; bản cũ (xung đột) bị từ chối', async () => {
    const db = as(USERS.packerA);
    const ref = doc(db, `shops/${SHOP_A}/orders/order-1`);
    const patch = (rev: number) => ({
      note: 'ghi chú',
      updatedAt: serverTimestamp(),
      updatedBy: USERS.packerA,
      rev,
    });
    await assertSucceeds(updateDoc(ref, patch(2)));
    // Thiết bị khác vẫn dựa trên rev=1 và gửi rev=2 lần nữa -> xung đột, không ghi đè âm thầm.
    await assertFails(updateDoc(ref, patch(2)));
    await assertFails(updateDoc(ref, patch(5)));
    await assertSucceeds(updateDoc(ref, patch(3)));
  });

  it('không đổi được trường bất biến (shopId, createdBy, dataSource, createdAt)', async () => {
    const db = as(USERS.packerA);
    const ref = doc(db, `shops/${SHOP_A}/orders/order-1`);
    const meta = { updatedAt: serverTimestamp(), updatedBy: USERS.packerA, rev: 2 };
    await assertFails(updateDoc(ref, { ...meta, shopId: SHOP_B }));
    await assertFails(updateDoc(ref, { ...meta, createdBy: USERS.packerA }));
    await assertFails(updateDoc(ref, { ...meta, dataSource: 'synced' }));
    await assertFails(updateDoc(ref, { ...meta, createdAt: serverTimestamp() }));
  });

  it('không ai xóa được đơn (hủy đơn là đổi trạng thái)', async () => {
    await assertFails(deleteDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}/orders/order-1`)));
  });

  it('dòng sản phẩm: số lượng nguyên >= 1, nguồn user_entered; không xóa', async () => {
    const db = as(USERS.packerA);
    const line = (qty: unknown) => ({
      shopId: SHOP_A,
      orderId: 'order-1',
      name: 'Áo thun cotton',
      variant: 'Đen / XL',
      quantity: qty,
      dataSource: 'user_entered',
      createdAt: serverTimestamp(),
      createdBy: USERS.packerA,
    });
    await assertSucceeds(setDoc(doc(db, `shops/${SHOP_A}/orders/order-1/lines/l1`), line(2)));
    // Hai variant của cùng sản phẩm là hai dòng riêng (không gộp).
    await assertSucceeds(
      setDoc(doc(db, `shops/${SHOP_A}/orders/order-1/lines/l2`), {
        ...line(1),
        variant: 'Trắng / L',
      }),
    );
    await assertFails(setDoc(doc(db, `shops/${SHOP_A}/orders/order-1/lines/l3`), line(0)));
    await assertFails(setDoc(doc(db, `shops/${SHOP_A}/orders/order-1/lines/l4`), line(1.5)));
    await assertFails(deleteDoc(doc(db, `shops/${SHOP_A}/orders/order-1/lines/l1`)));
  });
});

// ---------------------------------------------------------------------------
// Phiên ghi nhận
// ---------------------------------------------------------------------------
describe('phiên ghi nhận', () => {
  it('tạo phiên gắn đúng đơn + kiện; thời gian máy chủ do rules ép', async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.packerA), `shops/${SHOP_A}/sessions/s-new`), validSession(USERS.packerA)),
    );
  });

  it('từ chối phiên có kiện không thuộc đơn (liên kết không hợp lệ)', async () => {
    const db = as(USERS.packerA);
    // pkg-9 thuộc order-2, không phải order-1.
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/sessions/s-bad`), {
        ...validSession(USERS.packerA),
        orderId: 'order-1',
        packageId: 'pkg-9',
      }),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/sessions/s-bad2`), {
        ...validSession(USERS.packerA),
        packageId: 'does-not-exist',
      }),
    );
  });

  it('chuyển sang đơn khác không đổi liên kết của phiên trước (orderId/packageId/ảnh chụp bất biến)', async () => {
    const db = as(USERS.packerA);
    const ref = doc(db, `shops/${SHOP_A}/sessions/session-1`);
    await assertFails(updateDoc(ref, { orderId: 'order-2' }));
    await assertFails(updateDoc(ref, { packageId: 'pkg-2' }));
    await assertFails(updateDoc(ref, { orderSnapshot: { orderCode: 'DH-KHAC' } }));
    await assertFails(updateDoc(ref, { startedAtServer: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: 'interrupted' }));
    await assertFails(updateDoc(ref, { status: 'verified' }));
  });

  it('không xóa được phiên; người chỉ xem không tạo được phiên', async () => {
    await assertFails(deleteDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}/sessions/session-1`)));
    await assertFails(
      setDoc(doc(as(USERS.viewerA), `shops/${SHOP_A}/sessions/s-new`), validSession(USERS.viewerA)),
    );
  });

  it('tạo đơn + kiện + phiên trong cùng một batch (luồng ngoại tuyến) được chấp nhận', async () => {
    const db = as(USERS.packerA);
    const batch = writeBatch(db);
    batch.set(doc(db, `shops/${SHOP_A}/orders/o-batch`), validOrder(SHOP_A, USERS.packerA));
    batch.set(doc(db, `shops/${SHOP_A}/orders/o-batch/packages/p-batch`), {
      shopId: SHOP_A,
      orderId: 'o-batch',
      index: 1,
      createdAt: serverTimestamp(),
      createdBy: USERS.packerA,
    });
    batch.set(doc(db, `shops/${SHOP_A}/sessions/s-batch`), {
      ...validSession(USERS.packerA),
      orderId: 'o-batch',
      packageId: 'p-batch',
    });
    await assertSucceeds(batch.commit());
  });
});

// ---------------------------------------------------------------------------
// Bằng chứng: client không tự xác lập trạng thái do máy chủ sở hữu
// ---------------------------------------------------------------------------
describe('bằng chứng', () => {
  it('tạo bằng chứng đã đóng/đọc được (queued) gắn đúng phiên + đơn + kiện', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(USERS.packerA), `shops/${SHOP_A}/evidence/ev-new`),
        validEvidence(USERS.packerA),
      ),
    );
  });

  it.each(['uploaded', 'verified', 'hash_mismatch', 'recording', 'saving_local'])(
    'từ chối tạo với clientFileState=%s',
    async (state) => {
      await assertFails(
        setDoc(doc(as(USERS.packerA), `shops/${SHOP_A}/evidence/ev-x`), {
          ...validEvidence(USERS.packerA),
          clientFileState: state,
        }),
      );
    },
  );

  it('từ chối tạo kèm map `server` giả mạo kết quả xác minh', async () => {
    await assertFails(
      setDoc(doc(as(USERS.packerA), `shops/${SHOP_A}/evidence/ev-x`), {
        ...validEvidence(USERS.packerA),
        server: { state: 'verified', sha256: 'a'.repeat(64) },
      }),
    );
  });

  it('từ chối bằng chứng trỏ phiên khác kiện/đơn (gắn nhầm)', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-x`), {
        ...validEvidence(USERS.packerA),
        packageId: 'pkg-2', // phiên session-1 gắn pkg-1
      }),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-y`), {
        ...validEvidence(USERS.packerA),
        orderId: 'order-2',
      }),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-z`), {
        ...validEvidence(USERS.packerA),
        sessionId: 'khong-ton-tai',
      }),
    );
  });

  it('chỉ nhận bản gốc quay trong app; bản dẫn xuất và nhập thư viện (O-02) bị từ chối', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-d`), {
        ...validEvidence(USERS.packerA),
        kind: 'derived',
      }),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-i`), {
        ...validEvidence(USERS.packerA),
        origin: 'library_import',
      }),
    );
  });

  it('từ chối mã băm sai độ dài và thời gian máy chủ do client tự đặt', async () => {
    const db = as(USERS.packerA);
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-h`), {
        ...validEvidence(USERS.packerA),
        sha256Client: 'abc',
      }),
    );
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-t`), {
        ...validEvidence(USERS.packerA),
        createdAtServer: Timestamp.fromDate(new Date('2020-01-01')),
      }),
    );
  });

  it('client chỉ cập nhật trạng thái phía thiết bị; không đặt uploaded/verified', async () => {
    const ref = doc(as(USERS.packerA), `shops/${SHOP_A}/evidence/evidence-1`);
    await assertSucceeds(updateDoc(ref, { clientFileState: 'uploading' }));
    await assertSucceeds(updateDoc(ref, { clientFileState: 'upload_failed', lastError: 'x' }));
    await assertFails(updateDoc(ref, { clientFileState: 'uploaded' }));
    await assertFails(updateDoc(ref, { clientFileState: 'verified' }));
    await assertFails(updateDoc(ref, { clientFileState: 'hash_mismatch' }));
  });

  it('bản gốc bất biến: không đổi mã băm, liên kết, kích thước; không ghi map `server`; không xóa', async () => {
    const ref = doc(as(USERS.packerA), `shops/${SHOP_A}/evidence/evidence-1`);
    await assertFails(updateDoc(ref, { sha256Client: 'b'.repeat(64) }));
    await assertFails(updateDoc(ref, { sizeBytes: 1 }));
    await assertFails(updateDoc(ref, { packageId: 'pkg-2' }));
    await assertFails(updateDoc(ref, { sessionId: 'session-x' }));
    await assertFails(updateDoc(ref, { server: { state: 'verified' } }));
    await assertFails(updateDoc(ref, { 'server.state': 'verified' }));
    await assertFails(deleteDoc(ref));
    await assertFails(deleteDoc(doc(as(USERS.ownerA), `shops/${SHOP_A}/evidence/evidence-1`)));
  });

  it('người chỉ xem không tạo/sửa bằng chứng', async () => {
    const db = as(USERS.viewerA);
    await assertFails(
      setDoc(doc(db, `shops/${SHOP_A}/evidence/ev-new`), validEvidence(USERS.viewerA)),
    );
    await assertFails(
      updateDoc(doc(db, `shops/${SHOP_A}/evidence/evidence-1`), { clientFileState: 'uploading' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Nhật ký kiểm toán
// ---------------------------------------------------------------------------
describe('nhật ký kiểm toán', () => {
  it('chủ shop/quản lý đọc được; người dùng thường không đọc được', async () => {
    const ref = (uid: string) => doc(as(uid), `shops/${SHOP_A}/auditEvents/audit-1`);
    await assertSucceeds(getDoc(ref(USERS.ownerA)));
    await assertSucceeds(getDoc(ref(USERS.managerA)));
    await assertFails(getDoc(ref(USERS.packerA)));
    await assertFails(getDoc(ref(USERS.viewerA)));
  });

  it('không ai (kể cả chủ shop) tạo, sửa, xóa được từ client', async () => {
    const db = as(USERS.ownerA);
    await assertFails(setDoc(doc(db, `shops/${SHOP_A}/auditEvents/forged`), { action: 'x' }));
    await assertFails(updateDoc(doc(db, `shops/${SHOP_A}/auditEvents/audit-1`), { action: 'y' }));
    await assertFails(deleteDoc(doc(db, `shops/${SHOP_A}/auditEvents/audit-1`)));
  });
});

// ---------------------------------------------------------------------------
// Dữ liệu mẫu hợp lệ
// ---------------------------------------------------------------------------
function validOrder(shopId: string, uid: string) {
  return {
    shopId,
    orderCode: 'DH-NEW',
    orderCodeNormalized: 'dh-new',
    source: 'tiktok_shop',
    status: 'new',
    dataSource: 'user_entered',
    createdAt: serverTimestamp(),
    createdBy: uid,
    rev: 1,
  };
}

function validSession(uid: string) {
  return {
    shopId: SHOP_A,
    kind: 'packing',
    orderId: 'order-1',
    packageId: 'pkg-1',
    orderSnapshot: { orderCode: 'DH001', source: 'shopee', lines: [] },
    status: 'recording',
    startedAtDevice: Timestamp.now(),
    startedAtServer: serverTimestamp(),
    createdBy: uid,
  };
}

function validEvidence(uid: string) {
  return {
    shopId: SHOP_A,
    sessionId: 'session-1',
    orderId: 'order-1',
    packageId: 'pkg-1',
    kind: 'original_video',
    origin: 'in_app_capture',
    clientFileState: 'queued',
    sha256Client: 'c'.repeat(64),
    sizeBytes: 2048,
    durationMs: 12000,
    mimeType: 'video/mp4',
    capturedAtDevice: Timestamp.now(),
    createdAtServer: serverTimestamp(),
    createdBy: uid,
  };
}

// ---------------------------------------------------------------------------
// Chỉ mục userShops: chỉ chủ tài khoản đọc, không client nào ghi
// ---------------------------------------------------------------------------

describe('userShops', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `userShops/${USERS.ownerA}`), { shopId: SHOP_A });
    });
  });

  it('chủ tài khoản đọc được bản của mình', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.ownerA), `userShops/${USERS.ownerA}`)));
  });

  it('người khác và người chưa đăng nhập không đọc được', async () => {
    await assertFails(getDoc(doc(as(USERS.ownerB), `userShops/${USERS.ownerA}`)));
    await assertFails(getDoc(doc(anon(), `userShops/${USERS.ownerA}`)));
  });

  it('không liệt kê được và không client nào ghi/xóa được, kể cả chủ tài khoản', async () => {
    await assertFails(getDocs(collection(as(USERS.ownerA), 'userShops')));
    await assertFails(
      setDoc(doc(as(USERS.ownerA), `userShops/${USERS.ownerA}`), { shopId: SHOP_B }),
    );
    await assertFails(
      setDoc(doc(as(USERS.stranger), `userShops/${USERS.stranger}`), { shopId: SHOP_A }),
    );
    await assertFails(deleteDoc(doc(as(USERS.ownerA), `userShops/${USERS.ownerA}`)));
  });
});
