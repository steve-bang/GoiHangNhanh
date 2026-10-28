import type { SessionId, ShopId } from '@/core/ids';

import { LOCAL_SHOP_ID } from '../domain/local-shop';
import type { OrderStore } from '../domain/order-store';
import { buildPackingSession } from '../domain/start-session';
import { makeOrder } from './order-store.contract';

export interface PendingRemoteHarness {
  readonly store: OrderStore;
}

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

/** Hợp đồng đồng bộ một chiều lên máy chủ: việc cần đăng suy ra từ dữ liệu cục bộ. */
export function runPendingRemoteContract(
  name: string,
  create: () => Promise<PendingRemoteHarness>,
) {
  describe(`cần đăng lên máy chủ: ${name}`, () => {
    it('đơn chưa có phiên thì chưa cần đăng (đơn còn sửa được)', async () => {
      const h = await create();
      await h.store.saveNewOrder(makeOrder('A', { lines: [{ name: 'Áo' }] }));
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10)).toEqual([]);
    });

    it('đơn đã có phiên cần đăng, đủ dòng + kiện, cũ nhất trước; đăng xong thì hết', async () => {
      const h = await create();
      const late = await orderWithSession(h, 'LATE', 3000);
      const early = await orderWithSession(h, 'EARLY', 1000);
      const pending = await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10);
      expect(pending.map((d) => d.order.id)).toEqual([
        early.details.order.id,
        late.details.order.id,
      ]);
      expect(pending[0]?.lines).toHaveLength(1);
      expect(pending[0]?.packages).toHaveLength(1);
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 1)).toHaveLength(1);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, early.details.order.id, 9000);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, early.details.order.id, 9001); // idempotent
      expect(
        (await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10)).map((d) => d.order.id),
      ).toEqual([late.details.order.id]);
    });

    it('cô lập shop: không thấy và không đánh dấu được đơn của shop khác', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'ISO', 1000);
      const other = 'shop-khac' as ShopId;
      expect(await h.store.listOrdersPendingRemote(other, 10)).toEqual([]);
      await h.store.markOrderPublished(other, a.details.order.id, 1);
      expect(await h.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 10)).toHaveLength(1);
    });

    it('phiên created không bao giờ cần đăng', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'CRE', 1000);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5);
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10)).toEqual([]);
    });

    it('phiên recording cần đăng khi đơn đã đăng; đổi trạng thái thì cần đăng lại', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'REC', 1000);
      await setStatus(h, a.session.id, 'recording');
      // Đơn chưa đăng: chưa đăng phiên (Rules cần đơn tồn tại trước).
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10)).toEqual([]);
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5);
      const first = await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10);
      expect(first).toHaveLength(1);
      expect(first[0]).toMatchObject({ status: 'recording', session: { id: a.session.id } });
      await h.store.markSessionPublished(LOCAL_SHOP_ID, a.session.id, 'recording');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10)).toEqual([]);
      await setStatus(h, a.session.id, 'ended');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10)).toMatchObject([
        { status: 'ended' },
      ]);
    });

    it('cô lập shop với phiên', async () => {
      const h = await create();
      const a = await orderWithSession(h, 'SI', 1000);
      await setStatus(h, a.session.id, 'recording');
      await h.store.markOrderPublished(LOCAL_SHOP_ID, a.details.order.id, 5);
      expect(await h.store.listSessionsPendingRemote('shop-khac' as ShopId, 10)).toEqual([]);
      await h.store.markSessionPublished('shop-khac' as ShopId, a.session.id, 'recording');
      expect(await h.store.listSessionsPendingRemote(LOCAL_SHOP_ID, 10)).toHaveLength(1);
    });
  });
}
