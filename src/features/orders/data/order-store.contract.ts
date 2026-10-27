import { AppError } from '@/core/errors/app-error';
import type { OrderId, PackageId, SessionId, ShopId } from '@/core/ids';

import { buildNextPackage, buildOrder, type IdFactory } from '../domain/build-order';
import { toCodeKey } from '../domain/codes';
import type { OrderStore } from '../domain/order-store';
import { buildPackingSession } from '../domain/start-session';
import type { OrderDetails, PackingSession } from '../domain/types';
import { LOCAL_SHOP_ID } from '../domain/local-shop';

let seq = 0;
export const testIds: IdFactory = {
  orderId: () => `order-${(seq += 1)}` as OrderId,
  lineId: () => `line-${(seq += 1)}` as never,
  packageId: () => `pkg-${(seq += 1)}` as PackageId,
};

export function makeOrder(
  code: string,
  options: {
    source?: 'shopee' | 'other';
    tracking?: string;
    at?: number;
    lines?: { name: string; variant?: string; quantity?: number }[];
  } = {},
): OrderDetails {
  const result = buildOrder(
    {
      orderCode: code,
      source: options.source ?? 'shopee',
      trackingCode: options.tracking ?? '',
      lines: (options.lines ?? []).map((l) => ({
        name: l.name,
        variant: l.variant ?? '',
        quantity: l.quantity ?? 1,
      })),
    },
    { shopId: LOCAL_SHOP_ID, ids: testIds, nowDevice: options.at ?? 1000 },
  );
  if (!result.ok) throw new Error('fixture invalid');
  return result.details;
}

/** Dựng và lưu phiên trên kiện đầu (hoặc `packageId`). `seedOrder`: lưu luôn đơn nếu chưa có. */
async function startSession(
  store: OrderStore,
  details: OrderDetails,
  sessionId: string,
  packageId?: PackageId,
  seedOrder = false,
): Promise<PackingSession> {
  if (seedOrder) await store.saveNewOrder(details);
  const target = packageId ?? details.packages[0]?.id;
  if (!target) throw new Error('fixture');
  const built = buildPackingSession(details, target, {
    sessionId: sessionId as SessionId,
    nowDevice: 5000,
  });
  if (!built.ok) throw new Error('fixture');
  await store.saveSession(built.session);
  return built.session;
}

