import type { SessionId } from '@/core/ids';
import { createMemoryOrderStore } from './memory-order-store';
import { makeOrder } from './order-store.contract';

import { createOrderSync, type RemoteOrderWriter } from '../domain/order-sync';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { buildPackingSession } from '../domain/start-session';

async function setup(options: { online?: boolean } = {}) {
  const store = createMemoryOrderStore();
  const calls: string[] = [];
  const fail = { order: false, session: false };
  let online = options.online ?? true;
  const remote: RemoteOrderWriter = {
    publishOrder: async (d) => {
      calls.push(`order:${d.order.orderCode}`);
      if (fail.order) throw new Error('denied');
    },
    publishSession: async (s, status) => {
      calls.push(`session:${s.id}:${status}`);
      if (fail.session) throw new Error('denied');
    },
  };
  const sync = createOrderSync({ store, remote, now: () => 7000, isOnline: () => online });
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
  return { store, sync, calls, fail, addOrder, setOnline: (v: boolean) => void (online = v) };
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

  it('phiên created không đăng; phiên recording đăng sau đơn, kèm đảm bảo kiện', async () => {
    const t = await setup();
    const a = await t.addOrder('B', 1000);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.filter((c) => c.startsWith('session'))).toEqual([]);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'recording');
    const summary = await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(summary.sessionsPublished).toBe(1);
    expect(t.calls.slice(-2)).toEqual(['order:B', 'session:s-B:recording']);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'ended');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls[t.calls.length - 1]).toBe('session:s-B:ended');
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.filter((c) => c.startsWith('session'))).toHaveLength(2);
  });

  it('trạng thái lạ không được đăng', async () => {
    const t = await setup();
    const a = await t.addOrder('C', 1000);
    await t.sync.runOnce(LOCAL_SHOP_ID);
    await t.store.updateSessionStatus(LOCAL_SHOP_ID, a.sessionId as SessionId, 'xyz');
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

  it('một đơn lỗi không chặn đơn khác', async () => {
    const t = await setup();
    await t.addOrder('E1', 1000);
    await t.addOrder('E2', 2000);
    t.fail.order = true;
    const original = t.calls.length;
    await t.sync.runOnce(LOCAL_SHOP_ID);
    expect(t.calls.length - original).toBe(2); // thử cả hai
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
