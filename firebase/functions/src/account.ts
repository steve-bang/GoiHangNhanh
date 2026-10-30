import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QuerySnapshot,
  type Transaction,
} from 'firebase-admin/firestore';

/**
 * Xóa tài khoản (V1-14; kế hoạch v1 mục 3.3, quyết định R-1 A, R-4 A). Hai Function dùng các hàm ở đây:
 * - callable `deleteAccount`: gỡ quyền vào cửa hàng và xóa tài khoản Auth NGAY; shop do người gọi sở hữu
 *   bị khóa (`status: 'deleting'`, Rules từ chối mọi đọc/ghi client) và hẹn xóa hẳn sau 30 ngày.
 * - lịch `purgeDeletedShops`: xóa hẳn shop quá hạn (Storage `shops/{id}/`, mọi collection con kể cả
 *   `auditEvents`, rồi tài liệu shop), trừ shop có `legalHold == true` (bất biến 9).
 * Bản ghi duy nhất còn lại là `accountDeletions/{uid}`: uid, mã shop, thời điểm, trạng thái, lý do kỹ thuật,
 * số lượng. KHÔNG email, tên hay mã đơn. Client không đọc/ghi được (Rules).
 */

/** Số ngày từ lúc yêu cầu tới lúc xóa hẳn dữ liệu máy chủ (R-4; khớp `web/src/config/site.ts` purgeAfterDays). */
export const ACCOUNT_PURGE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;
/** Người gọi phải vừa đăng nhập/xác thực lại trong chừng này (giây; `auth_time` của ID token). */
export const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;
/** Số thành viên đọc tối đa mỗi shop khi kiểm "còn thành viên khác" (v1: một chủ, không có thành viên). */
const MEMBER_SCAN_LIMIT = 20;

export const accountDeletionPath = (uid: string) => `accountDeletions/${uid}`;

export type AccountErrorReason = 'requires_recent_login' | 'shop_has_members' | 'account_deleted';

/** Lỗi nghiệp vụ; `index.ts` đổi sang HttpsError kèm `details.reason` (client phân loại theo đó). */
export class AccountError extends Error {
  constructor(
    readonly code: 'failed-precondition' | 'permission-denied',
    message: string,
    readonly reason: AccountErrorReason,
  ) {
    super(message);
  }
}

/**
 * Yêu cầu xác thực gần đây: thiếu `auth_time` hoặc cũ hơn 5 phút thì từ chối. `auth_time` ở tương lai
 * (đồng hồ máy chủ lệch nhẹ) vẫn nhận.
 */
export function assertRecentAuth(authTimeSeconds: unknown, nowMs: number): void {
  if (typeof authTimeSeconds !== 'number' || !Number.isFinite(authTimeSeconds)) {
    throw new AccountError('failed-precondition', 'Cần đăng nhập lại.', 'requires_recent_login');
  }
  if (nowMs / 1000 - authTimeSeconds > RECENT_AUTH_MAX_AGE_SECONDS) {
    throw new AccountError('failed-precondition', 'Cần đăng nhập lại.', 'requires_recent_login');
  }
}

/** Đã có bản ghi xóa cho uid này (dùng để chặn token cũ còn hạn tạo shop mồ côi). */
export async function isAccountDeleted(db: Firestore, uid: string): Promise<boolean> {
  return (await db.doc(accountDeletionPath(uid)).get()).exists;
}

// ---------- Đọc trạng thái (dùng chung cho transaction và dry-run của script hỗ trợ) ----------

interface Reader {
  doc(ref: DocumentReference): Promise<DocumentSnapshot>;
  query(query: Query): Promise<QuerySnapshot>;
}

const txReader = (tx: Transaction): Reader => ({
  doc: (ref) => tx.get(ref),
  query: (query) => tx.get(query),
});

const dbReader: Reader = { doc: (ref) => ref.get(), query: (query) => query.get() };

export type ShopAction = 'close' | 'leave' | 'none';

