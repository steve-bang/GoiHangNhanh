import { act, render } from '@testing-library/react-native';

import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, OrderId, PackageId, SessionId } from '@/core/ids';
import {
  CurrentShopProvider,
  EvidenceFileStoreProvider,
  LOCAL_SHOP_ID,
  createMemoryEvidenceFileStore,
} from '@/features/orders';

import { ReturnStoreProvider, createMemoryReturnStore, type ReturnStore } from '@/features/returns';

import type { UploadGateway } from '../domain/ports';
import { UploadRunner } from './UploadRunner';

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

let mockOffline = false;
jest.mock('@/platform/connectivity', () => ({ useIsOffline: () => mockOffline }));

beforeEach(() => {
  mockOffline = false;
});

async function storeWithQueuedFile(shopId: string) {
  const files = createMemoryEvidenceFileStore();
  const id = 'ev-1' as EvidenceId;
  await files.create({
    id,
    shopId: shopId as never,
    orderId: 'o' as OrderId,
    packageId: 'p' as PackageId,
    sessionId: 's' as SessionId,
    group: 'pack',
    kind: 'video',
    createdAtDevice: 1,
  });
  const d = (type: string) => ({ type, origin: 'device' }) as never;
  await files.applyEvent(shopId as never, id, d('STOP_RECORDING'), 2);
  await files.applyEvent(shopId as never, id, d('LOCAL_FILE_READABLE'), 3, {
    localPath: 'file:///v.mp4',
    sizeBytes: 5,
    sha256Client: 'ab'.repeat(32),
  });
  return files;
}

function fakeGateway() {
  const uploads: string[] = [];
  const gateway: UploadGateway = {
    upload: async (request) => {
      uploads.push(request.evidenceId);
      return { kind: 'received' };
    },
    fetchServerStates: async () => new Map(),
  };
  return { gateway, uploads };
}

const hasher = { sha256: async () => ({ ok: true as const, sha256: 'ab'.repeat(32) }) };
const docs = {} as RemoteDocuments;
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

const element = (
  files: ReturnType<typeof createMemoryEvidenceFileStore>,
  shopId: string | null,
  props: { docs: RemoteDocuments | null; gateway?: UploadGateway },
  returns: ReturnStore = createMemoryReturnStore(),
) => (
  <CurrentShopProvider shopId={shopId}>
    <EvidenceFileStoreProvider store={files}>
      <ReturnStoreProvider store={returns}>
        <UploadRunner
          docs={props.docs}
          hasher={hasher}
          {...(props.gateway ? { gateway: props.gateway } : {})}
        />
      </ReturnStoreProvider>
    </EvidenceFileStoreProvider>
  </CurrentShopProvider>
);

const mount = async (
  files: ReturnType<typeof createMemoryEvidenceFileStore>,
  shopId: string | null,
  props: { docs: RemoteDocuments | null; gateway?: UploadGateway },
  returns?: ReturnStore,
) => render(element(files, shopId, props, returns));

/** Kho hàng hoàn có một ảnh `queued` của uid 'uid-1' trong hồ sơ ĐÃ (hoặc CHƯA) đăng bản neo. */
async function returnStoreWithPhoto(shopId: string, anchorPublished: boolean) {
  const store = createMemoryReturnStore({ creatorUid: () => 'uid-1' });
  const made = await store.createReturn({
    id: 'ret-1' as never,
    shopId: shopId as never,
    atDevice: 1,
    eventId: 'e-1',
    observedCode: null,
    link: null,
    lines: [],
  });
  const d = (type: string) => ({ type, origin: 'device' }) as never;
  await store.createMedia({
    id: 'ph-1',
    shopId: shopId as never,
    returnId: made.returnCase.id,
    kind: 'photo',
    atDevice: 2,
  });
  await store.applyMediaEvent(shopId as never, 'ph-1', d('STOP_RECORDING'), 3, {
    localPath: 'tmp/p.jpg',
  });
  await store.applyMediaEvent(shopId as never, 'ph-1', d('LOCAL_FILE_READABLE'), 4, {
    localPath: 'evidence/ph-1.jpg',
    sizeBytes: 7,
    sha256Client: 'ab'.repeat(32),
  });
  if (anchorPublished) await store.markReturnPublished(shopId as never, made.returnCase.id, 5);
  return store;
}

