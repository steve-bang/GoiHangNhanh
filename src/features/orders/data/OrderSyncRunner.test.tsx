import { act, render } from '@testing-library/react-native';

import type { RemoteDocuments } from '@/api/contract';
import type { SessionId } from '@/core/ids';

import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { buildPackingSession } from '../domain/start-session';
import { CurrentShopProvider } from './current-shop';
import { createMemoryOrderStore } from './memory-order-store';
import { OrderStoreProvider } from './OrderStoreProvider';
import { OrderSyncRunner } from './OrderSyncRunner';
import { makeOrder } from './order-store.contract';

const REAL_SHOP = 'shop-that';

let activeListener: (() => void) | null = null;
jest.mock('@/platform/app-state', () => ({
  subscribeAppActive: (cb: () => void) => {
    activeListener = cb;
    return () => {
      activeListener = null;
    };
  },
}));

function fakeDocs() {
  const created: string[] = [];
  const docs: RemoteDocuments = {
    values: { serverTimestamp: () => 'TS', timestamp: (ms) => ms },
    currentUid: () => 'uid',
    createMissing: async (writes) => void created.push(...writes.map((w) => w.path)),
    updateFields: async () => undefined,
  };
  return { docs, created };
}

async function storeWithSession(shopId: string) {
  const store = createMemoryOrderStore();
  const details = makeOrder('R-1', { shopId: shopId as never, lines: [{ name: 'Áo' }] });
  await store.saveNewOrder(details);
  const pkg = details.packages[0];
  if (!pkg) throw new Error('fixture');
  const built = buildPackingSession(details, pkg.id, {
    sessionId: 's-1' as SessionId,
    nowDevice: 10,
  });
  if (!built.ok) throw new Error('fixture');
  await store.saveSession(built.session);
  return { store, orderId: details.order.id };
}

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

const mount = async (
  store: ReturnType<typeof createMemoryOrderStore>,
  docs: RemoteDocuments | null,
  shopId: string | null,
) =>
  await render(
    <CurrentShopProvider shopId={shopId}>
      <OrderStoreProvider store={store}>
        <OrderSyncRunner docs={docs} />
      </OrderStoreProvider>
    </CurrentShopProvider>,
  );

describe('OrderSyncRunner', () => {
  it('có cổng và shop thật: đăng đơn đã có phiên ngay khi gắn', async () => {
    const { store } = await storeWithSession(REAL_SHOP);
    const t = fakeDocs();
    await mount(store, t.docs, REAL_SHOP);
    await flush();
    expect(t.created.some((p) => p.startsWith(`shops/${REAL_SHOP}/orders/`))).toBe(true);
    expect(await store.listOrdersPendingRemote(REAL_SHOP as never, 5)).toEqual([]);
  });

  it('không có cổng (cổng giả/test/thiếu cấu hình): không làm gì', async () => {
    const { store } = await storeWithSession(REAL_SHOP);
    await mount(store, null, REAL_SHOP);
    await flush();
    expect(await store.listOrdersPendingRemote(REAL_SHOP as never, 5)).toHaveLength(1);
  });

  it('shop cục bộ tạm hoặc chưa biết shop: không bao giờ đăng', async () => {
    const { store } = await storeWithSession(LOCAL_SHOP_ID);
    const t = fakeDocs();
    await mount(store, t.docs, null);
    await mount(store, t.docs, LOCAL_SHOP_ID);
    await flush();
    expect(t.created).toEqual([]);
  });

  it('chạy lại khi app trở lại foreground và hủy đăng ký khi gỡ', async () => {
    const { store } = await storeWithSession(REAL_SHOP);
    const t = fakeDocs();
    const view = await mount(store, t.docs, REAL_SHOP);
    await flush();
    expect(activeListener).not.toBeNull();
    const details = makeOrder('R-2', { shopId: REAL_SHOP as never, lines: [{ name: 'Quần' }] });
    await store.saveNewOrder(details);
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(details, pkg.id, {
      sessionId: 's-2' as SessionId,
      nowDevice: 20,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    await act(async () => activeListener?.());
    await flush();
    expect(t.created.some((p) => p.includes(details.order.id))).toBe(true);
    await view.unmount();
    expect(activeListener).toBeNull();
  });
});
