import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { isValidId } from './ids';

/**
 * Nguồn bán hợp lệ theo từ vựng MÁY CHỦ, thứ tự chuẩn. Khớp `REMOTE_ORDER_SOURCES` ở
 * src/core/orders/remote-source.ts (app dùng `other`, ánh xạ sang `other_unknown` khi gửi lên).
 */
export const SELLING_SOURCES = ['shopee', 'tiktok_shop', 'lazada', 'other_unknown'] as const;
export type SellingSource = (typeof SELLING_SOURCES)[number];

export interface ShopInput {
  readonly name: string;
  readonly sellingSources: readonly SellingSource[];
}

export interface ShopResult {
  readonly id: string;
  readonly name: string;
  readonly sellingSources: readonly SellingSource[];
}

/** Lỗi nghiệp vụ của Function; lớp `index.ts` đổi sang HttpsError. */
export class ShopError extends Error {
  constructor(
    readonly code: 'invalid-argument' | 'permission-denied' | 'not-found',
    message: string,
  ) {
    super(message);
  }
}

/** Kiểm tra và chuẩn hóa đầu vào (không tin client): tên 1-50 ký tự, nguồn bán không trùng, theo thứ tự chuẩn. */
export function parseShopInput(data: unknown): ShopInput {
  if (typeof data !== 'object' || data === null) {
    throw new ShopError('invalid-argument', 'Thiếu dữ liệu.');
  }
  const { name, sellingSources } = data as { name?: unknown; sellingSources?: unknown };
  if (typeof name !== 'string') throw new ShopError('invalid-argument', 'Tên shop không hợp lệ.');
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new ShopError('invalid-argument', 'Tên shop phải từ 1 đến 50 ký tự.');
  }
  if (!Array.isArray(sellingSources)) {
    throw new ShopError('invalid-argument', 'Nguồn bán không hợp lệ.');
  }
  for (const source of sellingSources) {
    if (!SELLING_SOURCES.includes(source as SellingSource)) {
      throw new ShopError('invalid-argument', 'Nguồn bán không hợp lệ.');
    }
  }
  return {
    name: trimmed,
    sellingSources: SELLING_SOURCES.filter((source) => sellingSources.includes(source)),
  };
}

/** Mã shop từ client: cùng mẫu ID với các callable khác (không ký tự đường dẫn). */
export function parseShopId(data: unknown): string {
  const { shopId } = (data ?? {}) as { shopId?: unknown };
  if (!isValidId(shopId)) throw new ShopError('invalid-argument', 'Mã shop không hợp lệ.');
  return shopId;
}

function toResult(id: string, data: FirebaseFirestore.DocumentData): ShopResult {
  return { id, name: data.name as string, sellingSources: data.sellingSources as SellingSource[] };
}

/**
 * Tạo shop, idempotent theo tài khoản (decisions.md Q-13b): trong MỘT transaction, nếu
 * `userShops/{uid}` đã có thì trả shop đó, không tạo shop thứ hai. Ghi shop, thành viên `owner`,
 * chỉ mục `userShops` và một sự kiện kiểm toán cùng lúc.
 */
export async function createShopForUser(
  db: Firestore,
  uid: string,
  input: ShopInput,
): Promise<ShopResult> {
  const indexRef = db.doc(`userShops/${uid}`);
  return db.runTransaction(async (tx) => {
    const index = await tx.get(indexRef);
    const existingId = index.data()?.shopId as string | undefined;
    if (existingId) {
      const existing = await tx.get(db.doc(`shops/${existingId}`));
      if (existing.exists) return toResult(existingId, existing.data() ?? {});
    }
    const shopRef = db.collection('shops').doc();
    tx.set(shopRef, {
      name: input.name,
      sellingSources: input.sellingSources,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      dataSource: 'user_entered',
    });
    tx.set(shopRef.collection('members').doc(uid), {
      roles: ['owner'],
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(indexRef, { shopId: shopRef.id, updatedAt: FieldValue.serverTimestamp() });
    tx.set(shopRef.collection('auditEvents').doc(), {
      type: 'shop.created',
      actorUid: uid,
      at: FieldValue.serverTimestamp(),
      after: { name: input.name, sellingSources: input.sellingSources },
    });
    return { id: shopRef.id, name: input.name, sellingSources: input.sellingSources };
  });
}

/** Sửa shop: chỉ thành viên đang hoạt động có vai trò owner/manager; ghi bản trước/sau vào kiểm toán. */
export async function updateShopForUser(
  db: Firestore,
  uid: string,
  shopId: string,
  input: ShopInput,
): Promise<ShopResult> {
  const shopRef = db.doc(`shops/${shopId}`);
  return db.runTransaction(async (tx) => {
    const [member, shop] = await Promise.all([
      tx.get(shopRef.collection('members').doc(uid)),
      tx.get(shopRef),
    ]);
    const roles = (member.data()?.roles as string[] | undefined) ?? [];
    const allowed =
      member.exists &&
      member.data()?.status === 'active' &&
      roles.some((role) => role === 'owner' || role === 'manager');
    // Không phân biệt "shop không tồn tại" với "không có quyền" để không lộ ID shop khác.
    if (!allowed || !shop.exists) {
      throw new ShopError('permission-denied', 'Không có quyền sửa shop này.');
    }
    const before = shop.data() ?? {};
    tx.update(shopRef, {
      name: input.name,
      sellingSources: input.sellingSources,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });
    tx.set(shopRef.collection('auditEvents').doc(), {
      type: 'shop.updated',
      actorUid: uid,
      at: FieldValue.serverTimestamp(),
      before: { name: before.name, sellingSources: before.sellingSources },
      after: { name: input.name, sellingSources: input.sellingSources },
    });
    return { id: shopId, name: input.name, sellingSources: input.sellingSources };
  });
}
