import { act, render } from '@testing-library/react-native';

import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, OrderId, PackageId, SessionId } from '@/core/ids';
import {
  CurrentShopProvider,
  EvidenceFileStoreProvider,
  LOCAL_SHOP_ID,
  createMemoryEvidenceFileStore,
} from '@/features/orders';

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

const mount = async (
  files: ReturnType<typeof createMemoryEvidenceFileStore>,
  shopId: string | null,
  props: { docs: RemoteDocuments | null; gateway?: UploadGateway },
) =>
  render(
    <CurrentShopProvider shopId={shopId}>
      <EvidenceFileStoreProvider store={files}>
        <UploadRunner
          docs={props.docs}
          hasher={hasher}
          {...(props.gateway ? { gateway: props.gateway } : {})}
        />
      </EvidenceFileStoreProvider>
    </CurrentShopProvider>,
  );

describe('UploadRunner', () => {
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
});
