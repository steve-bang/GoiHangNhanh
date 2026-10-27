import { AppError } from '@/core/errors/app-error';
import type { OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import type { OrderSource } from '@/core/orders/order-source';

import { buildNextPackage, buildOrder, type IdFactory } from '../domain/build-order';
import { toCodeKey } from '../domain/codes';
import type { OrderStore } from '../domain/order-store';
import type { OrderListCursor, OrderListItem } from '../domain/order-list';
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
    source?: OrderSource;
    shopId?: ShopId;
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
    { shopId: options.shopId ?? LOCAL_SHOP_ID, ids: testIds, nowDevice: options.at ?? 1000 },
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
  at = 5000,
): Promise<PackingSession> {
  if (seedOrder) await store.saveNewOrder(details);
  const target = packageId ?? details.packages[0]?.id;
  if (!target) throw new Error('fixture');
  const built = buildPackingSession(details, target, {
    sessionId: sessionId as SessionId,
    nowDevice: at,
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

    describe('danh sách đơn (listOrders, countOrders)', () => {
      const ALL = {};
      const page = (limit = 20, after?: OrderListCursor) => ({
        limit,
        ...(after ? { after } : {}),
      });
      const codes = (items: readonly OrderListItem[]) => items.map((i) => i.order.orderCode);

      it('shop không có đơn: danh sách rỗng, không con trỏ, đếm 0', async () => {
        const store = await create();
        expect(await store.listOrders(LOCAL_SHOP_ID, ALL, page())).toEqual({
          items: [],
          nextCursor: null,
        });
        expect(await store.countOrders(LOCAL_SHOP_ID, ALL)).toBe(0);
      });

      it('sắp theo hoạt động gần nhất rồi id giảm dần (ổn định khi trùng thời điểm)', async () => {
        const store = await create();
        const same1 = makeOrder('S1', { at: 500 });
        const same2 = makeOrder('S2', { at: 500 });
        await store.saveNewOrder(makeOrder('OLD', { at: 100 }));
        await store.saveNewOrder(same1);
        await store.saveNewOrder(makeOrder('NEW', { at: 900 }));
        await store.saveNewOrder(same2);
        const items = (await store.listOrders(LOCAL_SHOP_ID, ALL, page())).items;
        const tie = [same1, same2].sort((a, b) => (a.order.id < b.order.id ? 1 : -1));
        expect(codes(items)).toEqual(['NEW', ...tie.map((d) => d.order.orderCode), 'OLD']);
        // gọi lại cho cùng kết quả
        expect((await store.listOrders(LOCAL_SHOP_ID, ALL, page())).items).toEqual(items);
      });

      it('mốc hoạt động = max(tạo đơn, phiên mới nhất): đơn cũ vừa bắt đầu phiên nhảy lên đầu', async () => {
        const store = await create();
        const old = makeOrder('OLD', { at: 100 });
        await store.saveNewOrder(old);
        await store.saveNewOrder(makeOrder('MID', { at: 500 }));
        await startSession(store, old, 'sess-act', undefined, false, 800);
        const { items } = await store.listOrders(LOCAL_SHOP_ID, ALL, page());
        expect(codes(items)).toEqual(['OLD', 'MID']);
        expect(items[0]?.lastActivityDevice).toBe(800);
        expect(items[0]?.activeSession).toMatchObject({ id: 'sess-act' });
        expect(items[1]?.activeSession).toBeNull();
      });

      it('thẻ có dòng đầu tiên (tên, variant tách riêng), số dòng; đơn không dòng thì null', async () => {
        const store = await create();
        await store.saveNewOrder(
          makeOrder('L', {
            at: 10,
            lines: [
              { name: 'Áo', variant: 'Đen / XL', quantity: 2 },
              { name: 'Áo', variant: 'Trắng / L' },
            ],
          }),
        );
        await store.saveNewOrder(makeOrder('NL', { at: 5 }));
        const { items } = await store.listOrders(LOCAL_SHOP_ID, ALL, page());
        expect(items[0]?.firstLine).toEqual({ name: 'Áo', variant: 'Đen / XL', quantity: 2 });
        expect(items[0]?.lineCount).toBe(2);
        expect(items[1]?.firstLine).toBeNull();
        expect(items[1]?.lineCount).toBe(0);
      });

      it('phân trang keyset: các trang nối nhau đủ, không trùng, không sót', async () => {
        const store = await create();
        for (let i = 1; i <= 7; i += 1)
          await store.saveNewOrder(makeOrder(`P${i}`, { at: i * 10 }));
        const first = await store.listOrders(LOCAL_SHOP_ID, ALL, page(3));
        expect(codes(first.items)).toEqual(['P7', 'P6', 'P5']);
        expect(first.nextCursor).not.toBeNull();
        const second = await store.listOrders(
          LOCAL_SHOP_ID,
          ALL,
          page(3, first.nextCursor ?? undefined),
        );
        expect(codes(second.items)).toEqual(['P4', 'P3', 'P2']);
        const third = await store.listOrders(
          LOCAL_SHOP_ID,
          ALL,
          page(3, second.nextCursor ?? undefined),
        );
        expect(codes(third.items)).toEqual(['P1']);
        expect(third.nextCursor).toBeNull();
      });

      it('trang cuối đúng bằng giới hạn thì không còn con trỏ', async () => {
        const store = await create();
        for (let i = 1; i <= 4; i += 1) await store.saveNewOrder(makeOrder(`E${i}`, { at: i }));
        const first = await store.listOrders(LOCAL_SHOP_ID, ALL, page(2));
        const second = await store.listOrders(
          LOCAL_SHOP_ID,
          ALL,
          page(2, first.nextCursor ?? undefined),
        );
        expect(codes(second.items)).toEqual(['E2', 'E1']);
        expect(second.nextCursor).toBeNull();
      });

      it('đơn MỚI chèn vào giữa chừng không làm trùng thẻ ở trang sau (không dùng offset)', async () => {
        const store = await create();
        for (let i = 1; i <= 6; i += 1)
          await store.saveNewOrder(makeOrder(`M${i}`, { at: i * 10 }));
        const first = await store.listOrders(LOCAL_SHOP_ID, ALL, page(3));
        expect(codes(first.items)).toEqual(['M6', 'M5', 'M4']);
        // đơn mới (mới nhất) và đơn cũ hơn trang đầu xuất hiện sau khi đã tải trang đầu
        await store.saveNewOrder(makeOrder('NEW-TOP', { at: 1000 }));
        await store.saveNewOrder(makeOrder('NEW-MID', { at: 45 }));
        const second = await store.listOrders(
          LOCAL_SHOP_ID,
          ALL,
          page(10, first.nextCursor ?? undefined),
        );
        const seen = [...codes(first.items), ...codes(second.items)];
        expect(new Set(seen).size).toBe(seen.length);
        expect(codes(second.items)).toEqual(['M3', 'M2', 'M1']);
        // thẻ nằm dưới con trỏ (NEW-MID, 45 > 40) cũng không bị kéo vào giữa; tải lại từ đầu thấy đủ
        expect(codes((await store.listOrders(LOCAL_SHOP_ID, ALL, page())).items)).toEqual([
          'NEW-TOP',
          'M6',
          'M5',
          'NEW-MID',
          'M4',
          'M3',
          'M2',
          'M1',
        ]);
      });

      it('tìm theo mã đơn và theo mã vận đơn, chuẩn hóa hoa/thường và khoảng trắng', async () => {
        const store = await create();
        await store.saveNewOrder(makeOrder('dh-100', { tracking: 'spx 999', at: 1 }));
        await store.saveNewOrder(makeOrder('DH-200', { at: 2 }));
        await store.saveNewOrder(makeOrder('XX-1', { tracking: 'GHN-100', at: 3 }));
        const find = async (search: string) =>
          codes(
            (await store.listOrders(LOCAL_SHOP_ID, { searchKey: toCodeKey(search) }, page())).items,
          );
        expect(await find('  DH-100 ')).toEqual(['dh-100']);
        expect(await find('dh-2')).toEqual(['DH-200']);
        expect(await find('spx   999')).toEqual(['dh-100']); // mã vận đơn, gộp khoảng trắng
        expect(await find('ghn')).toEqual(['XX-1']);
        expect(await find('100')).toEqual(['XX-1', 'dh-100']); // khớp cả mã đơn lẫn mã vận đơn
        expect(await find('khong-co')).toEqual([]);
        expect(await store.countOrders(LOCAL_SHOP_ID, { searchKey: '100' })).toBe(2);
      });

      it('ký tự % và _ trong từ khóa là chữ thường, không phải ký tự đại diện', async () => {
        const store = await create();
        await store.saveNewOrder(makeOrder('AB_1', { at: 1 }));
        await store.saveNewOrder(makeOrder('ABX1', { at: 2 }));
        expect(
          codes((await store.listOrders(LOCAL_SHOP_ID, { searchKey: 'B_1' }, page())).items),
        ).toEqual(['AB_1']);
        expect((await store.listOrders(LOCAL_SHOP_ID, { searchKey: '%' }, page())).items).toEqual(
          [],
        );
      });

      it('lọc theo nguồn bán', async () => {
        const store = await create();
        await store.saveNewOrder(makeOrder('A', { source: 'shopee', at: 1 }));
        await store.saveNewOrder(makeOrder('B', { source: 'tiktok_shop', at: 2 }));
        await store.saveNewOrder(makeOrder('C', { source: 'shopee', at: 3 }));
        expect(
          codes((await store.listOrders(LOCAL_SHOP_ID, { source: 'shopee' }, page())).items),
        ).toEqual(['C', 'A']);
        expect(await store.countOrders(LOCAL_SHOP_ID, { source: 'lazada' })).toBe(0);
      });

      it('lọc theo thời điểm TẠO đơn (biên gồm mốc bắt đầu), không theo mốc phiên', async () => {
        const store = await create();
        const old = makeOrder('OLD', { at: 100 });
        await store.saveNewOrder(old);
        await store.saveNewOrder(makeOrder('EDGE', { at: 500 }));
        await store.saveNewOrder(makeOrder('NEW', { at: 900 }));
        await startSession(store, old, 'sess-old', undefined, false, 950);
        const q = { createdSinceDevice: 500 };
        expect(codes((await store.listOrders(LOCAL_SHOP_ID, q, page())).items)).toEqual([
          'NEW',
          'EDGE',
        ]);
        expect(await store.countOrders(LOCAL_SHOP_ID, q)).toBe(2);
      });

      it('lọc khai báo: declared khi có ít nhất một dòng, undeclared chỉ khi chưa có dòng nào', async () => {
        const store = await create();
        await store.saveNewOrder(makeOrder('HAS', { at: 1, lines: [{ name: 'Áo' }] }));
        await store.saveNewOrder(makeOrder('NONE', { at: 2 }));
        expect(
          codes((await store.listOrders(LOCAL_SHOP_ID, { declaration: 'declared' }, page())).items),
        ).toEqual(['HAS']);
        expect(
          codes(
            (await store.listOrders(LOCAL_SHOP_ID, { declaration: 'undeclared' }, page())).items,
          ),
        ).toEqual(['NONE']);
        expect(await store.countOrders(LOCAL_SHOP_ID, { declaration: 'declared' })).toBe(1);
      });

      it('chưa có bằng chứng thật: phiên created KHÔNG làm đơn thành "có video" (withoutVideo vẫn thấy đủ)', async () => {
        const store = await create();
        const d = makeOrder('WV', { at: 1 });
        await store.saveNewOrder(d);
        await startSession(store, d, 'sess-wv');
        await store.saveNewOrder(makeOrder('WV2', { at: 2 }));
        expect(await store.countOrders(LOCAL_SHOP_ID, { withoutVideo: true })).toBe(2);
        expect(
          (await store.listOrders(LOCAL_SHOP_ID, { withoutVideo: true }, page())).items,
        ).toHaveLength(2);
      });

      it('kết hợp nhiều bộ lọc: giao của các điều kiện; đếm khớp danh sách', async () => {
        const store = await create();
        await store.saveNewOrder(
          makeOrder('K1', { source: 'shopee', at: 600, lines: [{ name: 'Áo' }] }),
        );
        await store.saveNewOrder(makeOrder('K2', { source: 'shopee', at: 700 }));
        await store.saveNewOrder(
          makeOrder('K3', { source: 'tiktok_shop', at: 800, lines: [{ name: 'Áo' }] }),
        );
        await store.saveNewOrder(
          makeOrder('K4', { source: 'shopee', at: 100, lines: [{ name: 'Áo' }] }),
        );
        const q = {
          searchKey: 'K',
          source: 'shopee' as const,
          declaration: 'declared' as const,
          createdSinceDevice: 500,
        };
        expect(codes((await store.listOrders(LOCAL_SHOP_ID, q, page())).items)).toEqual(['K1']);
        expect(await store.countOrders(LOCAL_SHOP_ID, q)).toBe(1);
      });

      it('cô lập shop: shop khác không thấy đơn, đếm, tìm hay phiên của nhau, dù trùng mã', async () => {
        const store = await create();
        const other = 'shop-khac' as ShopId;
        const mine = makeOrder('SAME', { at: 10 });
        const theirs = makeOrder('SAME', {
          at: 20,
          shopId: other,
          tracking: 'TRK-OTHER',
          lines: [{ name: 'Của họ' }],
        });
        await store.saveNewOrder(mine);
        await store.saveNewOrder(theirs);
        await startSession(store, theirs, 'sess-theirs');
        const mineList = await store.listOrders(LOCAL_SHOP_ID, ALL, page());
        expect(mineList.items.map((i) => i.order.id)).toEqual([mine.order.id]);
        expect(mineList.items[0]?.activeSession).toBeNull();
        expect(await store.countOrders(LOCAL_SHOP_ID, ALL)).toBe(1);
        expect(await store.countOrders(LOCAL_SHOP_ID, { searchKey: 'TRK-OTHER' })).toBe(0);
        const theirList = await store.listOrders(other, ALL, page());
        expect(theirList.items.map((i) => i.order.id)).toEqual([theirs.order.id]);
        expect(theirList.items[0]?.activeSession).toMatchObject({ id: 'sess-theirs' });
        expect(await store.listOrders('shop-ba' as ShopId, ALL, page())).toEqual({
          items: [],
          nextCursor: null,
        });
      });

      it('con trỏ của shop khác không làm lộ đơn: kết quả vẫn chỉ gồm đơn của shop gọi', async () => {
        const store = await create();
        const other = 'shop-khac' as ShopId;
        await store.saveNewOrder(makeOrder('A', { at: 10 }));
        await store.saveNewOrder(makeOrder('B', { at: 20, shopId: other }));
        const theirPage = await store.listOrders(other, ALL, page(1));
        const cursor: OrderListCursor = { lastActivityDevice: 999, orderId: 'zzz' as OrderId };
        const mine = await store.listOrders(LOCAL_SHOP_ID, ALL, page(5, cursor));
        expect(codes(mine.items)).toEqual(['A']);
        expect(theirPage.items).toHaveLength(1);
      });
    });
  });
}