export interface ShopPlan {
  readonly shopId: string;
  readonly action: ShopAction;
  /** Shop đã ở `deleting` từ lần chạy trước (giữ nguyên `purgeAfter`). */
  readonly alreadyDeleting: boolean;
  /** Số thành viên đang hoạt động KHÁC người gọi (khác 0 thì không đóng được shop). */
  readonly otherActiveMembers: number;
}

export interface DeletionPlan {
  readonly uid: string;
  readonly shops: readonly ShopPlan[];
  readonly blockedBy: 'shop_has_members' | null;
  readonly existingRecord: Record<string, unknown> | null;
}

const isOwner = (member: DocumentSnapshot) =>
  member.exists && ((member.data()?.roles as unknown[] | undefined) ?? []).includes('owner');

async function loadPlan(db: Firestore, reader: Reader, uid: string): Promise<DeletionPlan> {
  const [index, record] = await Promise.all([
    reader.doc(db.doc(`userShops/${uid}`)),
    reader.doc(db.doc(accountDeletionPath(uid))),
  ]);
  const shopIds = new Set<string>();
  const indexed = index.data()?.shopId;
  if (typeof indexed === 'string' && indexed) shopIds.add(indexed);
  // Lần chạy trước đã xóa `userShops` mà chưa xong (ví dụ lỗi xóa Auth): lấy lại từ bản ghi.
  for (const key of ['shopIds', 'leftShopIds']) {
    const previous = record.data()?.[key];
    if (Array.isArray(previous)) {
      for (const id of previous) if (typeof id === 'string' && id) shopIds.add(id);
    }
  }

  const shops: ShopPlan[] = [];
  for (const shopId of [...shopIds].sort()) {
    const shopRef = db.doc(`shops/${shopId}`);
    const [shop, member, members] = await Promise.all([
      reader.doc(shopRef),
      reader.doc(shopRef.collection('members').doc(uid)),
      reader.query(shopRef.collection('members').limit(MEMBER_SCAN_LIMIT)),
    ]);
    const otherActiveMembers = members.docs.filter(
      (d) => d.id !== uid && d.data().status === 'active',
    ).length;
    const shopData = shop.data() ?? {};
    const alreadyDeleting =
      shop.exists && shopData.status === 'deleting' && shopData.deletionRecordId === uid;
    let action: ShopAction = 'none';
    if (shop.exists && (isOwner(member) || alreadyDeleting)) action = 'close';
    else if (member.exists) action = 'leave';
    shops.push({ shopId, action, alreadyDeleting, otherActiveMembers });
  }
  const blocked = shops.some((s) => s.action === 'close' && s.otherActiveMembers > 0);
  return {
    uid,
    shops,
    blockedBy: blocked ? 'shop_has_members' : null,
    existingRecord: record.exists ? (record.data() ?? {}) : null,
  };
}

/** Kế hoạch xóa mà KHÔNG ghi gì (dry-run của script hỗ trợ). */
export function planAccountDeletion(db: Firestore, uid: string): Promise<DeletionPlan> {
  return loadPlan(db, dbReader, uid);
}

// ---------- deleteAccount ----------

/** Xóa người dùng Auth (Admin SDK). Tách ra để test không cần Auth Emulator. */
export interface AuthUserDeleter {
  deleteUser(uid: string): Promise<void>;
}

export type DeletionChannel = 'app' | 'support';

export interface DeleteAccountResult {
  readonly status: 'pending_purge' | 'completed' | 'purged';
  /** Giờ (ms) dữ liệu cửa hàng trên máy chủ được xóa hẳn; null nếu không có shop nào phải xóa. */
  readonly purgeAfterMs: number | null;
  readonly closedShopCount: number;
}

const isAuthUserMissing = (error: unknown) =>
  (error as { code?: unknown } | null)?.code === 'auth/user-not-found';

const millisOf = (value: unknown): number | null =>
  value instanceof Timestamp ? value.toMillis() : null;

/**
 * Xóa tài khoản `uid` (chỉ của chính người gọi; `index.ts` lấy uid từ token). Idempotent: gọi lại sau lỗi
 * giữa chừng chạy tiếp, không tạo bản ghi thứ hai, không kéo dài `purgeAfter`.
 * Bước 1 (một transaction): khóa shop sở hữu, gỡ thành viên, xóa `userShops`, ghi bản ghi.
 * Bước 2: xóa người dùng Auth, rồi đổi trạng thái bản ghi.
 */
