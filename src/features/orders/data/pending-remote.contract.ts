import type { PackageId, SessionId, ShopId } from '@/core/ids';

import type { OrderDetails } from '../domain/types';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import type { OrderStore } from '../domain/order-store';
import { buildPackingSession } from '../domain/start-session';
import { buildNextPackage } from '../domain/build-order';
import { makeOrder, testIds } from './order-store.contract';

export interface PendingRemoteHarness {
  readonly store: OrderStore;
  /** Đổi tài khoản đang đăng nhập (kho đọc uid mỗi lần lưu); `null` = chưa biết ai. Mặc định `U`. */
  readonly setUid: (uid: string | null) => void;
}

/** Tài khoản mặc định của bài test (người tạo). */
const U = 'user-a';
const V = 'user-b';

const setStatus = (h: PendingRemoteHarness, id: string, status: string) =>
  h.store.updateSessionStatus(LOCAL_SHOP_ID, id as SessionId, status);

async function orderWithSession(h: PendingRemoteHarness, code: string, at: number) {
  const details = makeOrder(code, { lines: [{ name: 'Áo' }], at });
  await h.store.saveNewOrder(details);
  const pkg = details.packages[0];
  if (!pkg) throw new Error('fixture');
  const built = buildPackingSession(details, pkg.id, {
    sessionId: `sess-${code}` as SessionId,
    nowDevice: at + 10,
  });
  if (!built.ok) throw new Error('fixture');
  await h.store.saveSession(built.session);
  return { details, session: built.session };
}

const ids = (d: OrderDetails): PackageId[] => d.packages.map((p) => p.id);