describe('UploadRunner', () => {
  it('tải cả media hàng hoàn qua CÙNG hàng đợi, chỉ khi hồ sơ đã đăng neo và do chính uid tạo', async () => {
    const files = createMemoryEvidenceFileStore();
    const returns = await returnStoreWithPhoto(REAL_SHOP, true);
    const t = fakeGateway();
    await mount(
      files,
      REAL_SHOP,
      { docs: { currentUid: () => 'uid-1' } as RemoteDocuments, gateway: t.gateway },
      returns,
    );
    await flush();
    expect(t.uploads).toEqual(['ph-1']);
    expect((await returns.listMedia(REAL_SHOP as never, 'ret-1' as never))[0]?.state).toBe(
      'uploaded',
    );
  });

  it('media hàng hoàn của hồ sơ chưa đăng neo, hoặc khi chưa đăng nhập, không bị tải', async () => {
    const files = createMemoryEvidenceFileStore();
    const notPublished = await returnStoreWithPhoto(REAL_SHOP, false);
    const t1 = fakeGateway();
    await mount(
      files,
      REAL_SHOP,
      { docs: { currentUid: () => 'uid-1' } as RemoteDocuments, gateway: t1.gateway },
      notPublished,
    );
    await flush();
    expect(t1.uploads).toEqual([]);
    const signedOut = await returnStoreWithPhoto(REAL_SHOP, true);
    const t2 = fakeGateway();
    await mount(
      files,
      REAL_SHOP,
      { docs: { currentUid: () => null } as RemoteDocuments, gateway: t2.gateway },
      signedOut,
    );
    await flush();
    expect(t2.uploads).toEqual([]);
  });

  it('có cổng và shop thật: tải tệp đang chờ ngay khi gắn', async () => {
    const files = await storeWithQueuedFile(REAL_SHOP);
    const t = fakeGateway();
    await mount(files, REAL_SHOP, { docs, gateway: t.gateway });
    await flush();
    expect(t.uploads).toEqual(['ev-1']);
    expect((await files.get(REAL_SHOP as never, 'ev-1' as EvidenceId))?.state).toBe('uploaded');
  });

  it('không có cổng (cổng giả/test/thiếu cấu hình): không làm gì', async () => {
    const files = await storeWithQueuedFile(REAL_SHOP);
    await mount(files, REAL_SHOP, { docs: null });
    await flush();
    expect((await files.get(REAL_SHOP as never, 'ev-1' as EvidenceId))?.state).toBe('queued');
  });

  it('shop cục bộ tạm hoặc chưa biết shop: không bao giờ tải', async () => {
    const files = await storeWithQueuedFile(LOCAL_SHOP_ID);
    const t = fakeGateway();
    await mount(files, null, { docs, gateway: t.gateway });
    await mount(files, LOCAL_SHOP_ID, { docs, gateway: t.gateway });
    await flush();
    expect(t.uploads).toEqual([]);
  });

  it('chạy lại khi app trở lại foreground và hủy đăng ký khi gỡ', async () => {
    const files = await storeWithQueuedFile(REAL_SHOP);
    const t = fakeGateway();
    const view = await mount(files, REAL_SHOP, { docs, gateway: t.gateway });
    await flush();
    expect(activeListener).not.toBeNull();
    await view.unmount();
    expect(activeListener).toBeNull();
  });

  it('đổi trạng thái mạng không tạo lại hàng đợi: không chạy chồng hai lượt tải trên cùng một tệp', async () => {
    const files = await storeWithQueuedFile(REAL_SHOP);
    const uploads: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const gateway: UploadGateway = {
      upload: async (request) => {
        uploads.push(request.evidenceId);
        await gate;
        return { kind: 'received' };
      },
      fetchServerStates: async () => new Map(),
    };
    const props = { docs, gateway };
    const returns = createMemoryReturnStore();
    const view = await mount(files, REAL_SHOP, props, returns);
    await flush();
    expect(uploads).toEqual(['ev-1']); // lượt đầu đang tải dở
    for (const offline of [true, false, true, false]) {
      mockOffline = offline;
      await view.rerender(element(files, REAL_SHOP, props, returns));
      await flush();
    }
    release();
    await flush();
    expect(uploads).toEqual(['ev-1']);
    expect((await files.get(REAL_SHOP as never, 'ev-1' as EvidenceId))?.state).toBe('uploaded');
  });

  it('ngoại tuyến thì không tải; có mạng lại thì tải ngay (không đợi chu kỳ 60 giây)', async () => {
    mockOffline = true;
    const files = await storeWithQueuedFile(REAL_SHOP);
    const t = fakeGateway();
    const props = { docs, gateway: t.gateway };
    const returns = createMemoryReturnStore();
    const view = await mount(files, REAL_SHOP, props, returns);
    await flush();
    expect(t.uploads).toEqual([]);
    mockOffline = false;
    await view.rerender(element(files, REAL_SHOP, props, returns));
    await flush();
    expect(t.uploads).toEqual(['ev-1']);
  });
});