export async function deleteAccountForUser(
  db: Firestore,
  auth: AuthUserDeleter,
  uid: string,
  options: { readonly nowMs: number; readonly channel: DeletionChannel },
): Promise<DeleteAccountResult> {
  const recordRef = db.doc(accountDeletionPath(uid));
  const purgeAfter = Timestamp.fromMillis(options.nowMs + ACCOUNT_PURGE_AFTER_DAYS * DAY_MS);

  const step1 = await db.runTransaction(async (tx) => {
    const plan = await loadPlan(db, txReader(tx), uid);
    if (plan.blockedBy) {
      throw new AccountError(
        'failed-precondition',
        'Cửa hàng còn thành viên khác.',
        plan.blockedBy,
      );
    }
    const closed = plan.shops.filter((s) => s.action === 'close');
    const left = plan.shops.filter((s) => s.action === 'leave');

    for (const shop of plan.shops) {
      const shopRef = db.doc(`shops/${shop.shopId}`);
      if (shop.action === 'close' && !shop.alreadyDeleting) {
        tx.update(shopRef, {
          status: 'deleting',
          deletionRequestedAt: FieldValue.serverTimestamp(),
          purgeAfter,
          deletionRecordId: uid,
        });
        tx.set(shopRef.collection('auditEvents').doc(`account-deletion-${uid}`), {
          type: 'account.deletion_requested',
          actorUid: uid,
          actor: options.channel === 'app' ? 'user' : 'system:support',
          at: FieldValue.serverTimestamp(),
        });
      }
      if (shop.action !== 'none') tx.delete(shopRef.collection('members').doc(uid));
    }
    tx.delete(db.doc(`userShops/${uid}`));

    const closedIds = closed.map((s) => s.shopId);
    const leftIds = left.map((s) => s.shopId);
    const existing = plan.existingRecord;
    if (!existing) {
      tx.create(recordRef, {
        uid,
        shopIds: closedIds,
        leftShopIds: leftIds,
        requestedAt: FieldValue.serverTimestamp(),
        purgeAfter: closedIds.length > 0 ? purgeAfter : null,
        status: 'requested',
        reason: 'owner_request',
        channel: options.channel,
        purgedShopIds: [],
        counts: { storageObjects: 0, firestoreDocs: 0 },
      });
      return { closedIds, purgeAfterMs: closedIds.length > 0 ? purgeAfter.toMillis() : null };
    }
    // Đã có bản ghi: chỉ bổ sung shop mới (nếu có), giữ nguyên thời điểm và hạn cũ.
    const knownClosed = (existing.shopIds as string[] | undefined) ?? [];
    const newClosed = closedIds.filter((id) => !knownClosed.includes(id));
    const newLeft = leftIds.filter(
      (id) => !((existing.leftShopIds as string[] | undefined) ?? []).includes(id),
    );
    const previousPurgeAfter = millisOf(existing.purgeAfter);
    if (newClosed.length > 0 || newLeft.length > 0) {
      tx.update(recordRef, {
        ...(newClosed.length > 0 ? { shopIds: FieldValue.arrayUnion(...newClosed) } : {}),
        ...(newLeft.length > 0 ? { leftShopIds: FieldValue.arrayUnion(...newLeft) } : {}),
        ...(newClosed.length > 0 && previousPurgeAfter === null ? { purgeAfter } : {}),
      });
    }
    const allClosed = [...new Set([...knownClosed, ...closedIds])];
    return {
      closedIds: allClosed,
      purgeAfterMs: previousPurgeAfter ?? (allClosed.length > 0 ? purgeAfter.toMillis() : null),
    };
  });

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (!isAuthUserMissing(error)) throw error;
  }

  const status = await db.runTransaction(async (tx) => {
    const record = await tx.get(recordRef);
    const current = record.data()?.status;
    // Purge có thể đã chạy xong trước khi lần gọi lại này xóa được Auth: không lùi trạng thái.
    const next: DeleteAccountResult['status'] =
      current === 'purged' ? 'purged' : step1.closedIds.length > 0 ? 'pending_purge' : 'completed';
    tx.update(recordRef, {
      status: next,
      ...(record.data()?.authDeletedAt ? {} : { authDeletedAt: FieldValue.serverTimestamp() }),
    });
    return next;
  });

  return { status, purgeAfterMs: step1.purgeAfterMs, closedShopCount: step1.closedIds.length };
}

