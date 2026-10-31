import type { SessionId } from '@/core/ids';
import { createMemoryOrderStore } from './memory-order-store';
import { makeOrder, testIds } from './order-store.contract';

import { createOrderSync, type RemoteOrderWriter } from '../domain/order-sync';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { buildNextPackage } from '../domain/build-order';
import { buildPackingSession } from '../domain/start-session';

async function setup(options: { online?: boolean; uid?: string | null } = {}) {
  let uid: string | null = options.uid === undefined ? 'u1' : options.uid;
  const store = createMemoryOrderStore({ creatorUid: () => uid });
  const calls: string[] = [];
  const fail = { order: false, session: false };
  const hooks: { duringPublishOrder: (() => Promise<void>) | null } = { duringPublishOrder: null };
  let online = options.online ?? true;
  const remote: RemoteOrderWriter = {
    publishOrder: async (d) => {
      calls.push(`order:${d.order.orderCode}`);
      await hooks.duringPublishOrder?.();
      if (fail.order) throw Object.assign(new Error('x'), { code: 'deadline-exceeded' });
    },
    publishPackage: async (_order, pkg) => {
      calls.push(`package:${pkg.index}`);
    },
    publishSession: async (s, status) => {
      calls.push(`session:${s.id}:${status}`);
      if (fail.session) throw new Error('denied');
    },
  };
  const sync = createOrderSync({
    store,
    remote,
    now: () => 7000,
    isOnline: () => online,
    currentUid: () => uid,
  });
  const addOrder = async (code: string, at: number, withSession = true) => {
    const details = makeOrder(code, { lines: [{ name: 'Áo' }], at });
    await store.saveNewOrder(details);
    const pkg = details.packages[0];
    if (!pkg || !withSession) return { details, sessionId: null };
    const built = buildPackingSession(details, pkg.id, {
      sessionId: `s-${code}` as SessionId,
      nowDevice: at + 1,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    return { details, sessionId: built.session.id };
  };
  return {
    store,
    sync,
    calls,
    fail,
    hooks,
    addOrder,
    setOnline: (v: boolean) => void (online = v),
    setUid: (v: string | null) => void (uid = v),
  };
}

describe('đồng bộ đơn một chiều', () => {
  it('đơn chưa có phiên không được đăng (còn sửa được)', async () => {
    const t = await setup();
    await t.addOrder('NOSESS', 1000, false);
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 0 });
    expect(t.calls).toEqual([]);
  });

  it('đăng đơn đã có phiên rồi đánh dấu; lượt sau không đăng lại', async () => {
    const t = await setup();
    await t.addOrder('A', 1000);
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 1, failed: 0 });
    expect(t.calls).toEqual(['order:A']);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls).toEqual(['order:A']);
  });

  it('phiên created không đăng; phiên recording đăng sau đơn (kiện đầu đã đăng cùng đơn nên không đăng lại)', async () => {
    const t = await setup();
    const a = await t.addOrder('B', 1000);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.filter((c) => c.startsWith('session'))).toEqual([]);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'recording');
    const summary = await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(summary.sessionsPublished).toBe(1);
    expect(t.calls.slice(-2)).toEqual(['order:B', 'session:s-B:recording']);
    expect(t.calls.some((c) => c.startsWith('package:'))).toBe(false);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'ended');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls[t.calls.length - 1]).toBe('session:s-B:ended');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.filter((c) => c.startsWith('session'))).toHaveLength(2);
  });

  it('đổi trạng thái phiên nhiều lần: kiện chỉ được đảm bảo MỘT lần, các lần sau không đọc lại cây đơn', async () => {
    const t = await setup();
    const a = await t.addOrder('PK', 1000);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'recording');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'ended');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'confirmed');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    // Kiện đầu đã đăng cùng đơn nên không cần đăng kiện lần nào; chỉ có 3 lần đăng phiên.
    expect(t.calls).toEqual([
      'order:PK',
      'session:s-PK:recording',
      'session:s-PK:ended',
      'session:s-PK:confirmed',
    ]);
  });

  it('kiện thêm sau khi đơn đã đăng: được đăng một lần trước phiên của nó, lượt sau không lặp', async () => {
    const t = await setup();
    const a = await t.addOrder('PK2', 1000);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    const next = buildNextPackage(a.details, { ids: testIds, nowDevice: 2000 });
    await t.store.addPackage(LOCAL_SHOP_ID, next);
    const built = buildPackingSession(
      { ...a.details, packages: [...a.details.packages, next] },
      next.id,
      { sessionId: 's-PK2b' as SessionId, nowDevice: 3000 },
    );
    if (!built.ok) throw new Error('fixture');
    await t.store.saveSession(built.session);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, built.session.id, 'recording');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, built.session.id, 'ended');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.filter((c) => c.startsWith('package:'))).toEqual(['package:2']);
  });

  it('kiện + phiên thêm GIỮA LÚC đăng đơn không bị đánh dấu nhầm: lượt sau vẫn đăng kiện rồi phiên', async () => {
    const t = await setup();
    const a = await t.addOrder('RACE', 1000);
    let s2: SessionId | null = null;
    t.hooks.duringPublishOrder = async () => {
      t.hooks.duringPublishOrder = null;
      const next = buildNextPackage(a.details, { ids: testIds, nowDevice: 2000 });
      await t.store.addPackage(LOCAL_SHOP_ID, next);
      const built = buildPackingSession(
        { ...a.details, packages: [...a.details.packages, next] },
        next.id,
        { sessionId: 's-RACE-2' as SessionId, nowDevice: 3000 },
      );
      if (!built.ok) throw new Error('fixture');
      await t.store.saveSession(built.session);
      await t.store.updateSessionStatus(LOCAL_SHOP_ID, built.session.id, 'recording');
      s2 = built.session.id;
    };
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(s2).toBe('s-RACE-2');
    // Cùng lượt: kiện K2 vẫn được đăng (không bị đánh dấu nhầm) rồi mới tới phiên của nó.
    expect(t.calls).toEqual(['order:RACE', 'package:2', 'session:s-RACE-2:recording']);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.filter((c) => c.startsWith('package:'))).toEqual(['package:2']);
  });

  it('trạng thái lạ không được đăng', async () => {
    const t = await setup();
    await t.addOrder('C', 1000);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    // Kho không cho đặt trạng thái lạ qua updateSessionStatus; trạng thái lạ chỉ có thể đến từ bản ghi
    // do bản app khác lưu. Dựng bằng cách lưu thẳng một phiên có trạng thái lạ.
    const odd = await t.addOrder('C2', 1100, false);
    const pkg = odd.details.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(odd.details, pkg.id, {
      sessionId: 's-C2' as SessionId,
      nowDevice: 1200,
    });
    if (!built.ok) throw new Error('fixture');
    await t.store.saveSession({ ...built.session, sessionStatus: 'xyz' as never });
    await t.sync.runOnce(LOCAL_SHOP_ID); // đăng đơn C2
    expect((await t.sync.runOnce(LOCAL_SHOP_ID)).sessionsPublished).toBe(0);
  });

  it('lỗi máy chủ: không đánh dấu, tính failed, lượt sau thử lại thành công', async () => {
    const t = await setup();
    await t.addOrder('D', 1000);
    t.fail.order = true;
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 0, failed: 1 });
    t.fail.order = false;
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 1, failed: 0 });
  });

  it('lệnh ghi hết giờ (deadline-exceeded, còn chờ trong SDK): không đánh dấu đơn/phiên đã đăng', async () => {
    const t = await setup();
    const { sessionId } = await t.addOrder('TO', 1000);
    if (!sessionId) throw new Error('fixture');
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, sessionId, 'recording');
    t.fail.order = true; // cổng thật ném { code: 'deadline-exceeded' } sau 30 giây
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 0, failed: 1 });
    expect(await t.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 5, 'u1')).toHaveLength(1);
    expect(await t.store.isSessionPublished(LOCAL_SHOP_ID, sessionId)).toBe(false);
    t.fail.order = false;
    t.fail.session = true;
    await t.sync.runOnce(LOCAL_SHOP_ID);
    // Đơn đã được máy chủ xác nhận, phiên thì chưa: tệp của phiên chưa được khai báo.
    expect(await t.store.isSessionPublished(LOCAL_SHOP_ID, sessionId)).toBe(false);
    t.fail.session = false;
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(await t.store.isSessionPublished(LOCAL_SHOP_ID, sessionId)).toBe(true);
  });

  it('một đơn lỗi không chặn đơn khác', async () => {
    const t = await setup();
    await t.addOrder('E1', 1000);
    await t.addOrder('E2', 2000);
    t.fail.order = true;
    const original = t.calls.length;
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.length - original).toBe(2); // thử cả hai
  });

  it('chưa đăng nhập: không đăng gì và không đánh dấu', async () => {
    const t = await setup({ uid: 'u1' });
    await t.addOrder('G', 1000);
    t.setUid(null);
    expect((await t.sync.runOnce(LOCAL_SHOP_ID)).skipped).toBe('signed_out');
    expect(t.calls).toEqual([]);
    t.setUid('u1');
    expect((await t.sync.runOnce(LOCAL_SHOP_ID)).ordersPublished).toBe(1);
  });

  it('máy dùng chung: đơn của người khác ở lại máy, chỉ đăng khi chính họ đăng nhập (không ghi nhầm người tạo)', async () => {
    const t = await setup({ uid: 'u1' });
    await t.addOrder('H1', 1000); // của u1
    t.setUid('u2');
    await t.addOrder('H2', 2000); // của u2
    // u2 đang đăng nhập: chỉ đăng đơn của u2.
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 1, failed: 0 });
    expect(t.calls).toEqual(['order:H2']);
    // u1 đăng nhập lại: đăng nốt đơn của u1.
    t.setUid('u1');
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 1, failed: 0 });
    expect(t.calls).toEqual(['order:H2', 'order:H1']);
  });

  it('bản ghi cũ chưa có người tạo (tạo trước khi có cột / lúc chưa biết uid) không bao giờ được đăng', async () => {
    const t = await setup({ uid: null });
    await t.addOrder('OLD', 1000);
    t.setUid('u1');
    expect(await t.sync.runOnce(LOCAL_SHOP_ID)).toMatchObject({ ordersPublished: 0, failed: 0 });
    expect(t.calls).toEqual([]);
  });

  it('đăng xuất giữa lượt: dừng ngay, các đơn còn lại không bị ghi bằng danh tính cũ và vẫn còn chờ đăng', async () => {
    const t = await setup();
    await t.addOrder('S1', 1000);
    await t.addOrder('S2', 2000);
    let first = true;
    t.hooks.duringPublishOrder = async () => {
      if (!first) return;
      first = false;
      t.setUid(null); // đăng xuất khi đơn đầu đang gửi
    };
    const summary = await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls).toHaveLength(1);
    expect(summary.ordersPublished).toBe(1);
    // Đơn còn lại vẫn chờ đăng: chính chủ đăng nhập lại thì được đăng.
    expect(await t.store.listOrdersPendingRemote(LOCAL_SHOP_ID, 5, 'u1')).toHaveLength(1);
    t.setUid('u1');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls).toHaveLength(2);
  });

  it('ngoại tuyến thì bỏ qua; lượt chồng nhau thì busy', async () => {
    const t = await setup({ online: false });
    await t.addOrder('F', 1000);
    expect((await t.sync.runOnce(LOCAL_SHOP_ID)).skipped).toBe('offline');
    t.setOnline(true);
    const [a, b] = await Promise.all([
      t.sync.runOnce(LOCAL_SHOP_ID),
      t.sync.runOnce(LOCAL_SHOP_ID),
    ]);
    expect([a.skipped, b.skipped].filter((s) => s === 'busy')).toHaveLength(1);
    expect(t.calls).toEqual(['order:F']);
  });
});
