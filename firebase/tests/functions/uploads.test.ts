import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

import {
  CREATE_ONLY_HEADERS,
  createUploadSessionForUser,
  parseUploadSessionInput,
  REVERIFY_AFTER_MS,
  UPLOAD_URL_TTL_MS,
  type EvidenceReverifier,
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
  const signed: {
    path: string;
    contentType: string;
    expiresAtMs: number;
    extensionHeaders: Readonly<Record<string, string>>;
  }[] = [];
  const signer: UploadUrlSigner = {
    objectExists: async () => existing,
    signResumableStart: async (path, contentType, expiresAtMs, extensionHeaders) => {
      signed.push({ path, contentType, expiresAtMs, extensionHeaders });
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
      kind: 'original_video',
      mimeType: 'video/mp4',
      sha256Client: 'a'.repeat(64),
      sizeBytes: 10,
      createdBy: uid,
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
      headers: {
        'x-goog-resumable': 'start',
        'Content-Type': 'video/mp4',
        'x-goog-if-generation-match': '0',
      },
      expiresAtMs: 1_000 + UPLOAD_URL_TTL_MS,
    });
    expect(signed).toEqual([
      {
        path,
        contentType: 'video/mp4',
        expiresAtMs: 1_000 + UPLOAD_URL_TTL_MS,
        extensionHeaders: { 'x-goog-if-generation-match': '0' },
      },
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

  it('hai lần xin URL liên tiếp trước khi có đối tượng: cả hai đều bị ràng buộc tạo-một-lần trong chữ ký và header trả về', async () => {
    const { shopId, uid, evidenceId } = await seed({});
    const { signer, signed } = fakeSigner();
    const results = [
      await createUploadSessionForUser(db, signer, uid, { shopId, evidenceId }),
      await createUploadSessionForUser(db, signer, uid, { shopId, evidenceId }),
    ];
    expect(signed).toHaveLength(2);
    for (const call of signed) expect(call.extensionHeaders).toEqual(CREATE_ONLY_HEADERS);
    for (const r of results) {
      expect(r.status).toBe('ready');
      if (r.status === 'ready') expect(r.headers).toMatchObject(CREATE_ONLY_HEADERS);
    }
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

  it('bằng chứng hàng hoàn (Q-28): cùng đường dẫn Storage, URL tạo-một-lần, kiểm toán ghi chủ sở hữu', async () => {
    const { shopId, uid, evidenceId } = await seed({
      evidence: {
        ownerKind: 'return',
        returnId: 'ret-1',
        kind: 'photo',
        mimeType: 'image/jpeg',
      },
    });
    await db.doc(`shops/${shopId}/returns/ret-1`).set({ shopId, code: 'RH-00001' });
    const { signer, signed } = fakeSigner();
    const result = await createUploadSessionForUser(db, signer, uid, { shopId, evidenceId });
    const path = `shops/${shopId}/evidence/${evidenceId}/original`;
    expect(result).toMatchObject({
      status: 'ready',
      storagePath: path,
      headers: { 'Content-Type': 'image/jpeg', ...CREATE_ONLY_HEADERS },
    });
    expect(signed).toHaveLength(1);
    expect(signed[0]?.extensionHeaders).toEqual(CREATE_ONLY_HEADERS);
    expect(await audit(shopId)).toEqual([
      expect.objectContaining({
        type: 'evidence.upload_session_created',
        ownerKind: 'return',
        returnId: 'ret-1',
        evidenceId,
      }),
    ]);
  });

  it('bằng chứng hàng hoàn chưa có hồ sơ neo (hoặc hồ sơ ở shop khác): failed-precondition, không ký', async () => {
    const orphan = await seed({
      evidence: { ownerKind: 'return', returnId: 'ret-chua-dang', mimeType: 'image/jpeg' },
    });
    const otherShop = await seed({
      evidence: { ownerKind: 'return', returnId: 'ret-b', mimeType: 'image/jpeg' },
    });
    // Hồ sơ cùng ID nhưng nằm ở shop KHÁC: không được tính.
    await db.doc(`shops/shop-khac/returns/ret-b`).set({ shopId: 'shop-khac' });
    const badId = await seed({
      evidence: { ownerKind: 'return', returnId: '../x', mimeType: 'image/jpeg' },
    });
    for (const s of [orphan, otherShop, badId]) {
      const { signer, signed } = fakeSigner();
      await expect(createUploadSessionForUser(db, signer, s.uid, s)).rejects.toMatchObject({
        code: 'failed-precondition',
      });
      expect(signed).toEqual([]);
    }
  });

  it('bằng chứng hàng hoàn đã có đối tượng: không cấp URL (bản gốc tạo một lần)', async () => {
    const s = await seed({
      evidence: { ownerKind: 'return', returnId: 'ret-1', mimeType: 'image/jpeg' },
    });
    await db.doc(`shops/${s.shopId}/returns/ret-1`).set({ shopId: s.shopId });
    const { signer, signed } = fakeSigner(true);
    expect(await createUploadSessionForUser(db, signer, s.uid, s)).toMatchObject({
      status: 'already_received',
    });
    expect(signed).toEqual([]);
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

  it('bằng chứng do tài khoản khác khai báo (Q-24g): permission-denied, không ký, không kiểm toán', async () => {
    for (const createdBy of ['u-khac', null, '']) {
      const s = await seed({ evidence: { createdBy } });
      const { signer, signed } = fakeSigner();
      await expect(createUploadSessionForUser(db, signer, s.uid, s)).rejects.toMatchObject({
        code: 'permission-denied',
      });
      expect(signed).toEqual([]);
      expect(await audit(s.shopId)).toEqual([]);
    }
  });

  it('trần dung lượng (Q-24c): ảnh 25 000 000 qua, 25 000 001 bị từ chối; video 2 000 000 000 qua, hơn thì từ chối', async () => {
    const ok = [
      { kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 25_000_000 },
      { kind: 'original_video', mimeType: 'video/mp4', sizeBytes: 2_000_000_000 },
    ];
    for (const evidence of ok) {
      const s = await seed({ evidence });
      expect((await createUploadSessionForUser(db, fakeSigner().signer, s.uid, s)).status).toBe(
        'ready',
      );
    }
    const bad = [
      { kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 25_000_001 },
      { kind: 'original_video', mimeType: 'video/mp4', sizeBytes: 2_000_000_001 },
      { sizeBytes: 0 },
      { sizeBytes: 1.5 },
      { sizeBytes: '10' },
      { sizeBytes: null },
    ];
    for (const evidence of bad) {
      const s = await seed({ evidence });
      const { signer, signed } = fakeSigner();
      await expect(createUploadSessionForUser(db, signer, s.uid, s)).rejects.toMatchObject({
        code: 'failed-precondition',
      });
      expect(signed).toEqual([]);
    }
  });
});

describe('xác minh lại bằng chứng kẹt ở uploaded (review PR #44)', () => {
  const bytes = Buffer.from('ban-goc-da-nhan');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const NOW = 10_000_000_000;

  function reverifierOf(
    content: Buffer | Error,
    info: { generation?: string; sizeBytes?: number; updatedAtMs?: number } | null = {
      generation: '7',
      sizeBytes: bytes.length,
      updatedAtMs: NOW - REVERIFY_AFTER_MS - 1,
    },
  ) {
    let opened = 0;
    const reverifier: EvidenceReverifier = {
      objectInfo: async () => info,
      reader: {
        open: () => {
          opened += 1;
          if (content instanceof Error) {
            return new Readable({
              read() {
                this.destroy(content);
              },
            });
          }
          return Readable.from([content]);
        },
      },
    };
    return { reverifier, opened: () => opened };
  }

  const stuck = (receivedAgoMs: number) =>
    seed({
      evidence: {
        sha256Client: sha,
        sizeBytes: bytes.length,
        server: {
          state: 'uploaded',
          receivedAt: Timestamp.fromMillis(NOW - receivedAgoMs),
          generation: '7',
        },
      },
    });

  const serverOf = async (s: { shopId: string; evidenceId: string }) =>
    (await db.doc(`shops/${s.shopId}/evidence/${s.evidenceId}`).get()).data()?.server;

  it('kẹt quá 15 phút: chạy lại đúng hàm xác minh, chốt verified + kiểm toán, không cấp URL', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const { signer, signed } = fakeSigner(true);
    const r = reverifierOf(bytes);
    expect(await createUploadSessionForUser(db, signer, s.uid, s, NOW, r.reverifier)).toMatchObject(
      {
        status: 'already_received',
      },
    );
    expect(signed).toEqual([]);
    expect(await serverOf(s)).toMatchObject({ state: 'verified', sha256Server: sha });
    expect(await audit(s.shopId)).toEqual([
      expect.objectContaining({ type: 'evidence.verified', actor: 'system:verifyEvidence' }),
    ]);
    // Gọi lại (client thử lại lần nữa): đã chốt, không băm lại, không nhân đôi kiểm toán.
    const again = reverifierOf(bytes);
    await createUploadSessionForUser(db, signer, s.uid, s, NOW, again.reverifier);
    expect(again.opened()).toBe(0);
    expect(await audit(s.shopId)).toHaveLength(1);
  });

  it('nội dung khác khai báo: hash_mismatch, không bao giờ verified', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const r = reverifierOf(Buffer.from('noi-dung-khac'));
    await createUploadSessionForUser(db, fakeSigner(true).signer, s.uid, s, NOW, r.reverifier);
    const server = await serverOf(s);
    expect(server.state).toBe('hash_mismatch');
    expect(server.verifiedAt).toBeUndefined();
  });

  it('mới nhận chưa tới 15 phút (trigger có thể đang băm): không băm chồng, giữ uploaded', async () => {
    const s = await stuck(60_000);
    const r = reverifierOf(bytes);
    await createUploadSessionForUser(db, fakeSigner(true).signer, s.uid, s, NOW, r.reverifier);
    expect(r.opened()).toBe(0);
    expect((await serverOf(s)).state).toBe('uploaded');
  });

  it('chưa có trạng thái máy chủ (trigger bỏ cuộc trước bước nhận) mà đối tượng đã có lâu: xác minh được', async () => {
    const s = await seed({ evidence: { sha256Client: sha, sizeBytes: bytes.length } });
    const r = reverifierOf(bytes);
    await createUploadSessionForUser(db, fakeSigner(true).signer, s.uid, s, NOW, r.reverifier);
    expect((await serverOf(s)).state).toBe('verified');
  });

  it('lỗi đọc khi xác minh lại hoặc đối tượng không còn: vẫn trả already_received, giữ uploaded, lần sau làm lại', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const broken = reverifierOf(Object.assign(new Error('reset'), { code: 'ECONNRESET' }));
    expect(
      await createUploadSessionForUser(
        db,
        fakeSigner(true).signer,
        s.uid,
        s,
        NOW,
        broken.reverifier,
      ),
    ).toMatchObject({ status: 'already_received' });
    expect((await serverOf(s)).state).toBe('uploaded');
    const gone = reverifierOf(bytes, null);
    await createUploadSessionForUser(db, fakeSigner(true).signer, s.uid, s, NOW, gone.reverifier);
    expect(gone.opened()).toBe(0);
    expect((await serverOf(s)).state).toBe('uploaded');
    await createUploadSessionForUser(
      db,
      fakeSigner(true).signer,
      s.uid,
      s,
      NOW,
      reverifierOf(bytes).reverifier,
    );
    expect((await serverOf(s)).state).toBe('verified');
  });

  it('tài khoản khác không kích hoạt được xác minh lại (permission-denied trước)', async () => {
    const s = await stuck(REVERIFY_AFTER_MS + 1);
    const r = reverifierOf(bytes);
    await expect(
      createUploadSessionForUser(db, fakeSigner(true).signer, 'u-khac', s, NOW, r.reverifier),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(r.opened()).toBe(0);
  });
});
