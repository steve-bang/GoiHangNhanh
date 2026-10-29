import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import {
  hashStream,
  parseEvidencePath,
  verifyEvidenceObject,
  type EvidenceObjectReader,
} from '../../functions/src/evidence';

// Chạy trên Firestore Emulator (FIRESTORE_EMULATOR_HOST do `firebase emulators:exec` đặt).
let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'evidence-fn-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let counter = 0;

/** Tạo tài liệu bằng chứng như client khai báo (đã đóng tệp, trạng thái queued). */
async function declare(bytes: Buffer, overrides: Record<string, unknown> = {}) {
  counter += 1;
  const shopId = `shop-ev-${Date.now()}-${counter}`;
  const evidenceId = `ev-${counter}`;
  await db.doc(`shops/${shopId}/evidence/${evidenceId}`).set({
    shopId,
    sessionId: 's1',
    orderId: 'o1',
    packageId: 'p1',
    kind: 'original_video',
    origin: 'in_app_capture',
    clientFileState: 'uploading',
    sha256Client: sha(bytes),
    sizeBytes: bytes.length,
    mimeType: 'video/mp4',
    ...overrides,
  });
  return { shopId, evidenceId, path: `shops/${shopId}/evidence/${evidenceId}/original` };
}

const readerOf = (bytes: Buffer): EvidenceObjectReader => ({
  open: () => Readable.from([bytes.subarray(0, 3), bytes.subarray(3)]),
});

const evidenceOf = async (shopId: string, evidenceId: string) =>
  (await db.doc(`shops/${shopId}/evidence/${evidenceId}`).get()).data();
const auditOf = async (shopId: string) =>
  (await db.collection(`shops/${shopId}/auditEvents`).get()).docs.map((d) => d.data());

describe('parseEvidencePath', () => {
  it('chỉ nhận đường dẫn bản gốc', () => {
    expect(parseEvidencePath('shops/s1/evidence/e1/original')).toEqual({
      shopId: 's1',
      evidenceId: 'e1',
    });
    for (const other of [
      'shops/s1/evidence/e1/derived/d1',
      'shops/s1/exports/x/file.zip',
      'shops/s1/evidence/e1/original/extra',
      'evidence/e1/original',
      '',
    ]) {
      expect(parseEvidencePath(other)).toBeNull();
    }
  });
});

describe('hashStream', () => {
  it('tính SHA-256 và số byte theo từng mảnh', async () => {
    const bytes = Buffer.from('noi dung video');
    expect(await hashStream(Readable.from([bytes.subarray(0, 4), bytes.subarray(4)]))).toEqual({
      sha256: sha(bytes),
      sizeBytes: bytes.length,
    });
  });
});

