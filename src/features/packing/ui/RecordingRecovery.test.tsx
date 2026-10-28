import { act, render } from '@testing-library/react-native';

import type { EvidenceId, OrderId, PackageId, SessionId } from '@/core/ids';
import {
  CurrentShopProvider,
  EvidenceFileStoreProvider,
  LOCAL_SHOP_ID,
  OrderStoreProvider,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
} from '@/features/orders';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';

import { RecordingRecovery } from './RecordingRecovery';

let mockEnabled = true;
jest.mock('../domain/recorder', () => ({
  get RECORDER_ENABLED() {
    return mockEnabled;
  },
}));
jest.mock('@/platform/recording-files', () => ({
  persistRecording: () => ({ ok: true, uri: 'file:///docs/evidence/ev-1.mp4', sizeBytes: 9 }),
  recordingExists: () => false,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: async () => ({ ok: false }),
}));

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

async function setup(shopId: string) {
  const orders = createMemoryOrderStore();
  const files = createMemoryEvidenceFileStore();
  const details = await seedOrder(orders, sampleOrder());
  const session = sampleSession(details, 1);
  await orders.saveSession(session);
  await files.create({
    id: 'ev-1' as EvidenceId,
    shopId: shopId as never,
    orderId: 'o' as OrderId,
    packageId: 'p' as PackageId,
    sessionId: session.id as SessionId,
    group: 'pack',
    kind: 'video',
    createdAtDevice: 1,
  });
  await render(
    <CurrentShopProvider shopId={shopId}>
      <OrderStoreProvider store={orders}>
        <EvidenceFileStoreProvider store={files}>
          <RecordingRecovery />
        </EvidenceFileStoreProvider>
      </OrderStoreProvider>
    </CurrentShopProvider>,
  );
  await flush();
  return files;
}

describe('RecordingRecovery', () => {
  it('bộ ghi bật, shop thật: tệp đang ghi dở bị app kill thành unrecoverable (ghi nhận thiếu)', async () => {
    mockEnabled = true;
    const files = await setup('shop-that');
    expect((await files.get('shop-that' as never, 'ev-1' as EvidenceId))?.state).toBe(
      'unrecoverable',
    );
  });

  it('bộ ghi tắt hoặc shop cục bộ tạm: không động vào dữ liệu', async () => {
    mockEnabled = false;
    const off = await setup('shop-that');
    expect((await off.get('shop-that' as never, 'ev-1' as EvidenceId))?.state).toBe('recording');
    mockEnabled = true;
    const local = await setup(LOCAL_SHOP_ID);
    expect((await local.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId))?.state).toBe('recording');
  });
});
