import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { AUDITED_ENTITIES } from '../../functions/src/audit';
import {
  handleReverifyRequest,
  isNewReverifyRequest,
  requestReverify,
  REVERIFY_AFTER_MS,
  REVERIFY_LEASE_MS,
  reverifyRequestPath,
  type EvidenceReverifier,
} from '../../functions/src/reverify';
import { createUploadSessionForUser, type UploadUrlSigner } from '../../functions/src/uploads';

// Xác minh lại bằng chứng kẹt (review PR #44 vòng 2): callable chỉ đặt yêu cầu có giữ chỗ; trigger
// riêng băm lại bằng đúng hàm của verifyEvidence. Chạy trên Firestore Emulator.
let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'reverify-fn-test');
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});

const bytes = Buffer.from('ban-goc-da-nhan');
const sha = createHash('sha256').update(bytes).digest('hex');
const NOW = 10_000_000_000;
let counter = 0;

const existingObject: UploadUrlSigner = {
  objectExists: async () => true,
  signResumableStart: async () => {
    throw new Error('không được ký URL khi bản gốc đã có');
  },
};

/** Bằng chứng do `uid` khai báo, máy chủ đã nhận `receivedAgoMs` trước (null = chưa có trạng thái). */
async function stuck(receivedAgoMs: number | null, server: Record<string, unknown> = {}) {
  counter += 1;
  const shopId = `shop-rv-${Date.now()}-${counter}`;
  const uid = `u-rv-${counter}`;
  const evidenceId = `ev-rv-${counter}`;
  await db.doc(`shops/${shopId}/members/${uid}`).set({ roles: ['packer'], status: 'active' });
  await db.doc(`shops/${shopId}/evidence/${evidenceId}`).set({
    shopId,
    kind: 'original_video',
    mimeType: 'video/mp4',
    sha256Client: sha,
    sizeBytes: bytes.length,
    createdBy: uid,
    ...(receivedAgoMs === null
      ? {}
      : {
          server: {
            state: 'uploaded',
            receivedAt: Timestamp.fromMillis(NOW - receivedAgoMs),
            generation: '7',
            ...server,
          },
        }),
  });
  return { shopId, uid, evidenceId };
}

const requestOf = async (s: { shopId: string; evidenceId: string }) =>
  (await db.doc(reverifyRequestPath(s.shopId, s.evidenceId)).get()).data();
const evidenceOf = async (s: { shopId: string; evidenceId: string }) =>
  (await db.doc(`shops/${s.shopId}/evidence/${s.evidenceId}`).get()).data();
const auditOf = async (shopId: string) =>
  (await db.collection(`shops/${shopId}/auditEvents`).get()).docs.map((d) => d.data());

function reverifierOf(
  content: Buffer | Error,
  info: { generation?: string; sizeBytes?: number; updatedAtMs?: number } | null = {
    generation: '7',
    sizeBytes: bytes.length,
    updatedAtMs: NOW - REVERIFY_AFTER_MS - 1,
  },
) {
  const opened: (string | undefined)[] = [];
  const reverifier: EvidenceReverifier = {
    objectInfo: async () => info,
    open: (_path, generation) => {
      opened.push(generation);
      if (content instanceof Error) {
        return new Readable({
          read() {
            this.destroy(content);
          },
        });
      }
      return Readable.from([content]);
    },
  };
  return { reverifier, opened };
}

describe('createUploadSession chỉ đặt yêu cầu (không băm trong callable)', () => {
  it('kẹt quá 15 phút: trả already_received ngay, đặt đúng một yêu cầu; gọi lặp/đồng thời không thêm yêu cầu', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const before = await evidenceOf(s);
    const results = await Promise.all(
      [0, 1].map(() => createUploadSessionForUser(db, existingObject, s.uid, s, NOW)),
    );
    for (const r of results) expect(r.status).toBe('already_received');
    expect(
      (await createUploadSessionForUser(db, existingObject, s.uid, s, NOW + 1000)).status,
    ).toBe('already_received');
    await createUploadSessionForUser(db, existingObject, s.uid, s, NOW + REVERIFY_LEASE_MS - 1);
    const request = await requestOf(s);
    expect(request).toMatchObject({ requestedBy: s.uid, count: 1 });
    expect((request?.requestedAt as Timestamp).toMillis()).toBe(NOW);
    // Tài liệu bằng chứng KHÔNG đổi: trigger kiểm toán của bằng chứng không bị nhiễu.
    expect(await evidenceOf(s)).toEqual(before);
    expect(await auditOf(s.shopId)).toEqual([]);
    // Yêu cầu chỉ chứa giờ, uid, số lần (không PII, không đường dẫn).
    expect(Object.keys(request ?? {}).sort()).toEqual(['count', 'requestedAt', 'requestedBy']);
  }, 60_000);

  it('hết giữ chỗ 30 phút: gọi lại đặt yêu cầu mới (trigger chạy lại được)', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    await createUploadSessionForUser(db, existingObject, s.uid, s, NOW);
    await createUploadSessionForUser(db, existingObject, s.uid, s, NOW + REVERIFY_LEASE_MS);
    expect(await requestOf(s)).toMatchObject({ count: 2 });
  });

  it('đã chốt, hoặc mới nhận chưa tới 15 phút: không đặt yêu cầu', async () => {
    const final = await stuck(REVERIFY_AFTER_MS + 1, { state: 'verified' });
    const recent = await stuck(60_000);
    expect(await requestReverify(db, final.shopId, final.evidenceId, final.uid, NOW)).toBe('final');
    expect(await requestReverify(db, recent.shopId, recent.evidenceId, recent.uid, NOW)).toBe(
      'too_recent',
    );
    await createUploadSessionForUser(db, existingObject, recent.uid, recent, NOW);
    expect(await requestOf(final)).toBeUndefined();
    expect(await requestOf(recent)).toBeUndefined();
  });

  it('chưa có trạng thái máy chủ mà đối tượng đã có: đặt yêu cầu (trigger tự kiểm tuổi đối tượng)', async () => {
    const s = await stuck(null);
    await createUploadSessionForUser(db, existingObject, s.uid, s, NOW);
    expect(await requestOf(s)).toMatchObject({ count: 1 });
  });

  it('tài khoản khác không đặt được yêu cầu', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    await db.doc(`shops/${s.shopId}/members/u-khac`).set({ roles: ['packer'], status: 'active' });
    await expect(
      createUploadSessionForUser(db, existingObject, 'u-khac', s, NOW),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await requestOf(s)).toBeUndefined();
  });

  it('đường dẫn yêu cầu nằm ngoài các đường dẫn trigger kiểm toán', () => {
    const path = reverifyRequestPath('{shopId}', '{evidenceId}');
    expect(Object.values(AUDITED_ENTITIES)).not.toContain(path);
    expect(path.startsWith('shops/{shopId}/')).toBe(true);
  });
});