describe('verifyEvidenceObject', () => {
  const bytes = Buffer.from('video-goc-0123456789');

  it('bằng chứng hàng hoàn (Q-28, không có phiên/đơn/kiện): cùng đường dẫn, băm lại phía máy chủ, verified + kiểm toán', async () => {
    counter += 1;
    const shopId = `shop-ev-${Date.now()}-${counter}`;
    const evidenceId = `ev-ret-${counter}`;
    await db.doc(`shops/${shopId}/evidence/${evidenceId}`).set({
      shopId,
      ownerKind: 'return',
      returnId: 'ret-1',
      kind: 'photo',
      origin: 'in_app_capture',
      clientFileState: 'uploading',
      sha256Client: sha(bytes),
      sizeBytes: bytes.length,
      mimeType: 'image/jpeg',
    });
    const path = `shops/${shopId}/evidence/${evidenceId}/original`;
    expect(await verifyEvidenceObject(db, readerOf(bytes), path)).toEqual({ outcome: 'verified' });
    expect((await evidenceOf(shopId, evidenceId))?.server).toMatchObject({
      state: 'verified',
      sha256Server: sha(bytes),
    });
    expect(await auditOf(shopId)).toEqual([
      expect.objectContaining({ type: 'evidence.verified', evidenceId }),
    ]);
  });

  it('bằng chứng hàng hoàn có nội dung khác khai báo: hash_mismatch, không bao giờ verified', async () => {
    counter += 1;
    const shopId = `shop-ev-${Date.now()}-${counter}`;
    const evidenceId = `ev-ret-${counter}`;
    await db.doc(`shops/${shopId}/evidence/${evidenceId}`).set({
      shopId,
      ownerKind: 'return',
      returnId: 'ret-1',
      kind: 'original_video',
      origin: 'in_app_capture',
      clientFileState: 'uploading',
      sha256Client: sha(Buffer.from('khac')),
      sizeBytes: bytes.length,
      mimeType: 'video/mp4',
    });
    const path = `shops/${shopId}/evidence/${evidenceId}/original`;
    expect(await verifyEvidenceObject(db, readerOf(bytes), path)).toMatchObject({
      outcome: 'hash_mismatch',
      reason: 'sha256_differs',
    });
    expect((await evidenceOf(shopId, evidenceId))?.server.state).toBe('hash_mismatch');
  });

  it('khớp mã băm và kích thước: server.state = verified, có mã băm máy chủ và một sự kiện kiểm toán', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    expect(await verifyEvidenceObject(db, readerOf(bytes), path)).toEqual({ outcome: 'verified' });
    const doc = await evidenceOf(shopId, evidenceId);
    expect(doc?.server).toMatchObject({
      state: 'verified',
      sha256Server: sha(bytes),
      sizeBytesServer: bytes.length,
      storagePath: path,
    });
    expect(doc?.server.verifiedAt).toBeDefined();
    expect(doc?.server.receivedAt).toBeDefined();
    expect(await auditOf(shopId)).toEqual([
      expect.objectContaining({ type: 'evidence.verified', evidenceId, actorUid: null }),
    ]);
  });

  it('mã băm khai báo viết hoa vẫn khớp', async () => {
    const { shopId, evidenceId, path } = await declare(bytes, {
      sha256Client: sha(bytes).toUpperCase(),
    });
    expect((await verifyEvidenceObject(db, readerOf(bytes), path)).outcome).toBe('verified');
    expect((await evidenceOf(shopId, evidenceId))?.server.state).toBe('verified');
  });

  it('nội dung khác với khai báo: hash_mismatch, KHÔNG verifiedAt, có kiểm toán lý do', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    const tampered = Buffer.from('video-goc-0123456780');
    expect(await verifyEvidenceObject(db, readerOf(tampered), path)).toEqual({
      outcome: 'hash_mismatch',
      reason: 'sha256_differs',
    });
    const doc = await evidenceOf(shopId, evidenceId);
    expect(doc?.server.state).toBe('hash_mismatch');
    expect(doc?.server.verifiedAt).toBeUndefined();
    expect(doc?.server.sha256Server).toBe(sha(tampered));
    expect(await auditOf(shopId)).toEqual([
      expect.objectContaining({ type: 'evidence.hash_mismatch', reason: 'sha256_differs' }),
    ]);
  });

  it('kích thước lệch khai báo dù băm khớp: hash_mismatch size_differs', async () => {
    const { path } = await declare(bytes, { sizeBytes: bytes.length + 1 });
    expect(await verifyEvidenceObject(db, readerOf(bytes), path)).toEqual({
      outcome: 'hash_mismatch',
      reason: 'size_differs',
    });
  });

  it('khai báo hỏng (thiếu mã băm hoặc kích thước): không bao giờ verified', async () => {
    const { path } = await declare(bytes, { sha256Client: null });
    expect(await verifyEvidenceObject(db, readerOf(bytes), path)).toEqual({
      outcome: 'hash_mismatch',
      reason: 'invalid_declaration',
    });
  });

  it('chạy lặp không đổi kết quả và không nhân đôi kiểm toán', async () => {
    const { shopId, path } = await declare(bytes);
    await verifyEvidenceObject(db, readerOf(bytes), path);
    expect((await verifyEvidenceObject(db, readerOf(bytes), path)).outcome).toBe('already_final');
    expect(await auditOf(shopId)).toHaveLength(1);
  });

  it('hash_mismatch đã chốt thì chạy lại với nội dung đúng cũng không thành verified', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    await verifyEvidenceObject(db, readerOf(Buffer.from('khac')), path);
    expect((await verifyEvidenceObject(db, readerOf(bytes), path)).outcome).toBe('already_final');
    expect((await evidenceOf(shopId, evidenceId))?.server.state).toBe('hash_mismatch');
  });

  it('chưa có tài liệu khai báo (tệp mồ côi): không tạo gì', async () => {
    const path = 'shops/shop-mo-coi/evidence/ev-x/original';
    expect((await verifyEvidenceObject(db, readerOf(bytes), path)).outcome).toBe(
      'no_evidence_document',
    );
    expect((await db.doc('shops/shop-mo-coi/evidence/ev-x').get()).exists).toBe(false);
    expect(await auditOf('shop-mo-coi')).toEqual([]);
  });

  it('đường dẫn không phải bản gốc bị bỏ qua', async () => {
    const { shopId, evidenceId } = await declare(bytes);
    const derived = `shops/${shopId}/evidence/${evidenceId}/derived/preview`;
    expect((await verifyEvidenceObject(db, readerOf(bytes), derived)).outcome).toBe('ignored_path');
    expect((await evidenceOf(shopId, evidenceId))?.server).toBeUndefined();
  });

  it('lỗi đọc Storage: ném lỗi, giữ uploaded để thử lại, rồi lần sau xác minh được', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    const broken: EvidenceObjectReader = {
      open: () =>
        new Readable({
          read() {
            this.destroy(new Error('network'));
          },
        }),
    };
    await expect(verifyEvidenceObject(db, broken, path)).rejects.toThrow('network');
    expect((await evidenceOf(shopId, evidenceId))?.server.state).toBe('uploaded');
    expect(await auditOf(shopId)).toEqual([]);
    expect((await verifyEvidenceObject(db, readerOf(bytes), path)).outcome).toBe('verified');
  });

  it('finalize lần hai với generation khác sau khi đã verified: cách ly hash_mismatch + kiểm toán, giữ băm cũ', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    expect((await verifyEvidenceObject(db, readerOf(bytes), path, '1001')).outcome).toBe(
      'verified',
    );
    const replaced = Buffer.from('noi-dung-bi-ghi-de');
    const result = await verifyEvidenceObject(db, readerOf(replaced), path, '1002');
    expect(result.outcome).toBe('original_overwritten');
    const doc = await evidenceOf(shopId, evidenceId);
    expect(doc?.server).toMatchObject({
      state: 'hash_mismatch',
      generation: '1002',
      overwrittenFromGeneration: '1001',
      previous: { state: 'verified', generation: '1001', sha256Server: sha(bytes) },
    });
    // Bản cũ không còn nằm cạnh hash_mismatch như thể còn đúng.
    expect(doc?.server).not.toHaveProperty('sha256Server');
    expect(doc?.server).not.toHaveProperty('sizeBytesServer');
    expect(doc?.server).not.toHaveProperty('verifiedAt');
    expect(doc?.server.previous).toHaveProperty('verifiedAt');
    expect(doc?.server.previous.sizeBytesServer).toBe(bytes.length);
    expect(await auditOf(shopId)).toEqual([
      expect.objectContaining({ type: 'evidence.verified' }),
      expect.objectContaining({
        type: 'evidence.original_overwritten',
        evidenceId,
        previousState: 'verified',
      }),
    ]);
    // Chạy lại đúng sự kiện đó: không nhân đôi kiểm toán.
    expect((await verifyEvidenceObject(db, readerOf(replaced), path, '1002')).outcome).toBe(
      'already_final',
    );
    expect(await auditOf(shopId)).toHaveLength(2);
  });

  it('finalize lặp với CÙNG generation sau verified vẫn là already_final (không báo ghi đè)', async () => {
    const { shopId, path } = await declare(bytes);
    await verifyEvidenceObject(db, readerOf(bytes), path, '2001');
    expect((await verifyEvidenceObject(db, readerOf(bytes), path, '2001')).outcome).toBe(
      'already_final',
    );
    expect(await auditOf(shopId)).toHaveLength(1);
  });

  it('finalize CŨ giao lặp/đến muộn sau finalize mới (generation nhỏ hơn): already_final, không đảo generation, không kiểm toán thừa', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    await verifyEvidenceObject(db, readerOf(bytes), path, '9');
    const replaced = Buffer.from('ban-moi');
    expect((await verifyEvidenceObject(db, readerOf(replaced), path, '10')).outcome).toBe(
      'original_overwritten', // so số, không so chuỗi: '10' > '9'
    );
    expect((await verifyEvidenceObject(db, readerOf(bytes), path, '9')).outcome).toBe(
      'already_final',
    );
    const doc = await evidenceOf(shopId, evidenceId);
    expect(doc?.server).toMatchObject({ state: 'hash_mismatch', generation: '10' });
    expect(await auditOf(shopId)).toHaveLength(2);
  });

  it('hai finalize chồng nhau khi chưa chốt: bản đã băm mà generation lệch KHÔNG được chốt', async () => {
    const { shopId, evidenceId, path } = await declare(bytes);
    const newer = Buffer.from('ban-moi-hon');
    let streamed = false;
    // Finalize generation 1 đang băm thì finalize generation 2 chen vào bước 1 (ghi nhận generation đang xét).
    const slow: EvidenceObjectReader = {
      open: () =>
        new Readable({
          read() {
            if (streamed) return;
            streamed = true;
            void db
              .doc(`shops/${shopId}/evidence/${evidenceId}`)
              .update({ 'server.generation': '2' })
              .then(() => {
                this.push(bytes);
                this.push(null);
              });
          },
        }),
    };
    const first = await verifyEvidenceObject(db, slow, path, '1');
    expect(first.outcome).toBe('superseded');
    // Chưa chốt gì cho generation 1 (dù băm khớp khai báo); không kiểm toán.
    const doc = await evidenceOf(shopId, evidenceId);
    expect(doc?.server).toMatchObject({ state: 'uploaded', generation: '2' });
    expect(doc?.server).not.toHaveProperty('verifiedAt');
    expect(await auditOf(shopId)).toEqual([]);
    // Finalize của generation 2 tự chốt theo nội dung đã băm của nó.
    expect((await verifyEvidenceObject(db, readerOf(newer), path, '2')).outcome).toBe(
      'hash_mismatch',
    );
    expect(await auditOf(shopId)).toHaveLength(1);
  });

  it('finalize cũ đến muộn khi generation mới hơn đang được xét: superseded, không hạ generation', async () => {
    // Dựng trạng thái chưa chốt ở generation 8, rồi finalize generation 7 đến muộn.
    const other = await declare(bytes);
    await db.doc(`shops/${other.shopId}/evidence/${other.evidenceId}`).update({
      server: { state: 'uploaded', generation: '8', storagePath: other.path },
    });
    expect((await verifyEvidenceObject(db, readerOf(bytes), other.path, '7')).outcome).toBe(
      'superseded',
    );
    const doc = await evidenceOf(other.shopId, other.evidenceId);
    expect(doc?.server).toMatchObject({ state: 'uploaded', generation: '8' });
    expect(await auditOf(other.shopId)).toEqual([]);
  });

  it('shop khác cùng evidenceId không bị ảnh hưởng (cô lập theo đường dẫn)', async () => {
    const a = await declare(bytes);
    const b = await declare(bytes);
    await verifyEvidenceObject(db, readerOf(bytes), a.path);
    expect((await evidenceOf(b.shopId, b.evidenceId))?.server).toBeUndefined();
  });
});
