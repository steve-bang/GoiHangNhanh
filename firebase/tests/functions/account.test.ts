import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

import {
  ACCOUNT_PURGE_AFTER_DAYS,
  AccountError,
  accountDeletionPath,
  assertRecentAuth,
  AUTH_RETRY_MIN_AGE_MS,
  completeAuthDeletion,
  deleteAccountForUser,
  purgeDeletedShops,
  purgeShop,
  retryPendingAuthDeletions,
  shopStoragePrefix,
  type AuthUserDeleter,
  type StoragePrefixDeleter,
} from '../../functions/src/account';
import { runDeleteAccountCli } from '../../functions/src/admin/delete-account-cli';
import { recordAuditForWrite } from '../../functions/src/audit';
import { describeCallableError } from '../../functions/src/callable-errors';
import { createShopForUser } from '../../functions/src/shop';

// Xóa tài khoản (V1-14): chạy trên Firestore Emulator; Auth và Storage là bản giả trong bộ nhớ.
let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'account-fn-test');
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});

const DAY_MS = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 9, 30, 3, 0, 0);
let counter = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`;

function fakeAuth(failTimes = 0) {
  const deleted: string[] = [];
  let failures = failTimes;
  const auth: AuthUserDeleter = {
    deleteUser: async (uid) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error('auth tạm lỗi');
      }
      if (deleted.includes(uid)) {
        throw Object.assign(new Error('không còn'), { code: 'auth/user-not-found' });
      }
      deleted.push(uid);
    },
  };
  return { auth, deleted };
}

function fakeStorage(names: string[]) {
  const objects = new Set(names);
  const storage: StoragePrefixDeleter = {
    listNames: async (prefix, max) =>
      [...objects].filter((n) => n.startsWith(prefix)).slice(0, max),
    deleteObject: async (name) => {
      objects.delete(name);
    },
  };
  return { storage, objects };
}

/** Shop do `uid` sở hữu (như createShop), có dữ liệu ở MỌI collection con. */
async function seedShop(uid: string, extraMembers: Record<string, string> = {}) {
  const shop = await createShopForUser(db, uid, {
    name: 'Cua Hang Bi Mat',
    sellingSources: ['shopee'],
  });
  const base = `shops/${shop.id}`;
  for (const [memberUid, status] of Object.entries(extraMembers)) {
    await db.doc(`${base}/members/${memberUid}`).set({ roles: ['packer'], status });
  }
  await db.doc(`${base}/orders/o1`).set({ shopId: shop.id, orderCode: 'DH-BI-MAT' });
  await db.doc(`${base}/orders/o1/lines/l1`).set({ name: 'Áo' });
  await db.doc(`${base}/orders/o1/packages/p1`).set({ index: 1 });
  await db.doc(`${base}/sessions/s1`).set({ orderId: 'o1' });
  await db.doc(`${base}/evidence/e1`).set({ sessionId: 's1' });
  await db.doc(`${base}/returns/r1`).set({ code: 'RH-00001' });
  await db.doc(`${base}/evidenceReverify/e1`).set({ requestedBy: uid });
  await db.doc(`${base}/auditEvents/a1`).set({ type: 'order.created' });
  return shop.id;
}

const recordOf = async (uid: string) => (await db.doc(accountDeletionPath(uid)).get()).data();
const shopOf = async (shopId: string) => (await db.doc(`shops/${shopId}`).get()).data();

async function countUnder(shopId: string): Promise<number> {
  let total = 0;
  const ref = db.doc(`shops/${shopId}`);
  if ((await ref.get()).exists) total += 1;
  const walk = async (cols: FirebaseFirestore.CollectionReference[]) => {
    for (const col of cols) {
      const docs = await col.listDocuments();
      for (const d of docs) {
        if ((await d.get()).exists) total += 1;
        await walk(await d.listCollections());
      }
    }
  };
  await walk(await ref.listCollections());
  return total;
}

describe('assertRecentAuth', () => {
  it('nhận auth_time trong 5 phút (kể cả lệch nhẹ về tương lai)', () => {
    expect(() => assertRecentAuth(NOW / 1000 - 299, NOW)).not.toThrow();
    expect(() => assertRecentAuth(NOW / 1000 + 30, NOW)).not.toThrow();
  });

  it.each([[NOW / 1000 - 301], [undefined], ['123'], [Number.NaN]])(
    'từ chối auth_time %p: failed-precondition + requires_recent_login',
    (authTime) => {
      let caught: unknown;
      try {
        assertRecentAuth(authTime, NOW);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AccountError);
      expect(describeCallableError(caught)).toEqual({
        code: 'failed-precondition',
        message: 'Cần đăng nhập lại.',
        details: { reason: 'requires_recent_login' },
      });
    },
  );
});

describe('deleteAccountForUser', () => {
  it('chủ duy nhất: shop deleting + purgeAfter 30 ngày, thành viên và userShops mất, Auth bị xóa, bản ghi tối thiểu', async () => {
    const uid = nextId('u-del');
    const shopId = await seedShop(uid);
    const { auth, deleted } = fakeAuth();

    const result = await deleteAccountForUser(db, auth, uid, { nowMs: NOW, channel: 'app' });

    expect(result).toEqual({
      status: 'pending_purge',
      purgeAfterMs: NOW + ACCOUNT_PURGE_AFTER_DAYS * DAY_MS,
      closedShopCount: 1,
    });
    expect(deleted).toEqual([uid]);
    const shop = await shopOf(shopId);
    expect(shop?.status).toBe('deleting');
    expect(shop?.deletionRecordId).toBe(uid);
    expect((shop?.purgeAfter as Timestamp).toMillis()).toBe(NOW + 30 * DAY_MS);
    expect(shop?.deletionRequestedAt).toBeInstanceOf(Timestamp);
    expect((await db.doc(`shops/${shopId}/members/${uid}`).get()).exists).toBe(false);
    expect((await db.doc(`userShops/${uid}`).get()).exists).toBe(false);
    // Dữ liệu cửa hàng còn nguyên trong 30 ngày chờ (chỉ bị khóa).
    expect((await db.doc(`shops/${shopId}/orders/o1`).get()).exists).toBe(true);

    const record = await recordOf(uid);
    expect(record).toMatchObject({
      uid,
      shopIds: [shopId],
      leftShopIds: [],
      status: 'pending_purge',
      reason: 'owner_request',
      channel: 'app',
    });
    expect(record?.requestedAt).toBeInstanceOf(Timestamp);
    expect(record?.authDeletedAt).toBeInstanceOf(Timestamp);
    // Không email, không tên, không mã đơn.
    const text = JSON.stringify(record);
    for (const forbidden of ['email', 'displayName', 'name', 'DH-BI-MAT', 'Cua Hang Bi Mat']) {
      expect(text).not.toContain(forbidden);
    }
    const audit = (
      await db.doc(`shops/${shopId}/auditEvents/account-deletion-${uid}`).get()
    ).data();
    expect(audit).toMatchObject({ type: 'account.deletion_requested', actorUid: uid });
  });

  it('gọi hai lần: không lỗi, một bản ghi, purgeAfter không bị kéo dài', async () => {
    const uid = nextId('u-twice');
    const shopId = await seedShop(uid);
    const { auth } = fakeAuth();
    await deleteAccountForUser(db, auth, uid, { nowMs: NOW, channel: 'app' });
    const second = await deleteAccountForUser(db, auth, uid, {
      nowMs: NOW + 2 * DAY_MS,
      channel: 'app',
    });
    expect(second.purgeAfterMs).toBe(NOW + 30 * DAY_MS);
    expect(((await shopOf(shopId))?.purgeAfter as Timestamp).toMillis()).toBe(NOW + 30 * DAY_MS);
    const records = await db.collection('accountDeletions').where('uid', '==', uid).get();
    expect(records.size).toBe(1);
    expect(records.docs[0]?.data().shopIds).toEqual([shopId]);
    const events = await db
      .collection(`shops/${shopId}/auditEvents`)
      .where('type', '==', 'account.deletion_requested')
      .get();
    expect(events.size).toBe(1);
  });

  it('xóa Auth lỗi giữa chừng: quyền đã mất, gọi lại thì hoàn tất', async () => {
    const uid = nextId('u-retry');
    const shopId = await seedShop(uid);
    const flaky = fakeAuth(1);
    await expect(
      deleteAccountForUser(db, flaky.auth, uid, { nowMs: NOW, channel: 'app' }),
    ).rejects.toThrow('auth tạm lỗi');
    expect((await recordOf(uid))?.status).toBe('requested');
    expect((await db.doc(`shops/${shopId}/members/${uid}`).get()).exists).toBe(false);

    const result = await deleteAccountForUser(db, flaky.auth, uid, { nowMs: NOW, channel: 'app' });
    expect(result.status).toBe('pending_purge');
    expect(result.closedShopCount).toBe(1);
    expect(flaky.deleted).toEqual([uid]);
    expect((await shopOf(shopId))?.status).toBe('deleting');
  });

  it('không phải chủ: chỉ rời shop, shop không bị khóa', async () => {
    const owner = nextId('u-owner');
    const uid = nextId('u-member');
    const shopId = await seedShop(owner);
    await db.doc(`shops/${shopId}/members/${uid}`).set({ roles: ['packer'], status: 'active' });
    await db.doc(`userShops/${uid}`).set({ shopId });
    const { auth } = fakeAuth();

    const result = await deleteAccountForUser(db, auth, uid, { nowMs: NOW, channel: 'app' });

    expect(result).toEqual({ status: 'completed', purgeAfterMs: null, closedShopCount: 0 });
    expect((await shopOf(shopId))?.status).toBeUndefined();
    expect((await db.doc(`shops/${shopId}/members/${uid}`).get()).exists).toBe(false);
    expect((await db.doc(`shops/${shopId}/members/${owner}`).get()).exists).toBe(true);
    expect(await recordOf(uid)).toMatchObject({
      shopIds: [],
      leftShopIds: [shopId],
      purgeAfter: null,
    });
  });

  it('shop còn thành viên khác đang hoạt động: từ chối, không đổi gì, không xóa Auth', async () => {
    const uid = nextId('u-team');
    const shopId = await seedShop(uid, { [nextId('u-other')]: 'active' });
    const { auth, deleted } = fakeAuth();
    let caught: unknown;
    try {
      await deleteAccountForUser(db, auth, uid, { nowMs: NOW, channel: 'app' });
    } catch (error) {
      caught = error;
    }
    expect(describeCallableError(caught)).toMatchObject({
      code: 'failed-precondition',
      details: { reason: 'shop_has_members' },
    });
    expect(deleted).toEqual([]);
    expect((await shopOf(shopId))?.status).toBeUndefined();
    expect((await db.doc(`shops/${shopId}/members/${uid}`).get()).exists).toBe(true);
    expect((await db.doc(`userShops/${uid}`).get()).exists).toBe(true);
    expect(await recordOf(uid)).toBeUndefined();
  });

  it('thành viên đã bị thu hồi không chặn việc đóng shop', async () => {
    const uid = nextId('u-rev');
    const shopId = await seedShop(uid, { [nextId('u-gone')]: 'revoked' });
    const { auth } = fakeAuth();
    await deleteAccountForUser(db, auth, uid, { nowMs: NOW, channel: 'app' });
    expect((await shopOf(shopId))?.status).toBe('deleting');
  });

  it('chỉ tác động tài khoản của chính uid: shop của người khác không bị đụng (QA-11)', async () => {
    const victim = nextId('u-victim');
    const attacker = nextId('u-attacker');
    const victimShop = await seedShop(victim);
    const { auth, deleted } = fakeAuth();
    const result = await deleteAccountForUser(db, auth, attacker, { nowMs: NOW, channel: 'app' });
    expect(result.closedShopCount).toBe(0);
    expect(deleted).toEqual([attacker]);
    expect((await shopOf(victimShop))?.status).toBeUndefined();
    expect((await db.doc(`shops/${victimShop}/members/${victim}`).get()).exists).toBe(true);
  });

  it('createShop sau khi xóa (token cũ còn hạn): từ chối account_deleted, không tạo shop', async () => {
    const uid = nextId('u-recreate');
    await seedShop(uid);
    await deleteAccountForUser(db, fakeAuth().auth, uid, { nowMs: NOW, channel: 'app' });
    let caught: unknown;
    try {
      await createShopForUser(db, uid, { name: 'Mới', sellingSources: [] });
    } catch (error) {
      caught = error;
    }
    expect(describeCallableError(caught)).toMatchObject({
      code: 'permission-denied',
      details: { reason: 'account_deleted' },
    });
    expect((await db.doc(`userShops/${uid}`).get()).exists).toBe(false);
  });
});

describe('purgeShop / purgeDeletedShops', () => {
  async function deletedShop(nowMs = NOW) {
    const uid = nextId('u-purge');
    const shopId = await seedShop(uid);
    await deleteAccountForUser(db, fakeAuth().auth, uid, { nowMs, channel: 'app' });
    return { uid, shopId };
  }
  const after30 = NOW + 30 * DAY_MS;
  const options = (nowMs: number) => ({ nowMs, deadlineMs: Number.MAX_SAFE_INTEGER });

  it('trước purgeAfter: không xóa gì', async () => {
    const { shopId } = await deletedShop();
    const { storage, objects } = fakeStorage([`shops/${shopId}/evidence/e1/original`]);
    expect(await purgeShop(db, storage, shopId, options(after30 - 1))).toBe('not_due');
    expect(objects.size).toBe(1);
    expect((await db.doc(`shops/${shopId}/orders/o1`).get()).exists).toBe(true);
  });

  it('shop không ở deleting: không xóa gì', async () => {
    const shopId = await seedShop(nextId('u-live'));
    await db.doc(`shops/${shopId}`).update({ purgeAfter: Timestamp.fromMillis(NOW - DAY_MS) });
    const { storage } = fakeStorage([]);
    expect(await purgeShop(db, storage, shopId, options(after30))).toBe('not_deleting');
    expect((await db.doc(`shops/${shopId}/orders/o1`).get()).exists).toBe(true);
  });

  it('legalHold: bỏ qua, ghi lý do kỹ thuật một lần, dữ liệu còn nguyên (bất biến 9)', async () => {
    const { uid, shopId } = await deletedShop();
    await db.doc(`shops/${shopId}`).update({ legalHold: true });
    const { storage, objects } = fakeStorage([`shops/${shopId}/evidence/e1/original`]);
    expect(await purgeShop(db, storage, shopId, options(after30))).toBe('legal_hold');
    expect(await purgeShop(db, storage, shopId, options(after30 + DAY_MS))).toBe('legal_hold');
    expect(objects.size).toBe(1);
    expect((await db.doc(`shops/${shopId}/auditEvents/a1`).get()).exists).toBe(true);
    expect(await recordOf(uid)).toMatchObject({
      status: 'pending_purge',
      lastSkipReason: 'legal_hold_skip',
    });
  });

  it('purge xong: shop và MỌI collection con rỗng, Storage đúng tiền tố, shop khác nguyên vẹn, bản ghi purged', async () => {
    const { uid, shopId } = await deletedShop();
    const other = await deletedShop(NOW + 10 * DAY_MS); // chưa tới hạn
    const live = await seedShop(nextId('u-live'));
    const { storage, objects } = fakeStorage([
      `shops/${shopId}/evidence/e1/original`,
      `shops/${shopId}/evidence/e2/original`,
      `shops/${shopId}x/evidence/e9/original`, // tiền tố giống, KHÁC shop
      `shops/${other.shopId}/evidence/e1/original`,
      `shops/${live}/evidence/e1/original`,
    ]);
    const shopDocsBefore = await countUnder(shopId);

    expect(await purgeShop(db, storage, shopId, options(after30))).toBe('purged');

    expect(await countUnder(shopId)).toBe(0);
    for (const col of [
      'orders',
      'sessions',
      'evidence',
      'returns',
      'members',
      'evidenceReverify',
      'auditEvents',
    ]) {
      expect((await db.collection(`shops/${shopId}/${col}`).limit(1).get()).empty).toBe(true);
    }
    expect((await db.collection(`shops/${shopId}/orders/o1/lines`).limit(1).get()).empty).toBe(
      true,
    );
    expect([...objects].sort()).toEqual(
      [
        `shops/${shopId}x/evidence/e9/original`,
        `shops/${other.shopId}/evidence/e1/original`,
        `shops/${live}/evidence/e1/original`,
      ].sort(),
    );
    expect((await db.doc(`shops/${other.shopId}/orders/o1`).get()).exists).toBe(true);
    expect((await db.doc(`shops/${live}/auditEvents/a1`).get()).exists).toBe(true);

    const record = await recordOf(uid);
    expect(record).toMatchObject({
      uid,
      status: 'purged',
      shopIds: [shopId],
      purgedShopIds: [shopId],
      counts: { storageObjects: 2, firestoreDocs: shopDocsBefore },
    });
    expect(record?.purgedAt).toBeInstanceOf(Timestamp);
    expect(Object.keys(record ?? {})).not.toEqual(expect.arrayContaining(['email']));

    // Chạy lại: idempotent.
    expect(await purgeShop(db, storage, shopId, options(after30 + DAY_MS))).toBe('not_deleting');
    expect((await recordOf(uid))?.counts).toEqual(record?.counts);
  });

  it('trigger kiểm toán nhận sự kiện xóa của purge: không ghi gì, không hồi sinh shop', async () => {
    const { shopId } = await deletedShop();
    const orderRef = db.doc(`shops/${shopId}/orders/o1`);
    const before = await orderRef.get();
    await purgeShop(db, fakeStorage([]).storage, shopId, options(after30));
    const after = await orderRef.get();
    const outcome = await recordAuditForWrite(db, {
      entity: 'order',
      shopId,
      entityId: 'o1',
      entityPath: 'orders/o1',
      before,
      after,
      authType: 'system',
      authId: undefined,
    });
    expect(outcome).toBe('skipped_delete');
    expect(await countUnder(shopId)).toBe(0);
  });

  it('hết thời gian giữa Storage: incomplete, tài liệu shop còn; lần sau xong', async () => {
    const { uid, shopId } = await deletedShop();
    const names = Array.from({ length: 3 }, (_, i) => `shops/${shopId}/evidence/e${i}/original`);
    const { storage, objects } = fakeStorage(names);
    let calls = 0;
    const clock = () => ((calls += 1) > 1 ? 10 : 0); // sau lần kiểm đầu tiên là quá hạn
    const paged: StoragePrefixDeleter = {
      listNames: (prefix) => storage.listNames(prefix, 1),
      deleteObject: storage.deleteObject,
    };
    expect(await purgeShop(db, paged, shopId, { nowMs: after30, deadlineMs: 5, clock })).toBe(
      'incomplete',
    );
    expect(objects.size).toBe(2);
    expect((await shopOf(shopId))?.status).toBe('deleting');
    expect((await recordOf(uid))?.status).toBe('pending_purge');

    expect(await purgeShop(db, storage, shopId, options(after30))).toBe('purged');
    expect(objects.size).toBe(0);
    expect((await recordOf(uid))?.counts.storageObjects).toBe(3);
  });

  it('adapter trả tên ngoài tiền tố: dừng, không xóa nhầm', async () => {
    const { shopId } = await deletedShop();
    const deletedNames: string[] = [];
    const bad: StoragePrefixDeleter = {
      listNames: async () => ['shops/khac/evidence/e1/original'],
      deleteObject: async (name) => {
        deletedNames.push(name);
      },
    };
    await expect(purgeShop(db, bad, shopId, options(after30))).rejects.toThrow(
      'outside shop prefix',
    );
    expect(deletedNames).toEqual([]);
    expect(shopStoragePrefix('abc')).toBe('shops/abc/');
  });

  it('purgeDeletedShops: duyệt theo trang, chỉ shop quá hạn, bỏ qua legalHold', async () => {
    // Mốc riêng xa trong tương lai để không lẫn shop của test khác trong cùng Emulator.
    const base = NOW + 3000 * DAY_MS;
    const due = await Promise.all([deletedShop(base), deletedShop(base), deletedShop(base)]);
    const held = await deletedShop(base);
    await db.doc(`shops/${held.shopId}`).update({ legalHold: true });
    const notDue = await deletedShop(base + 5 * DAY_MS);

    const summary = await purgeDeletedShops(db, fakeStorage([]).storage, {
      nowMs: base + 30 * DAY_MS,
      deadlineMs: Number.MAX_SAFE_INTEGER,
      pageSize: 2,
    });

    expect(summary.stoppedEarly).toBe(false);
    for (const s of due) expect(await countUnder(s.shopId)).toBe(0);
    expect((await shopOf(held.shopId))?.status).toBe('deleting');
    expect((await shopOf(notDue.shopId))?.status).toBe('deleting');
    expect(summary.outcomes.legal_hold).toBeGreaterThanOrEqual(1);
    expect(summary.outcomes.purged).toBeGreaterThanOrEqual(3);
  });
});

describe('xóa Auth lỗi sau khi bước 1 đã commit (review PR #53)', () => {
  const sweep = (auth: AuthUserDeleter, nowMs: number) =>
    retryPendingAuthDeletions(db, auth, {
      nowMs,
      deadlineMs: Number.MAX_SAFE_INTEGER,
      pageSize: 2,
    });

  it('lượt quét bỏ qua bản ghi requested chưa đủ 1 giờ, quá 1 giờ thì gọi lại deleteUser và chốt', async () => {
    const uid = nextId('u-stuck');
    await seedShop(uid);
    const flaky = fakeAuth(1);
    await expect(
      deleteAccountForUser(db, flaky.auth, uid, { nowMs: NOW, channel: 'app' }),
    ).rejects.toThrow('auth tạm lỗi');
    expect((await recordOf(uid))?.status).toBe('requested');

    await sweep(flaky.auth, Date.now());
    expect(flaky.deleted).toEqual([]);
    expect((await recordOf(uid))?.status).toBe('requested');

    const summary = await sweep(flaky.auth, Date.now() + AUTH_RETRY_MIN_AGE_MS + 60_000);
    expect(summary.completed).toBeGreaterThanOrEqual(1);
    expect(flaky.deleted).toEqual([uid]);
    const record = await recordOf(uid);
    expect(record?.status).toBe('pending_purge');
    expect(record?.authDeletedAt).toBeInstanceOf(Timestamp);
  });

  it('deleteUser lỗi mãi: lượt quét đếm lỗi, bản ghi vẫn requested để lần sau thử lại', async () => {
    const uid = nextId('u-stuck-hard');
    await seedShop(uid);
    const broken = fakeAuth(1_000);
    await expect(
      deleteAccountForUser(db, broken.auth, uid, { nowMs: NOW, channel: 'app' }),
    ).rejects.toThrow();
    const summary = await sweep(broken.auth, Date.now() + 2 * AUTH_RETRY_MIN_AGE_MS);
    expect(summary.failed).toBeGreaterThanOrEqual(1);
    expect((await recordOf(uid))?.status).toBe('requested');
    expect((await recordOf(uid))?.authDeletedAt).toBeUndefined();
  });

  it('purge chạy khi Auth chưa bị xóa: dữ liệu xóa nhưng KHÔNG đặt purged; xóa Auth xong mới purged', async () => {
    const uid = nextId('u-purge-first');
    const shopId = await seedShop(uid);
    await expect(
      deleteAccountForUser(db, fakeAuth(1_000).auth, uid, { nowMs: NOW, channel: 'app' }),
    ).rejects.toThrow();
    expect(
      await purgeShop(db, fakeStorage([]).storage, shopId, {
        nowMs: NOW + 30 * DAY_MS,
        deadlineMs: Number.MAX_SAFE_INTEGER,
      }),
    ).toBe('purged');
    expect(await countUnder(shopId)).toBe(0);
    let record = await recordOf(uid);
    expect(record?.status).toBe('requested');
    expect(record?.purgedShopIds).toEqual([shopId]);
    expect(record?.purgedAt).toBeInstanceOf(Timestamp);

    const ok = fakeAuth();
    expect(await completeAuthDeletion(db, ok.auth, uid)).toBe('purged');
    expect(ok.deleted).toEqual([uid]);
    record = await recordOf(uid);
    expect(record?.status).toBe('purged');
    expect(record?.authDeletedAt).toBeInstanceOf(Timestamp);
  });
});

describe('delete-account-cli', () => {
  const PROJECT = 'demo-doncung';
  function deps(uidByEmail: Record<string, string>) {
    const lines: string[] = [];
    const connected: string[] = [];
    const { auth, deleted } = fakeAuth();
    return {
      lines,
      deleted,
      connected,
      deps: {
        connect: (projectId: string) => {
          connected.push(projectId);
          return {
            db,
            auth: {
              ...auth,
              findUidByEmail: async (email: string) => uidByEmail[email] ?? null,
            },
          };
        },
        print: (line: string) => lines.push(line),
        nowMs: () => NOW,
      },
    };
  }

  it('mặc định chạy thử: dòng đầu là tên dự án, in kế hoạch, không ghi gì, không in email', async () => {
    const uid = nextId('u-cli');
    const shopId = await seedShop(uid);
    const t = deps({ 'chu@cuahang.vn': uid });
    expect(
      await runDeleteAccountCli(['--project', PROJECT, '--email', 'chu@cuahang.vn'], t.deps),
    ).toBe(0);
    expect(t.lines[0]).toBe(`Dự án: ${PROJECT}`);
    expect(t.connected).toEqual([PROJECT]);
    expect(t.deleted).toEqual([]);
    expect((await shopOf(shopId))?.status).toBeUndefined();
    expect(await recordOf(uid)).toBeUndefined();
    expect(t.lines.join('\n')).toContain(shopId);
    expect(t.lines.join('\n')).not.toContain('SẼ XÓA');
    expect(t.lines.join('\n')).not.toContain('chu@cuahang.vn');
  });

  it('--execute: in "SẼ XÓA trên dự án" trước khi xóa, xóa như trong app, kênh support', async () => {
    const uid = nextId('u-cli-x');
    const shopId = await seedShop(uid);
    const t = deps({});
    expect(
      await runDeleteAccountCli(['--uid', uid, '--execute', '--project', PROJECT], t.deps),
    ).toBe(0);
    expect(t.lines[0]).toBe(`Dự án: ${PROJECT}`);
    const warn = t.lines.findIndex((l) => l === `SẼ XÓA tài khoản ${uid} trên dự án ${PROJECT}.`);
    const done = t.lines.findIndex((l) => l.startsWith('Đã xóa tài khoản'));
    expect(warn).toBeGreaterThan(0);
    expect(done).toBeGreaterThan(warn);
    expect(t.deleted).toEqual([uid]);
    expect((await shopOf(shopId))?.status).toBe('deleting');
    expect(await recordOf(uid)).toMatchObject({ channel: 'support', status: 'pending_purge' });
  });

  it('thiếu hoặc sai --project, sai cách dùng: mã 2, không kết nối dự án nào', async () => {
    const t = deps({});
    expect(await runDeleteAccountCli([], t.deps)).toBe(2);
    expect(await runDeleteAccountCli(['--uid', 'x', '--execute'], t.deps)).toBe(2);
    expect(await runDeleteAccountCli(['--uid', 'x', '--project'], t.deps)).toBe(2);
    expect(await runDeleteAccountCli(['--uid', 'x', '--project', 'Sai Du An'], t.deps)).toBe(2);
    expect(
      await runDeleteAccountCli(['--project', PROJECT, '--email', 'a@b.vn', '--uid', 'x'], t.deps),
    ).toBe(2);
    expect(await runDeleteAccountCli(['--project', PROJECT, '--bogus'], t.deps)).toBe(2);
    expect(t.connected).toEqual([]);
    expect(t.lines.every((l) => l.startsWith('Dùng:'))).toBe(true);
  });

  it('không có tài khoản với email: mã 1, không in lại email', async () => {
    const t = deps({});
    expect(
      await runDeleteAccountCli(['--project', PROJECT, '--email', 'khong-co@b.vn'], t.deps),
    ).toBe(1);
    expect(t.lines.join('\n')).not.toContain('khong-co@b.vn');
  });
});
