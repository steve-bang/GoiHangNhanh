import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import {
  createUploadSessionForUser,
  parseUploadSessionInput,
  UPLOAD_URL_TTL_MS,
  UploadError,
  type UploadUrlSigner,
} from '../../functions/src/uploads';

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'uploads-fn-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

let counter = 0;

function fakeSigner(existing = false) {
  const signed: { path: string; contentType: string; expiresAtMs: number }[] = [];
  const signer: UploadUrlSigner = {
    objectExists: async () => existing,
    signResumableStart: async (path, contentType, expiresAtMs) => {
      signed.push({ path, contentType, expiresAtMs });
      return `https://signed.example/${path}?sig=x`;
    },
  };
  return { signer, signed };
}

async function seed(options: {
  roles?: string[];
  status?: string;
  evidence?: Record<string, unknown> | null;
}) {
  counter += 1;
  const shopId = `shop-up-${Date.now()}-${counter}`;
  const uid = `u-${counter}`;
  const evidenceId = `ev-${counter}`;
  await db.doc(`shops/${shopId}/members/${uid}`).set({
    roles: options.roles ?? ['packer'],
    status: options.status ?? 'active',
  });
  if (options.evidence !== null) {
    await db.doc(`shops/${shopId}/evidence/${evidenceId}`).set({
      shopId,
      mimeType: 'video/mp4',
      sha256Client: 'a'.repeat(64),
      sizeBytes: 10,
      ...options.evidence,
    });
  }
  return { shopId, uid, evidenceId };
}

const audit = async (shopId: string) =>
  (await db.collection(`shops/${shopId}/auditEvents`).get()).docs.map((d) => d.data());

describe('parseUploadSessionInput', () => {
  it('nhận mã hợp lệ và từ chối mã có ký tự đường dẫn hoặc rỗng', () => {
    expect(parseUploadSessionInput({ shopId: 's_1', evidenceId: 'e-1' })).toEqual({
      shopId: 's_1',
      evidenceId: 'e-1',
    });
    for (const bad of [
      null,
      {},
      { shopId: 's', evidenceId: '' },
      { shopId: '../x', evidenceId: 'e' },
      { shopId: 's', evidenceId: 'a/b' },
      { shopId: 5, evidenceId: 'e' },
    ]) {
      expect(() => parseUploadSessionInput(bad)).toThrow(UploadError);
    }
  });
});

describe('createUploadSessionForUser', () => {
  it('cấp URL ký cho đường dẫn do máy chủ dựng, giới hạn Content-Type, thời hạn 15 phút, có kiểm toán', async () => {
    const { shopId, uid, evidenceId } = await seed({});
    const { signer, signed } = fakeSigner();
    const result = await createUploadSessionForUser(db, signer, uid, { shopId, evidenceId }, 1_000);
    const path = `shops/${shopId}/evidence/${evidenceId}/original`;
    expect(result).toEqual({
      status: 'ready',
      storagePath: path,
      url: `https://signed.example/${path}?sig=x`,
      method: 'POST',
      headers: { 'x-goog-resumable': 'start', 'Content-Type': 'video/mp4' },
      expiresAtMs: 1_000 + UPLOAD_URL_TTL_MS,
    });
    expect(signed).toEqual([
      { path, contentType: 'video/mp4', expiresAtMs: 1_000 + UPLOAD_URL_TTL_MS },
    ]);
    const events = await audit(shopId);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'evidence.upload_session_created',
        actorUid: uid,
        evidenceId,
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain('signed.example');
  });

  it.each([['owner'], ['manager'], ['packer']])('vai trò %s được tải', async (role) => {
    const { shopId, uid, evidenceId } = await seed({ roles: [role] });
    const r = await createUploadSessionForUser(db, fakeSigner().signer, uid, {
      shopId,
      evidenceId,
    });
    expect(r.status).toBe('ready');
  });

  it('không phải thành viên, thành viên bị khóa, hoặc vai trò không được phép: permission-denied', async () => {
    const base = await seed({});
    const cases = [
      { uid: 'nguoi-la', shopId: base.shopId },
      { ...(await seed({ status: 'suspended' })) },
      { ...(await seed({ roles: ['dispute_handler'] })) },
    ];
    for (const c of cases) {
      await expect(
        createUploadSessionForUser(db, fakeSigner().signer, c.uid ?? 'nguoi-la', {
          shopId: c.shopId,
          evidenceId: base.evidenceId,
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }
  });

  it('thành viên shop A không tải được cho shop B dù đoán đúng ID (cô lập shop)', async () => {
    const a = await seed({});
    const b = await seed({});
    await expect(
      createUploadSessionForUser(db, fakeSigner().signer, a.uid, {
        shopId: b.shopId,
        evidenceId: b.evidenceId,
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('chưa khai báo bằng chứng: not-found, không ký', async () => {
    const { shopId, uid, evidenceId } = await seed({ evidence: null });
    const { signer, signed } = fakeSigner();
    await expect(
      createUploadSessionForUser(db, signer, uid, { shopId, evidenceId }),
    ).rejects.toMatchObject({ code: 'not-found' });
    expect(signed).toEqual([]);
  });

  it('đã có đối tượng trong Storage hoặc đã có trạng thái máy chủ: không cấp URL (bản gốc tạo một lần)', async () => {
    const existing = await seed({});
    const signerExisting = fakeSigner(true);
    expect(
      await createUploadSessionForUser(db, signerExisting.signer, existing.uid, existing),
    ).toMatchObject({ status: 'already_received' });
    expect(signerExisting.signed).toEqual([]);

    const served = await seed({ evidence: { server: { state: 'verified' } } });
    const signerServed = fakeSigner();
    expect(
      await createUploadSessionForUser(db, signerServed.signer, served.uid, served),
    ).toMatchObject({ status: 'already_received' });
    expect(signerServed.signed).toEqual([]);
    expect(await audit(served.shopId)).toEqual([]);
  });

  it('loại tệp không nằm trong danh sách cho phép: failed-precondition, không ký', async () => {
    for (const mimeType of ['application/zip', null, 5]) {
      const s = await seed({ evidence: { mimeType } });
      const { signer, signed } = fakeSigner();
      await expect(createUploadSessionForUser(db, signer, s.uid, s)).rejects.toMatchObject({
        code: 'failed-precondition',
      });
      expect(signed).toEqual([]);
    }
  });
});