// ---------- purgeDeletedShops ----------

/** Xóa đối tượng Storage theo tiền tố. Tách ra để test không cần Storage thật. */
export interface StoragePrefixDeleter {
  /** Tên tối đa `max` đối tượng còn lại dưới tiền tố (luôn từ đầu: đối tượng đã xóa không còn). */
  listNames(prefix: string, max: number): Promise<readonly string[]>;
  /** Xóa một đối tượng; không còn (404) coi như đã xóa. */
  deleteObject(name: string): Promise<void>;
}

export type PurgeOutcome = 'purged' | 'not_deleting' | 'not_due' | 'legal_hold' | 'incomplete';

export interface PurgeOptions {
  readonly nowMs: number;
  /** Mốc giờ (ms, theo `clock`) phải dừng để không vượt thời gian chạy tối đa của Function. */
  readonly deadlineMs: number;
  readonly clock?: () => number;
}

const STORAGE_PAGE = 500;
const DELETE_CONCURRENCY = 25;

/** Tiền tố Storage của shop, có `/` cuối: `shops/abc/` không khớp `shops/abcd/...`. */
export const shopStoragePrefix = (shopId: string) => `shops/${shopId}/`;

async function bumpCounts(
  db: Firestore,
  recordId: string | undefined,
  counts: { storageObjects?: number; firestoreDocs?: number },
) {
  if (!recordId) return;
  const update: Record<string, FieldValue> = {};
  if (counts.storageObjects)
    update['counts.storageObjects'] = FieldValue.increment(counts.storageObjects);
  if (counts.firestoreDocs)
    update['counts.firestoreDocs'] = FieldValue.increment(counts.firestoreDocs);
  if (Object.keys(update).length === 0) return;
  try {
    await db.doc(accountDeletionPath(recordId)).update(update);
  } catch (error) {
    // Không có bản ghi (shop bị đánh dấu bằng tay): không tạo mới bản ghi chỉ để đếm.
    if ((error as { code?: unknown } | null)?.code !== 5) throw error;
  }
}

/**
 * Xóa hẳn một shop đã quá hạn. Thứ tự: Storage -> mọi collection con -> tài liệu shop (sau cùng, vì nó
 * mang dấu `deleting`: purge bị ngắt giữa chừng luôn được lần sau tìm lại). Idempotent.
 */