/** Hợp đồng chung của OrderStore: chạy trên kho bộ nhớ và kho SQLite (SQLite của Node trong Jest). */
export function runOrderStoreContract(name: string, create: () => Promise<OrderStore>) {
  describe(`hợp đồng OrderStore: ${name}`, () => {
    it('lưu rồi đọc lại đơn + dòng + kiện, đúng thứ tự dòng, giữ nguồn dữ liệu do người dùng nhập', async () => {
      const store = await create();
      const details = makeOrder('DH1', {
        tracking: 'SPX1',
        lines: [
          { name: 'Áo', variant: 'Đen / XL', quantity: 2 },
          { name: 'Áo', variant: 'Trắng / L' },
        ],
      });
      await store.saveNewOrder(details);
      const loaded = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
      expect(loaded).toEqual(details);
      expect(loaded?.order.dataOrigin).toBe('entered_by_user');
      expect(loaded?.lines.map((l) => l.variant)).toEqual(['Đen / XL', 'Trắng / L']);
      expect(await store.getOrder(LOCAL_SHOP_ID, 'khong-co' as OrderId)).toBeNull();
    });

    it('đơn không có dòng nào vẫn lưu được (Chưa khai báo sản phẩm)', async () => {
      const store = await create();
      const details = makeOrder('DH2');
      await store.saveNewOrder(details);
      expect((await store.getOrder(LOCAL_SHOP_ID, details.order.id))?.lines).toEqual([]);
    });

    it('lưu cùng ID hai lần thì lỗi ORDER_SAVE_FAILED, không ghi đè', async () => {
      const store = await create();
      const details = makeOrder('DH3');
      await store.saveNewOrder(details);
      await expect(store.saveNewOrder(details)).rejects.toMatchObject({
        code: 'ORDER_SAVE_FAILED',
      });
      await expect(store.saveNewOrder(details)).rejects.toBeInstanceOf(AppError);
    });

    it('tìm theo khóa mã đơn hoặc mã vận đơn, trong đúng shop; không chọn hộ', async () => {
      const store = await create();
      const a = makeOrder('dh-1', { tracking: 'trk-9', at: 10 });
      const b = makeOrder('DH-1', { source: 'other', at: 20 });
      const c = makeOrder('DH-2', { tracking: 'TRK-9', at: 30 });
      for (const d of [a, b, c]) await store.saveNewOrder(d);
      const byCode = await store.findOrdersByCodes(LOCAL_SHOP_ID, {
        orderCodeKey: toCodeKey('DH-1'),
      });
      expect(byCode.map((o) => o.id)).toEqual([b.order.id, a.order.id]);
      const either = await store.findOrdersByCodes(LOCAL_SHOP_ID, {
        orderCodeKey: 'DH-1',
        trackingCodeKey: 'TRK-9',
      });
      expect(either).toHaveLength(3);
      expect(await store.findOrdersByCodes(LOCAL_SHOP_ID, {})).toEqual([]);
      expect(await store.findOrdersByCodes('shop-khac' as never, { orderCodeKey: 'DH-1' })).toEqual(
        [],
      );
    });

    it('lịch sử dòng gần đây: mới trước, đúng shop, có giới hạn', async () => {
      const store = await create();
      await store.saveNewOrder(makeOrder('A', { at: 1, lines: [{ name: 'Cũ' }] }));
      await store.saveNewOrder(
        makeOrder('B', { at: 5, lines: [{ name: 'Mới' }, { name: 'Mới 2' }] }),
      );
      const all = await store.listRecentLines(LOCAL_SHOP_ID, 10);
      expect(all.map((l) => l.name)).toEqual(['Mới', 'Mới 2', 'Cũ']);
      expect(await store.listRecentLines(LOCAL_SHOP_ID, 1)).toHaveLength(1);
      expect(await store.listRecentLines('shop-khac' as never, 10)).toEqual([]);
    });

    it('sửa số lượng đúng dòng (đơn chưa có phiên); dòng không có thì lỗi ORDER_SAVE_FAILED', async () => {
      const store = await create();
      const details = makeOrder('Q', { lines: [{ name: 'Áo', quantity: 1 }, { name: 'Quần' }] });
      await store.saveNewOrder(details);
      const first = details.lines[0];
      if (!first) throw new Error('fixture');
      await store.updateLineQuantity(LOCAL_SHOP_ID, first.id, 4);
      const loaded = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
      expect(loaded?.lines.map((l) => l.quantity)).toEqual([4, 1]);
      await expect(
        store.updateLineQuantity(LOCAL_SHOP_ID, 'khong-co' as never, 2),
      ).rejects.toMatchObject({ code: 'ORDER_SAVE_FAILED' });
    });

    it('đơn đã có phiên: KHÔNG sửa được số lượng (ORDER_HAS_SESSION), số lượng cũ giữ nguyên (bất biến 7)', async () => {
      const store = await create();
      const details = makeOrder('QS', { lines: [{ name: 'Áo', quantity: 2 }] });
      await store.saveNewOrder(details);
      await startSession(store, details, 'sess-qs');
      const line = details.lines[0];
      if (!line) throw new Error('fixture');
      await expect(store.updateLineQuantity(LOCAL_SHOP_ID, line.id, 1)).rejects.toMatchObject({
        code: 'ORDER_HAS_SESSION',
      });
      const loaded = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
      expect(loaded?.lines[0]?.quantity).toBe(2);
      // đơn khác (chưa có phiên) vẫn sửa được
      const other = makeOrder('QS2', { lines: [{ name: 'Quần', quantity: 2 }] });
      await store.saveNewOrder(other);
      const otherLine = other.lines[0];
      if (!otherLine) throw new Error('fixture');
      await store.updateLineQuantity(LOCAL_SHOP_ID, otherLine.id, 3);
    });

    it('thêm kiện vẫn được khi đơn đã có phiên; ảnh chụp của phiên cũ không đổi', async () => {
      const store = await create();
      const details = makeOrder('KS', { lines: [{ name: 'Áo' }] });
      await store.saveNewOrder(details);
      const session = await startSession(store, details, 'sess-ks');
      await store.addPackage(
        LOCAL_SHOP_ID,
        buildNextPackage(details, { ids: testIds, nowDevice: 3000 }),
      );
      expect((await store.getSession(LOCAL_SHOP_ID, session.id))?.snapshot.packageCount).toBe(1);
    });

    it('một kiện chỉ có một phiên đang thực hiện: lưu phiên thứ hai trên cùng kiện bị từ chối', async () => {
      const store = await create();
      const details = makeOrder('AS');
      await store.saveNewOrder(details);
      await startSession(store, details, 'sess-a');
      await expect(startSession(store, details, 'sess-b')).rejects.toMatchObject({
        code: 'PACKAGE_SESSION_ACTIVE',
      });
      expect(await store.getSession(LOCAL_SHOP_ID, 'sess-b' as SessionId)).toBeNull();
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, details.order.id)).toHaveLength(1);
      // kiện khác của cùng đơn có phiên riêng
      const next = buildNextPackage(details, { ids: testIds, nowDevice: 2000 });
      await store.addPackage(LOCAL_SHOP_ID, next);
      const full = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
      if (!full) throw new Error('fixture');
      await startSession(store, full, 'sess-c', next.id);
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, details.order.id)).toHaveLength(2);
    });

    it('cô lập shop: shop khác không đọc, không sửa, không thêm kiện, không tạo phiên dù biết ID', async () => {
      const store = await create();
      const other = 'shop-khac' as ShopId;
      const details = makeOrder('ISO', { lines: [{ name: 'Áo', quantity: 2 }] });
      await store.saveNewOrder(details);
      const session = await startSession(store, makeOrder('ISO-S'), 'sess-iso', undefined, true);
      const line = details.lines[0];
      if (!line) throw new Error('fixture');
      expect(await store.getOrder(other, details.order.id)).toBeNull();
      expect(await store.getSession(other, session.id)).toBeNull();
      expect(await store.listSessionsOfOrder(other, session.orderId)).toEqual([]);
      await expect(store.updateLineQuantity(other, line.id, 9)).rejects.toMatchObject({
        code: 'ORDER_SAVE_FAILED',
      });
      await expect(
        store.addPackage(other, buildNextPackage(details, { ids: testIds, nowDevice: 4000 })),
      ).rejects.toMatchObject({ code: 'ORDER_SAVE_FAILED' });
      const pkg = details.packages[0];
      if (!pkg) throw new Error('fixture');
      const built = buildPackingSession(details, pkg.id, {
        sessionId: 'sess-x' as SessionId,
        nowDevice: 1,
      });
      if (!built.ok) throw new Error('fixture');
      await expect(store.saveSession({ ...built.session, shopId: other })).rejects.toMatchObject({
        code: 'LOCAL_SAVE_UNAVAILABLE',
      });
      // dữ liệu của shop gốc không bị đổi
      expect((await store.getOrder(LOCAL_SHOP_ID, details.order.id))?.lines[0]?.quantity).toBe(2);
    });

    it('thêm kiện: mỗi kiện có ID riêng và index tăng dần; đơn không tồn tại thì lỗi', async () => {
      const store = await create();
      const details = makeOrder('K');
      await store.saveNewOrder(details);
      const next = buildNextPackage(details, { ids: testIds, nowDevice: 2000 });
      await store.addPackage(LOCAL_SHOP_ID, next);
      const loaded = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
      expect(loaded?.packages.map((p) => p.index)).toEqual([1, 2]);
      expect(new Set(loaded?.packages.map((p) => p.id)).size).toBe(2);
      await expect(
        store.addPackage(LOCAL_SHOP_ID, {
          ...next,
          id: 'p-x' as PackageId,
          orderId: 'khong-co' as OrderId,
        }),
      ).rejects.toMatchObject({ code: 'ORDER_SAVE_FAILED' });
    });

    it('lưu và đọc phiên: gắn đúng đơn + kiện, ảnh chụp nguyên vẹn, trạng thái created', async () => {
      const store = await create();
      const details = makeOrder('S', { lines: [{ name: 'Áo', variant: 'Đen', quantity: 3 }] });
      await store.saveNewOrder(details);
      const pkg = details.packages[0];
      if (!pkg) throw new Error('fixture');
      const built = buildPackingSession(details, pkg.id, {
        sessionId: 'sess-1' as SessionId,
        nowDevice: 5000,
      });
      if (!built.ok) throw new Error('fixture');
      await store.saveSession(built.session);
      expect(await store.getSession(LOCAL_SHOP_ID, 'sess-1' as SessionId)).toEqual(built.session);
      expect(await store.getSession(LOCAL_SHOP_ID, 'khong-co' as SessionId)).toBeNull();
      // lưu lại đúng phiên đó (cùng ID, cùng kiện) cũng bị từ chối: kiện đã có phiên đang thực hiện
      await expect(store.saveSession(built.session)).rejects.toMatchObject({
        code: 'PACKAGE_SESSION_ACTIVE',
      });
      // phiên trỏ tới đơn/kiện không có thật: lỗi, không ghi bản ghi mồ côi
      await expect(
        store.saveSession({
          ...built.session,
          id: 'sess-2' as SessionId,
          orderId: 'khong-co' as OrderId,
        }),
      ).rejects.toMatchObject({ code: 'LOCAL_SAVE_UNAVAILABLE' });
      await expect(
        store.saveSession({
          ...built.session,
          id: 'sess-3' as SessionId,
          packageId: 'khong-co' as PackageId,
        }),
      ).rejects.toMatchObject({ code: 'LOCAL_SAVE_UNAVAILABLE' });
    });
  });
}
