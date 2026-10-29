import { act, render } from '@testing-library/react-native';

import type { RemoteDocuments } from '@/api/contract';
import type { ReturnCaseId, ShopId } from '@/core/ids';
import { CurrentShopProvider, LOCAL_SHOP_ID } from '@/features/orders';

import { createMemoryReturnStore } from './memory-return-store';
import { ReturnStoreProvider } from './ReturnStoreProvider';
import { ReturnSyncRunner } from './ReturnSyncRunner';
import { makeNewReturn } from './return-store.contract';

const REAL_SHOP = 'shop-that' as ShopId;

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
    getFields: async () => null,
    getManyFields: async () => new Map(),
    callFunction: async () => {
      throw new Error('unused');
    },
  };
  return { docs, created };
}

async function storeWithPhoto(shopId: ShopId) {
  const store = createMemoryReturnStore({ creatorUid: () => 'uid' });
  const made = await store.createReturn(makeNewReturn({ shopId }));
  const id = `m-${made.returnCase.id}`;
  await store.createMedia({ id, shopId, returnId: made.returnCase.id, kind: 'photo', atDevice: 2 });
  await store.applyMediaEvent(shopId, id, { type: 'STOP_RECORDING', origin: 'device' }, 3, {
    localPath: 'tmp/x.jpg',
  });
  await store.applyMediaEvent(shopId, id, { type: 'LOCAL_FILE_READABLE', origin: 'device' }, 4, {
    localPath: `evidence/${id}.jpg`,
    sizeBytes: 10,
    sha256Client: 'c'.repeat(64),
  });
  return { store, returnId: made.returnCase.id };
}

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

const mount = async (
  store: ReturnType<typeof createMemoryReturnStore>,
  docs: RemoteDocuments | null,
  shopId: string | null,
) =>
  await render(
    <CurrentShopProvider shopId={shopId}>
      <ReturnStoreProvider store={store}>
        <ReturnSyncRunner docs={docs} />
      </ReturnStoreProvider>
    </CurrentShopProvider>,
  );

describe('ReturnSyncRunner', () => {
  it('có cổng và shop thật: đăng bản neo hồ sơ có media ngay khi gắn', async () => {
    const { store, returnId } = await storeWithPhoto(REAL_SHOP);
    const t = fakeDocs();
    await mount(store, t.docs, REAL_SHOP);
    await flush();
    expect(t.created).toEqual([`shops/${REAL_SHOP}/returns/${returnId}`]);
    expect(await store.listReturnsPendingRemote(REAL_SHOP, 5, 'uid')).toEqual([]);
  });

  it('không có cổng (cổng giả/test/thiếu cấu hình): không làm gì', async () => {
    const { store } = await storeWithPhoto(REAL_SHOP);
    await mount(store, null, REAL_SHOP);
    await flush();
    expect(await store.listReturnsPendingRemote(REAL_SHOP, 5, 'uid')).toHaveLength(1);
  });

  it('shop cục bộ tạm hoặc chưa biết shop: không bao giờ đăng', async () => {
    const { store } = await storeWithPhoto(LOCAL_SHOP_ID as ShopId);
    const t = fakeDocs();
    await mount(store, t.docs, null);
    await mount(store, t.docs, LOCAL_SHOP_ID);
    await flush();
    expect(t.created).toEqual([]);
  });

  it('chạy lại khi app trở lại foreground và hủy đăng ký khi gỡ', async () => {
    const { store } = await storeWithPhoto(REAL_SHOP);
    const t = fakeDocs();
    const view = await mount(store, t.docs, REAL_SHOP);
    await flush();
    expect(activeListener).not.toBeNull();
    const second = await storeWithPhotoOn(store, REAL_SHOP);
    await act(async () => activeListener?.());
    await flush();
    expect(t.created).toContain(`shops/${REAL_SHOP}/returns/${second}`);
    await view.unmount();
    expect(activeListener).toBeNull();
  });
});

/** Thêm một hồ sơ nữa (có ảnh đã lưu) vào CÙNG kho. */
async function storeWithPhotoOn(
  store: ReturnType<typeof createMemoryReturnStore>,
  shopId: ShopId,
): Promise<ReturnCaseId> {
  const made = await store.createReturn(makeNewReturn({ shopId }));
  const id = `m2-${made.returnCase.id}`;
  await store.createMedia({ id, shopId, returnId: made.returnCase.id, kind: 'photo', atDevice: 2 });
  await store.applyMediaEvent(shopId, id, { type: 'STOP_RECORDING', origin: 'device' }, 3, {
    localPath: 'tmp/y.jpg',
  });
  await store.applyMediaEvent(shopId, id, { type: 'LOCAL_FILE_READABLE', origin: 'device' }, 4, {
    localPath: `evidence/${id}.jpg`,
    sizeBytes: 10,
    sha256Client: 'd'.repeat(64),
  });
  return made.returnCase.id;
}
