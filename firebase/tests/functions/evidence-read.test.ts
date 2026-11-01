import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import {
  getEvidenceReadUrlForUser,
  parseReadUrlInput,
  READ_URL_TTL_MS,
  type ReadUrlSigner,
} from '../../functions/src/evidence-read';
import { UploadError } from '../../functions/src/uploads';

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'evidence-read-fn-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

let counter = 0;

function fakeSigner() {
  const signed: { path: string; expiresAtMs: number }[] = [];
  const signer: ReadUrlSigner = {
    signRead: async (path, expiresAtMs) => {
      signed.push({ path, expiresAtMs });
      return `https://signed.example/${path}?sig=secret-token`;
    },
  };
  return { signer, signed };
}

async function seedShop(options: {
  status?: string;
  roles?: string[];
  evidence?: Record<string, unknown> | null;
}) {
  counter += 1;
  const shopId = `shop-rd-${Date.now()}-${counter}`;
  const uid = `u-rd-${counter}`;
  const evidenceId = `ev-rd-${counter}`;
  await db.doc(`shops/${shopId}/members/${uid}`).set({
    roles: options.roles ?? ['viewer'],
    status: options.status ?? 'active',
  });
  if (options.evidence !== null) {
    await db.doc(`shops/${shopId}/evidence/${evidenceId}`).set(
      Object.fromEntries(
        Object.entries({
          shopId,
          kind: 'original_video',
          createdBy: 'someone-else',
          server: { state: 'verified' },
          ...options.evidence,
        }).filter(([, value]) => value !== undefined),
      ),
    );
  }
  return { shopId, uid, evidenceId };
}

const audit = async (shopId: string) =>
  (await db.collection(`shops/${shopId}/auditEvents`).get()).docs.map((d) => d.data());

const NOW = 1_800_000_000_000;

async function expectUploadError(promise: Promise<unknown>, code: string, reason?: string) {
  await expect(promise).rejects.toMatchObject({ code, ...(reason ? { reason } : {}) });
}

describe('parseReadUrlInput', () => {
  it('nhận mã hợp lệ, từ chối mã có ký tự đường dẫn hoặc rỗng', () => {
    expect(parseReadUrlInput({ shopId: 's_1', evidenceId: 'e-1' })).toEqual({
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
      expect(() => parseReadUrlInput(bad)).toThrow(UploadError);
    }
  });
});

describe('getEvidenceReadUrlForUser', () => {
  it.each(['uploaded', 'verified'])('cấp URL 15 phút khi máy chủ đã %s', async (state) => {
    const { shopId, uid, evidenceId } = await seedShop({ evidence: { server: { state } } });
    const { signer, signed } = fakeSigner();
    const result = await getEvidenceReadUrlForUser(db, signer, uid, { shopId, evidenceId }, NOW);
    expect(result.expiresAtMs).toBe(NOW + READ_URL_TTL_MS);
    expect(READ_URL_TTL_MS).toBe(15 * 60_000);
    expect(result.url).toContain('signed.example');
    expect(signed).toEqual([
      {
        path: `shops/${shopId}/evidence/${evidenceId}/original`,
        expiresAtMs: NOW + READ_URL_TTL_MS,
      },
    ]);
  });

  it('mọi thành viên đang hoạt động đều xem được, kể cả người không phải người khai báo', async () => {
    const { shopId, uid, evidenceId } = await seedShop({ roles: ['dispute_handler'] });
    const { signer } = fakeSigner();
    await expect(
      getEvidenceReadUrlForUser(db, signer, uid, { shopId, evidenceId }, NOW),
    ).resolves.toMatchObject({ expiresAtMs: NOW + READ_URL_TTL_MS });
  });

  it('ghi kiểm toán đã xem, không chứa URL hay đường dẫn', async () => {
    const { shopId, uid, evidenceId } = await seedShop({ evidence: { ownerKind: 'return' } });
    const { signer } = fakeSigner();
    await getEvidenceReadUrlForUser(db, signer, uid, { shopId, evidenceId }, NOW);
    const events = await audit(shopId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'evidence.read_url_issued',
      actorUid: uid,
      evidenceId,
      ownerKind: 'return',
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('signed.example');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('/original');
  });

  it.each([
    ['chưa có trạng thái máy chủ', undefined],
    ['queued', { state: 'queued' }],
    ['hash_mismatch', { state: 'hash_mismatch' }],
  ])('từ chối khi máy chủ %s, không ký và không ghi kiểm toán', async (_name, server) => {
    const { shopId, uid, evidenceId } = await seedShop({
      evidence: { server },
    });
    const { signer, signed } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(db, signer, uid, { shopId, evidenceId }, NOW),
      'failed-precondition',
      'not_server_confirmed',
    );
    expect(signed).toHaveLength(0);
    expect(await audit(shopId)).toHaveLength(0);
  });

  it('từ chối người không phải thành viên', async () => {
    const { shopId, evidenceId } = await seedShop({});
    const { signer, signed } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(db, signer, 'stranger', { shopId, evidenceId }, NOW),
      'permission-denied',
    );
    expect(signed).toHaveLength(0);
  });

  it('từ chối thành viên không còn hoạt động', async () => {
    const { shopId, uid, evidenceId } = await seedShop({ status: 'removed' });
    const { signer } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(db, signer, uid, { shopId, evidenceId }, NOW),
      'permission-denied',
    );
  });

  it('TRUY CẬP CHÉO SHOP: thành viên shop A xin bằng chứng của shop B bị từ chối', async () => {
    const a = await seedShop({});
    const b = await seedShop({});
    const { signer, signed } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(
        db,
        signer,
        a.uid,
        { shopId: b.shopId, evidenceId: b.evidenceId },
        NOW,
      ),
      'permission-denied',
    );
    expect(signed).toHaveLength(0);
    expect(await audit(b.shopId)).toHaveLength(0);
  });

  it('shop không tồn tại trả cùng lỗi với không phải thành viên (không lộ ID shop)', async () => {
    const { signer } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(
        db,
        signer,
        'u-x',
        { shopId: 'no-such-shop', evidenceId: 'e' },
        NOW,
      ),
      'permission-denied',
    );
  });

  it('từ chối khi bằng chứng không có trong shop (kể cả ID của shop khác)', async () => {
    const a = await seedShop({});
    const b = await seedShop({});
    const { signer } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(
        db,
        signer,
        a.uid,
        { shopId: a.shopId, evidenceId: b.evidenceId },
        NOW,
      ),
      'not-found',
    );
  });

  it('báo không tìm thấy khi tài liệu bằng chứng chưa có', async () => {
    const { shopId, uid } = await seedShop({ evidence: null });
    const { signer } = fakeSigner();
    await expectUploadError(
      getEvidenceReadUrlForUser(db, signer, uid, { shopId, evidenceId: 'missing' }, NOW),
      'not-found',
    );
  });
});
