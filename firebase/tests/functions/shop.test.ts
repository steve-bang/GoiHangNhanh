import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import {
  createShopForUser,
  parseShopId,
  parseShopInput,
  SELLING_SOURCES,
  ShopError,
  updateShopForUser,
} from '../../functions/src/shop';
import { ORDER_SOURCES } from '@/core/orders/order-source';
import { REMOTE_ORDER_SOURCES, toRemoteSources } from '@/core/orders/remote-source';

// Chạy trên Firestore Emulator (FIRESTORE_EMULATOR_HOST do `firebase emulators:exec` đặt).
let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-doncung' }, 'shop-fn-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

let counter = 0;
const newUid = () => `fn-user-${Date.now()}-${(counter += 1)}`;

describe('parseShopInput', () => {
  it('cắt khoảng trắng, bỏ trùng và xếp nguồn bán theo thứ tự chuẩn', () => {
    expect(
      parseShopInput({ name: '  Shop A ', sellingSources: ['lazada', 'shopee', 'lazada'] }),
    ).toEqual({ name: 'Shop A', sellingSources: ['shopee', 'lazada'] });
  });

  it.each([
    [null],
    [{ name: '', sellingSources: [] }],
    [{ name: '   ', sellingSources: [] }],
    [{ name: 'x'.repeat(51), sellingSources: [] }],
    [{ name: 'A', sellingSources: ['tiki'] }],
    // Giá trị app chưa qua ánh xạ: Function không nhận (app phải gửi `other_unknown`).
    [{ name: 'A', sellingSources: ['other'] }],
    [{ name: 'A', sellingSources: 'shopee' }],
    [{ name: 5, sellingSources: [] }],
  ])('từ chối đầu vào sai %j', (input) => {
    expect(() => parseShopInput(input)).toThrow(ShopError);
  });
});

describe('từ vựng nguồn bán app <-> Function', () => {
  it('Function dùng đúng từ vựng máy chủ của app (REMOTE_ORDER_SOURCES)', () => {
    expect([...SELLING_SOURCES]).toEqual([...REMOTE_ORDER_SOURCES]);
  });

  it('mọi nguồn bán của app sau ánh xạ đều được parseShopInput nhận, gồm "Khác"', () => {
    expect(parseShopInput({ name: 'A', sellingSources: toRemoteSources(ORDER_SOURCES) })).toEqual({
      name: 'A',
      sellingSources: ['shopee', 'tiktok_shop', 'lazada', 'other_unknown'],
    });
  });
});

describe('createShopForUser', () => {
  it('tạo shop, thành viên owner, chỉ mục userShops và một sự kiện kiểm toán', async () => {
    const uid = newUid();
    const shop = await createShopForUser(db, uid, { name: 'Shop A', sellingSources: ['shopee'] });
    expect((await db.doc(`shops/${shop.id}`).get()).data()).toMatchObject({
      name: 'Shop A',
      createdBy: uid,
      dataSource: 'user_entered',
    });
    expect((await db.doc(`shops/${shop.id}/members/${uid}`).get()).data()).toMatchObject({
      roles: ['owner'],
      status: 'active',
    });
    expect((await db.doc(`userShops/${uid}`).get()).data()?.shopId).toBe(shop.id);
    const audit = await db.collection(`shops/${shop.id}/auditEvents`).get();
    expect(audit.docs.map((d) => d.data().type)).toEqual(['shop.created']);
  });

  it('gọi lặp cùng tài khoản trả CÙNG shop, không tạo shop thứ hai (idempotent)', async () => {
    const uid = newUid();
    const input = { name: 'Shop A', sellingSources: [] } as const;
    const first = await createShopForUser(db, uid, input);
    const second = await createShopForUser(db, uid, { ...input, name: 'Tên khác' });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Shop A');
    expect((await db.doc(`userShops/${uid}`).get()).data()?.shopId).toBe(first.id);
  });

  it('gọi song song vẫn chỉ ra một shop', async () => {
    const uid = newUid();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        createShopForUser(db, uid, { name: 'Shop A', sellingSources: [] }),
      ),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  }, 20_000);
});

describe('updateShopForUser', () => {
  it('chủ shop sửa được và có sự kiện kiểm toán trước/sau', async () => {
    const uid = newUid();
    const shop = await createShopForUser(db, uid, { name: 'Shop A', sellingSources: ['shopee'] });
    const updated = await updateShopForUser(db, uid, shop.id, {
      name: 'Shop B',
      sellingSources: [],
    });
    expect(updated).toEqual({ id: shop.id, name: 'Shop B', sellingSources: [] });
    const events = (await db.collection(`shops/${shop.id}/auditEvents`).get()).docs.map((d) =>
      d.data(),
    );
    const change = events.find((e) => e.type === 'shop.updated');
    expect(change?.before).toEqual({ name: 'Shop A', sellingSources: ['shopee'] });
    expect(change?.after).toEqual({ name: 'Shop B', sellingSources: [] });
  });

  it('tạo và sửa shop có nguồn "Khác" (other_unknown) được lưu nguyên', async () => {
    const uid = newUid();
    const shop = await createShopForUser(
      db,
      uid,
      parseShopInput({ name: 'Shop K', sellingSources: ['other_unknown'] }),
    );
    expect(shop.sellingSources).toEqual(['other_unknown']);
    const updated = await updateShopForUser(
      db,
      uid,
      shop.id,
      parseShopInput({ name: 'Shop K2', sellingSources: ['other_unknown', 'shopee'] }),
    );
    expect(updated).toEqual({
      id: shop.id,
      name: 'Shop K2',
      sellingSources: ['shopee', 'other_unknown'],
    });
    expect((await db.doc(`shops/${shop.id}`).get()).data()?.sellingSources).toEqual([
      'shopee',
      'other_unknown',
    ]);
  });

  it('người ngoài shop và shop không tồn tại cùng bị từ chối (không lộ ID)', async () => {
    const shop = await createShopForUser(db, newUid(), { name: 'Shop A', sellingSources: [] });
    const input = { name: 'X', sellingSources: [] } as const;
    await expect(updateShopForUser(db, newUid(), shop.id, input)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(updateShopForUser(db, newUid(), 'khong-co-shop', input)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('thành viên đã thu hồi hoặc chỉ là packer không sửa được', async () => {
    const owner = newUid();
    const shop = await createShopForUser(db, owner, { name: 'Shop A', sellingSources: [] });
    const packer = newUid();
    const revoked = newUid();
    await db.doc(`shops/${shop.id}/members/${packer}`).set({ roles: ['packer'], status: 'active' });
    await db
      .doc(`shops/${shop.id}/members/${revoked}`)
      .set({ roles: ['owner'], status: 'revoked' });
    const input = { name: 'X', sellingSources: [] } as const;
    await expect(updateShopForUser(db, packer, shop.id, input)).rejects.toBeInstanceOf(ShopError);
    await expect(updateShopForUser(db, revoked, shop.id, input)).rejects.toBeInstanceOf(ShopError);
  });
});

describe('parseShopId', () => {
  it('nhận mã cùng mẫu ID với các callable khác, từ chối ký tự đường dẫn, rỗng, quá dài, sai kiểu', () => {
    expect(parseShopId({ shopId: 'shop_A-1' })).toBe('shop_A-1');
    for (const bad of [
      null,
      {},
      { shopId: '' },
      { shopId: '../x' },
      { shopId: 'a/b' },
      { shopId: 'a'.repeat(129) },
      { shopId: 5 },
    ]) {
      expect(() => parseShopId(bad)).toThrow(ShopError);
    }
  });
});