export async function purgeShop(
  db: Firestore,
  storage: StoragePrefixDeleter,
  shopId: string,
  options: PurgeOptions,
): Promise<PurgeOutcome> {
  const clock = options.clock ?? Date.now;
  const shopRef = db.doc(`shops/${shopId}`);
  const shop = await shopRef.get();
  const data = shop.data();
  if (!shop.exists || data?.status !== 'deleting') return 'not_deleting';
  const purgeAfterMs = millisOf(data.purgeAfter);
  if (purgeAfterMs === null || purgeAfterMs > options.nowMs) return 'not_due';
  const recordId = typeof data.deletionRecordId === 'string' ? data.deletionRecordId : undefined;

  if (data.legalHold === true) {
    if (recordId) {
      const recordRef = db.doc(accountDeletionPath(recordId));
      const record = await recordRef.get();
      if (record.exists && record.data()?.lastSkipReason !== 'legal_hold_skip') {
        await recordRef.update({
          lastSkipReason: 'legal_hold_skip',
          lastSkippedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    return 'legal_hold';
  }

  // (1) Storage theo trang.
  const prefix = shopStoragePrefix(shopId);
  for (;;) {
    if (clock() >= options.deadlineMs) return 'incomplete';
    const names = await storage.listNames(prefix, STORAGE_PAGE);
    if (names.length === 0) break;
    for (let i = 0; i < names.length; i += DELETE_CONCURRENCY) {
      await Promise.all(
        names.slice(i, i + DELETE_CONCURRENCY).map((name) => {
          // Phòng thủ: không bao giờ xóa ngoài tiền tố của shop, dù adapter trả sai.
          if (!name.startsWith(prefix)) throw new Error('storage name outside shop prefix');
          return storage.deleteObject(name);
        }),
      );
    }
    await bumpCounts(db, recordId, { storageObjects: names.length });
  }

  // (2) Mọi collection con (orders + lines/packages, sessions, evidence, returns, members,
  // evidenceReverify, auditEvents, và collection sau này) — tài liệu shop còn nguyên.
  for (const collection of await shopRef.listCollections()) {
    if (clock() >= options.deadlineMs) return 'incomplete';
    let deleted = 0;
    const writer = db.bulkWriter();
    writer.onWriteResult(() => {
      deleted += 1;
    });
    await db.recursiveDelete(collection, writer);
    await writer.close();
    await bumpCounts(db, recordId, { firestoreDocs: deleted });
  }

  // (3) Tài liệu shop + bản ghi, cùng một transaction.
  await db.runTransaction(async (tx) => {
    const recordRef = recordId ? db.doc(accountDeletionPath(recordId)) : undefined;
    const [current, record] = await Promise.all([
      tx.get(shopRef),
      recordRef ? tx.get(recordRef) : Promise.resolve(undefined),
    ]);
    if (current.exists) tx.delete(shopRef);
    if (recordRef && record?.exists) {
      const recordData = record.data() ?? {};
      const shopIds = (recordData.shopIds as string[] | undefined) ?? [];
      const purged = new Set([
        ...((recordData.purgedShopIds as string[] | undefined) ?? []),
        shopId,
      ]);
      const allPurged = shopIds.every((id) => purged.has(id));
      tx.update(recordRef, {
        purgedShopIds: FieldValue.arrayUnion(shopId),
        'counts.firestoreDocs': FieldValue.increment(current.exists ? 1 : 0),
        ...(allPurged ? { status: 'purged', purgedAt: FieldValue.serverTimestamp() } : {}),
      });
    }
  });
  return 'purged';
}

export interface PurgeSummary {
  readonly scanned: number;
  readonly outcomes: Readonly<Record<PurgeOutcome, number>>;
  /** Dừng vì hết thời gian; phần còn lại chạy lần sau. */
  readonly stoppedEarly: boolean;
}

/**
 * Chạy hằng ngày: duyệt shop có `purgeAfter <= now` theo trang (chỉ mục một trường tự động) và purge
 * từng shop. Hết thời gian thì dừng; lần sau chạy tiếp (idempotent).
 */
export async function purgeDeletedShops(
  db: Firestore,
  storage: StoragePrefixDeleter,
  options: PurgeOptions & { readonly pageSize?: number },
): Promise<PurgeSummary> {
  const clock = options.clock ?? Date.now;
  const pageSize = options.pageSize ?? 20;
  const outcomes: Record<PurgeOutcome, number> = {
    purged: 0,
    not_deleting: 0,
    not_due: 0,
    legal_hold: 0,
    incomplete: 0,
  };
  let scanned = 0;
  let cursor: DocumentSnapshot | undefined;
  for (;;) {
    let query = db
      .collection('shops')
      .where('purgeAfter', '<=', Timestamp.fromMillis(options.nowMs))
      .orderBy('purgeAfter')
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) return { scanned, outcomes, stoppedEarly: false };
    for (const shop of page.docs) {
      if (clock() >= options.deadlineMs) return { scanned, outcomes, stoppedEarly: true };
      scanned += 1;
      const outcome = await purgeShop(db, storage, shop.id, { ...options, clock });
      outcomes[outcome] += 1;
      if (outcome === 'incomplete') return { scanned, outcomes, stoppedEarly: true };
    }
    cursor = page.docs[page.docs.length - 1];
    if (page.size < pageSize) return { scanned, outcomes, stoppedEarly: false };
  }
}