describe('trigger reverifyEvidence: băm lại bằng đúng hàm của verifyEvidence', () => {
  it('nội dung khớp: verified + kiểm toán; luồng đọc ghim đúng generation; chạy lại không nhân đôi', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const r = reverifierOf(bytes);
    expect(
      (await handleReverifyRequest(db, r.reverifier, s.shopId, s.evidenceId, NOW)).outcome,
    ).toBe('verified');
    expect(r.opened).toEqual(['7']);
    expect((await evidenceOf(s))?.server).toMatchObject({ state: 'verified', sha256Server: sha });
    expect(
      (await handleReverifyRequest(db, reverifierOf(bytes).reverifier, s.shopId, s.evidenceId, NOW))
        .outcome,
    ).toBe('already_final');
    expect(await auditOf(s.shopId)).toEqual([
      expect.objectContaining({ type: 'evidence.verified', actor: 'system:verifyEvidence' }),
    ]);
  });

  it('nội dung khác khai báo: hash_mismatch, không bao giờ verified', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    await handleReverifyRequest(
      db,
      reverifierOf(Buffer.from('khac')).reverifier,
      s.shopId,
      s.evidenceId,
      NOW,
    );
    const server = (await evidenceOf(s))?.server;
    expect(server.state).toBe('hash_mismatch');
    expect(server.verifiedAt).toBeUndefined();
  });

  it('đối tượng không còn hoặc mới ghi: không băm, giữ uploaded', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const gone = reverifierOf(bytes, null);
    expect(
      (await handleReverifyRequest(db, gone.reverifier, s.shopId, s.evidenceId, NOW)).outcome,
    ).toBe('object_missing');
    const fresh = reverifierOf(bytes, { generation: '8', updatedAtMs: NOW - 1000 });
    expect(
      (await handleReverifyRequest(db, fresh.reverifier, s.shopId, s.evidenceId, NOW)).outcome,
    ).toBe('object_too_recent');
    expect([...gone.opened, ...fresh.opened]).toEqual([]);
    expect((await evidenceOf(s))?.server.state).toBe('uploaded');
  });

  it('lỗi đọc: ném (trigger không tự thử lại), giữ uploaded; lần yêu cầu sau xác minh được', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    await expect(
      handleReverifyRequest(
        db,
        reverifierOf(Object.assign(new Error('reset'), { code: 'ECONNRESET' })).reverifier,
        s.shopId,
        s.evidenceId,
        NOW,
      ),
    ).rejects.toThrow('reset');
    expect((await evidenceOf(s))?.server.state).toBe('uploaded');
    await handleReverifyRequest(db, reverifierOf(bytes).reverifier, s.shopId, s.evidenceId, NOW);
    expect((await evidenceOf(s))?.server.state).toBe('verified');
  });

  it('chỉ chạy khi giờ yêu cầu đổi (yêu cầu mới), không chạy khi xóa hay ghi khác', () => {
    const at = (ms: number) => Timestamp.fromMillis(ms);
    expect(isNewReverifyRequest(undefined, { requestedAt: at(1) })).toBe(true);
    expect(isNewReverifyRequest({ requestedAt: at(1) }, { requestedAt: at(2) })).toBe(true);
    expect(isNewReverifyRequest({ requestedAt: at(1) }, { requestedAt: at(1), count: 3 })).toBe(
      false,
    );
    expect(isNewReverifyRequest({ requestedAt: at(1) }, undefined)).toBe(false);
  });
});