/** Hợp đồng đồng bộ một chiều lên máy chủ: việc cần đăng suy ra từ dữ liệu cục bộ. */
export function runPendingRemoteContract(
  name: string,
  create: () => Promise<PendingRemoteHarness>,
) {
  describe(`cần đăng lên máy chủ: ${name}`, () => {
    it('đơn chưa có phiên thì chưa cần đăng (đơn còn sửa được)', async () => {
      const h = await create();
      await h.store.saveNewOrder(makeOrder('A', { lines: [{ name: 'Áo' }] }));
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U)).toEqual([]);
    });

    it('đơn đã có phiên cần đăng, đủ dòng + kiện, cũ nhất trước; đăng xong thì hết', async () => {
      const h = await create();
      const late = await orderWithSession(h, 'LATE', 3000);
      const early = await orderWithSession(h, 'EARLY', 1000);
      const pending = await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U);
      expect(pending.map((d) => d.order.id)).toEqual([
        early.details.order.id,
        late.details.order.id,
      ]);
      expect(pending[0]?.lines).toHaveLength(1);
      expect(pending[0]?.packages).toHaveLength(1);
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 1, U)).toHaveLength(1);
      await h.store.markOrderPublished(
        LOCAL_SHOP_ID,
        early.details.order.id,
        9000,
        U,
        ids(early.details),
      );
      await h.store.markOrderPublished(
        LOCAL_SHOP_ID,
        early.details.order.id,
        9001,
        U,
        ids(early.details),
      ); // idempotent
      expect(
        (await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U)).map((d) => d.order.id),
      ).toEqual([late.details.order.id]);
    });

    it('cô lập shop: không thấy và không đánh dấu được đơn của shop khác', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'ISO', 1000);
      const other = 'shop-khac' as ShopId;
      expect(await h.store.listOrdersPendingRemote(other, 10, U)).toEqual([]);
      await h.store.markOrderPublished(other, a.details.order.id, 1, U, ids(a.details));
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U)).toHaveLength(1);
    });

    it('phiên created không bao giờ cần đăng', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'CRE', 1000);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toEqual([]);
    });

    it('phiên recording cần đăng khi đơn đã đăng; đổi trạng thái thì cần đăng lại', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'REC', 1000);
      await setStatus(h, a.session.id, 'recording');
      // Đơn chưa đăng: chưa đăng phiên (Rules cần đơn tồn tại trước).
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toEqual([]);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      const first = await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U);
      expect(first).toHaveLength(1);
      expect(first[0]).toMatchObject({ status: 'recording', session: { id: a.session.id } });
      await h.store.markSessionPublished(LOCAL_SHOP_ID, a.session.id, 'recording');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toEqual([]);
      await setStatus(h, a.session.id, 'ended');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toMatchObject([
        { status: 'ended' },
      ]);
    });

    it('isSessionPublished: chỉ đúng sau khi phiên đã đăng (mọi trạng thái), cô lập shop', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'PUB', 1000);
      await setStatus(h, a.session.id, 'recording');
      expect(await h.store.isSessionPublished(LOCAL_SHOP_ID, a.session.id)).toBe(false);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      await h.store.markSessionPublished(LOCAL_SHOP_ID, a.session.id, 'recording');
      expect(await h.store.isSessionPublished(LOCAL_SHOP_ID, a.session.id)).toBe(true);
      // Đổi trạng thái sau khi đăng: phiên vẫn có trên máy chủ (chỉ chờ cập nhật trạng thái).
      await setStatus(h, a.session.id, 'ended');
      expect(await h.store.isSessionPublished(LOCAL_SHOP_ID, a.session.id)).toBe(true);
      expect(await h.store.isSessionPublished('shop-khac' as ShopId, a.session.id)).toBe(false);
      expect(await h.store.isSessionPublished(LOCAL_SHOP_ID, 'khong-co' as SessionId)).toBe(false);
    });

    it('cô lập shop với phiên', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'SI', 1000);
      await setStatus(h, a.session.id, 'recording');
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      expect(await h.store.listSessionsPendingRemote('shop-khac' as ShopId, 10, U)).toEqual([]);
      await h.store.markSessionPublished('shop-khac' as ShopId, a.session.id, 'recording');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toHaveLength(1);
    });

    it('chỉ đăng bản ghi do CHÍNH tài khoản đang đăng nhập tạo: máy dùng chung không ghi nhầm người tạo', async () => {
      const h = await create();
      const mine = await orderWithSession(h, 'MINE', 1000);
      h.setUid(V);
      const theirs = await orderWithSession(h, 'THEIRS', 2000);
      h.setUid(U);
      // Mỗi người chỉ thấy việc của mình.
      expect(
        (await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U)).map((d) => d.order.id),
      ).toEqual([mine.details.order.id]);
      expect(
        (await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, V)).map((d) => d.order.id),
      ).toEqual([theirs.details.order.id]);
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, 'nguoi-la')).toEqual([]);
      // Người tạo đọc lại được từ kho (đơn, kiện, phiên).
      const stored = await h.store.getOrder(LOCAL_SHOP_ID, theirs.details.order.id);
      expect(stored?.order.createdBy).toBe(V);
      expect(stored?.packages[0]?.createdBy).toBe(V);
      expect((await h.store.getSession(LOCAL_SHOP_ID, theirs.session.id))?.createdBy).toBe(V);
      // Phiên cũng theo người tạo.
      await h.store.markOrderPublished(
        LOCAL_SHOP_ID,
        mine.details.order.id,
        5,
        U,
        ids(mine.details),
      );
      await h.store.markOrderPublished(
        LOCAL_SHOP_ID,
        theirs.details.order.id,
        5,
        V,
        ids(theirs.details),
      );
      await setStatus(h, mine.session.id, 'recording');
      await setStatus(h, theirs.session.id, 'recording');
      expect(
        (await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).map((p) => p.session.id),
      ).toEqual([mine.session.id]);
      expect(
        (await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, V)).map((p) => p.session.id),
      ).toEqual([theirs.session.id]);
    });

    it('bản ghi tạo khi chưa biết ai đăng nhập không có người tạo và không bao giờ được đăng', async () => {
      const h = await create();
      h.setUid(null);
      const a = await orderWithSession(h, 'ANON', 1000);
      h.setUid(U);
      const stored = await h.store.getOrder(LOCAL_SHOP_ID, a.details.order.id);
      expect(stored?.order).not.toHaveProperty('createdBy');
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U)).toEqual([]);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      await setStatus(h, a.session.id, 'recording');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toEqual([]);
    });

    it('createdBy do người gọi tự khai bị bỏ qua: kho chỉ tin uid của phiên đăng nhập', async () => {
      const h = await create();
      const details = makeOrder('SPOOF', { lines: [{ name: 'Áo' }] });
      await h.store.saveNewOrder({
        ...details,
        order: { ...details.order, createdBy: V },
        packages: details.packages.map((p) => ({ ...p, createdBy: V })),
      });
      const stored = await h.store.getOrder(LOCAL_SHOP_ID, details.order.id);
      expect(stored?.order.createdBy).toBe(U);
      expect(stored?.packages.every((p) => p.createdBy === U)).toBe(true);
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, V)).toEqual([]);
    });

    it('kiện thêm bởi người khác mang uid người đó (đăng thế nào là việc của sync)', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'PKG', 1000);
      h.setUid(V);
      const next = buildNextPackage(a.details, { ids: testIds, nowDevice: 3000 });
      await h.store.addPackage(LOCAL_SHOP_ID, next);
      const stored = await h.store.getOrder(LOCAL_SHOP_ID, a.details.order.id);
      expect(stored?.packages.map((p) => p.createdBy)).toEqual([U, V]);
    });

    it('theo dõi kiện đã đăng: đăng đơn đánh dấu kiện của người tạo; kiện thêm sau (cùng người) cần đăng riêng rồi hết', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'TRK', 1000);
      await setStatus(h, a.session.id, 'recording');
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      // Kiện đầu đã đăng cùng đơn: phiên không cần đảm bảo kiện nữa.
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toMatchObject([
        { packagePending: false },
      ]);
      // Kiện thêm sau khi đơn đã đăng, rồi phiên trên kiện đó.
      const next = buildNextPackage(a.details, { ids: testIds, nowDevice: 3000 });
      await h.store.addPackage(LOCAL_SHOP_ID, next);
      const second = buildPackingSession(
        { ...a.details, packages: [...a.details.packages, next] },
        next.id,
        { sessionId: 'sess-TRK-2' as SessionId, nowDevice: 4000 },
      );
      if (!second.ok) throw new Error('fixture');
      await h.store.saveSession(second.session);
      await setStatus(h, second.session.id, 'recording');
      const pending = await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U);
      expect(pending.find((p) => p.session.id === second.session.id)?.packagePending).toBe(true);
      await h.store.markPackagePublished(LOCAL_SHOP_ID, next.id, 6);
      await h.store.markPackagePublished(LOCAL_SHOP_ID, next.id, 7); // idempotent
      const after = await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U);
      expect(after.find((p) => p.session.id === second.session.id)?.packagePending).toBe(false);
    });

    it('chỉ đánh dấu ĐÚNG các kiện đã đăng: kiện thêm sau lúc đọc vẫn chờ đăng', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'RACE', 1000);
      const [read] = await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10, U);
      if (!read) throw new Error('fixture');
      // Sau khi đọc (K1) mà trước khi đánh dấu: thêm K2 + phiên trên K2.
      const next = buildNextPackage(a.details, { ids: testIds, nowDevice: 3000 });
      await h.store.addPackage(LOCAL_SHOP_ID, next);
      const second = buildPackingSession(
        { ...a.details, packages: [...a.details.packages, next] },
        next.id,
        { sessionId: 'sess-RACE-2' as SessionId, nowDevice: 4000 },
      );
      if (!second.ok) throw new Error('fixture');
      await h.store.saveSession(second.session);
      await setStatus(h, second.session.id, 'recording');
      await setStatus(h, a.session.id, 'recording');
      await h.store.markOrderPublished(LOCAL_SHOP_ID, read.order.id, 5, U, ids(read));
      const pending = await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U);
      expect(pending.find((p) => p.session.id === second.session.id)?.packagePending).toBe(true);
      expect(pending.find((p) => p.session.id === a.session.id)?.packagePending).toBe(false);
    });

    it('phiên trên kiện do NGƯỜI KHÁC tạo mà kiện chưa đăng thì chờ; khi kiện đã đăng thì đăng được', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'FOR', 1000); // đơn + kiện đầu của U
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      h.setUid(V);
      const next = buildNextPackage(a.details, { ids: testIds, nowDevice: 3000 });
      await h.store.addPackage(LOCAL_SHOP_ID, next); // kiện của V
      h.setUid(U);
      const built = buildPackingSession(
        { ...a.details, packages: [...a.details.packages, next] },
        next.id,
        { sessionId: 'sess-FOR-2' as SessionId, nowDevice: 4000 },
      );
      if (!built.ok) throw new Error('fixture');
      await h.store.saveSession(built.session); // phiên của U trên kiện của V
      await setStatus(h, built.session.id, 'recording');
      // Kiện của V chưa đăng: phiên của U chờ (U không đăng thay V được).
      expect(
        (await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).map((p) => p.session.id),
      ).not.toContain(built.session.id);
      // V đăng kiện của mình (đánh dấu): phiên của U đăng được và không cần đảm bảo kiện nữa.
      await h.store.markPackagePublished(LOCAL_SHOP_ID, next.id, 8);
      expect(
        (await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).find(
          (p) => p.session.id === built.session.id,
        ),
      ).toMatchObject({ packagePending: false });
    });

    it('cô lập shop: không đánh dấu kiện của shop khác', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'PI', 1000);
      await setStatus(h, a.session.id, 'recording');
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5, U, ids(a.details));
      const pkg = a.details.packages[0];
      if (!pkg) throw new Error('fixture');
      // Kiện đã đăng cùng đơn; dựng lại tình huống chưa đăng bằng cách hỏi shop khác không đổi gì.
      await h.store.markPackagePublished('shop-khac' as ShopId, pkg.id, 9);
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10, U)).toMatchObject([
        { packagePending: false },
      ]);
    });
  });
}
