import { act, screen } from '@testing-library/react-native';

import type { EvidenceId, OrderId, PackageId, SessionId } from '@/core/ids';
import {
  LOCAL_SHOP_ID,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
} from '@/features/orders';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { RecordingRecovery } from './RecordingRecovery';

let mockEnabled = true;
jest.mock('../domain/recorder', () => ({
  get RECORDER_ENABLED() {
    return mockEnabled;
  },
}));
let mockPersisted: (id: string) => string | null = () => null;
let mockHash: () => Promise<unknown> = async () => ({ ok: false });
jest.mock('@/platform/recording-files', () => ({
  persistRecording: () => ({ ok: true, uri: 'evidence/ev-1.mp4', sizeBytes: 9 }),
  recordingExists: () => false,
  findPersistedRecording: (id: string) => mockPersisted(id),
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: () => mockHash(),
}));

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

type Files = ReturnType<typeof createMemoryEvidenceFileStore>;

async function seedFile(
  files: Files,
  shopId: string,
  id: string,
  sessionId: string,
  createdAtDevice = 1,
) {
  await files.create({
    id: id as EvidenceId,
    shopId: shopId as never,
    orderId: 'o' as OrderId,
    packageId: 'p' as PackageId,
    sessionId: sessionId as SessionId,
    group: 'pack',
    kind: 'video',
    createdAtDevice,
  });
}

async function setup(shopIds: string[]) {
  const orders = createMemoryOrderStore();
  const files = createMemoryEvidenceFileStore();
  const details = await seedOrder(orders, sampleOrder());
  const session = sampleSession(details, 1);
  await orders.saveSession(session);
  await orders.updateSessionStatus(LOCAL_SHOP_ID, session.id, 'recording');
  for (const [index, shopId] of shopIds.entries()) {
    await seedFile(files, shopId, `ev-${index + 1}`, session.id);
  }
  const view = await renderWithProviders(<RecordingRecovery />, {
    orderStore: orders,
    evidenceFileStore: files,
  });
  await flush();
  return { files, orders, session, view };
}

describe('RecordingRecovery', () => {
  afterEach(() => {
    mockPersisted = () => null;
    mockHash = async () => ({ ok: false });
  });

  it('bộ ghi bật: tệp đang ghi dở bị app kill thành unrecoverable, phiên interrupted, và có thông báo riêng', async () => {
    mockEnabled = true;
    const { files, orders, session } = await setup([LOCAL_SHOP_ID]);
    expect((await files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId))?.state).toBe('unrecoverable');
    expect((await orders.getSession(LOCAL_SHOP_ID, session.id))?.sessionStatus).toBe('interrupted');
    expect(await screen.findByText(/Lần quay trước bị gián đoạn/)).toBeOnTheScreen();
  });

  it('khôi phục MỌI shop trên máy (shop cục bộ tạm và shop khác), để phiên không treo "đang quay" mãi', async () => {
    mockEnabled = true;
    const { files } = await setup(['shop-that', 'shop-khac', LOCAL_SHOP_ID]);
    for (const [index, shopId] of ['shop-that', 'shop-khac', LOCAL_SHOP_ID].entries()) {
      expect((await files.get(shopId as never, `ev-${index + 1}` as EvidenceId))?.state).toBe(
        'unrecoverable',
      );
    }
  });

  it('không có lần quay dở dang: không thông báo', async () => {
    mockEnabled = true;
    await setup([]);
    expect(screen.queryByText(/Lần quay trước bị gián đoạn/)).toBeNull();
  });

  it('bộ ghi tắt: không động vào dữ liệu và không thông báo', async () => {
    mockEnabled = false;
    const { files } = await setup(['shop-that']);
    expect((await files.get('shop-that' as never, 'ev-1' as EvidenceId))?.state).toBe('recording');
    expect(screen.queryByText(/Lần quay trước bị gián đoạn/)).toBeNull();
  });

  it('chỉ chạy MỘT lần cho mỗi kho: gắn lại không đè lên lần quay mới đang diễn ra', async () => {
    mockEnabled = true;
    const { files, orders, session, view } = await setup([]);
    await seedFile(files, 'shop-that', 'ev-moi', session.id); // lần quay mới bắt đầu sau khi app đã mở
    await view.unmount();
    await renderWithProviders(<RecordingRecovery />, {
      orderStore: orders,
      evidenceFileStore: files,
    });
    await flush();
    expect((await files.get('shop-that' as never, 'ev-moi' as EvidenceId))?.state).toBe(
      'recording',
    );
  });

  it('hai shop cùng có tệp dở: lần quay MỚI ở shop B trong lúc băm tệp shop A không bị đè (danh sách chụp một lần)', async () => {
    mockEnabled = true;
    const orders = createMemoryOrderStore();
    const files = createMemoryEvidenceFileStore();
    const details = await seedOrder(orders, sampleOrder());
    const session = sampleSession(details, 1);
    await orders.saveSession(session);
    // shop A (xử lý trước): tệp đang lưu, còn tệp bền nên phải băm (băm bị giữ lại)
    await seedFile(files, 'shop-a', 'ev-a', session.id);
    await files.applyEvent(
      'shop-a' as never,
      'ev-a' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      2,
      { localPath: 'evidence/ev-a.mp4' },
    );
    // shop B có tệp dở thật (từ lần chạy app trước)
    await seedFile(files, 'shop-b', 'ev-b-cu', session.id);
    mockPersisted = (id) => (id === 'ev-a' ? 'evidence/ev-a.mp4' : null);
    let releaseHash: () => void = () => undefined;
    mockHash = () =>
      new Promise((resolve) => {
        releaseHash = () => resolve({ ok: true, sha256: 'a'.repeat(64), sizeBytes: 9 });
      });
    await renderWithProviders(<RecordingRecovery />, {
      orderStore: orders,
      evidenceFileStore: files,
    });
    await flush(); // đang băm tệp shop A
    // người dùng bắt đầu quay ở shop B (tệp mới, đang ghi) và một tệp dở khác chuyển sang đang lưu
    await seedFile(files, 'shop-b', 'ev-b-moi', session.id);
    releaseHash();
    await flush();
    await flush();
    expect((await files.get('shop-a' as never, 'ev-a' as EvidenceId))?.state).toBe('queued');
    expect((await files.get('shop-b' as never, 'ev-b-cu' as EvidenceId))?.state).toBe(
      'unrecoverable',
    );
    expect((await files.get('shop-b' as never, 'ev-b-moi' as EvidenceId))?.state).toBe('recording');
  });

  it('phiên recording có tệp đã queued (kill trước khi cập nhật phiên) được đưa về ended lúc mở app', async () => {
    mockEnabled = true;
    const orders = createMemoryOrderStore();
    const files = createMemoryEvidenceFileStore();
    const details = await seedOrder(orders, sampleOrder());
    const session = sampleSession(details, 1);
    await orders.saveSession(session);
    await orders.updateSessionStatus(LOCAL_SHOP_ID, session.id, 'recording');
    await seedFile(files, LOCAL_SHOP_ID, 'ev-q', session.id);
    for (const [type, patch] of [
      ['STOP_RECORDING', { localPath: 'p' }],
      [
        'LOCAL_FILE_READABLE',
        { localPath: 'evidence/ev-q.mp4', sizeBytes: 1, sha256Client: 'a'.repeat(64) },
      ],
    ] as const) {
      await files.applyEvent(
        LOCAL_SHOP_ID,
        'ev-q' as EvidenceId,
        { type, origin: 'device' },
        2,
        patch,
      );
    }
    await renderWithProviders(<RecordingRecovery />, {
      orderStore: orders,
      evidenceFileStore: files,
    });
    await flush();
    expect((await orders.getSession(LOCAL_SHOP_ID, session.id))?.sessionStatus).toBe('ended');
    expect(await orders.hasRecordingInProgress(LOCAL_SHOP_ID)).toBe(false);
    expect(screen.queryByText(/Lần quay trước bị gián đoạn/)).toBeNull();
  });

  describe('chưa đọc được kho', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const tick = (ms: number) => act(async () => void (await jest.advanceTimersByTimeAsync(ms)));

    async function setupFlaky(failures: number) {
      mockEnabled = true;
      const orders = createMemoryOrderStore();
      const real = createMemoryEvidenceFileStore();
      const details = await seedOrder(orders, sampleOrder());
      const session = sampleSession(details, 1);
      await orders.saveSession(session);
      await orders.updateSessionStatus(LOCAL_SHOP_ID, session.id, 'recording');
      await seedFile(real, LOCAL_SHOP_ID, 'ev-cu', session.id);
      let remaining = failures;
      let calls = 0;
      const files: Files = {
        ...real,
        listShopsWithStates: async (states) => {
          calls += 1;
          if (remaining > 0) {
            remaining -= 1;
            throw new Error('db');
          }
          return real.listShopsWithStates(states);
        },
      };
      const view = await renderWithProviders(<RecordingRecovery />, {
        orderStore: orders,
        evidenceFileStore: files,
      });
      return { real, orders, session, view, calls: () => calls };
    }

    it('lỗi đọc kho: tự thử lại bằng đồng hồ riêng, không phải chờ lần mở app sau', async () => {
      const t = await setupFlaky(1);
      await tick(0);
      expect(t.calls()).toBe(1);
      expect((await t.real.get(LOCAL_SHOP_ID, 'ev-cu' as EvidenceId))?.state).toBe('recording');
      await tick(15_000);
      expect(t.calls()).toBe(2);
      expect((await t.real.get(LOCAL_SHOP_ID, 'ev-cu' as EvidenceId))?.state).toBe('unrecoverable');
      expect((await t.orders.getSession(LOCAL_SHOP_ID, t.session.id))?.sessionStatus).toBe(
        'interrupted',
      );
    });

    it('thử lại KHÔNG đè lên lần quay của lần chạy này (tạo sau mốc khởi động)', async () => {
      const t = await setupFlaky(1);
      await tick(0);
      // người dùng bắt đầu quay trong lúc chờ thử lại
      await seedFile(t.real, LOCAL_SHOP_ID, 'ev-dang-quay', t.session.id, Date.now() + 1);
      await tick(15_000);
      expect((await t.real.get(LOCAL_SHOP_ID, 'ev-cu' as EvidenceId))?.state).toBe('unrecoverable');
      expect((await t.real.get(LOCAL_SHOP_ID, 'ev-dang-quay' as EvidenceId))?.state).toBe(
        'recording',
      );
    });

    it('lỗi liên tục: dừng sau số lần tối đa, không thử mãi; gỡ màn thì hủy hẹn', async () => {
      const t = await setupFlaky(99);
      for (let i = 0; i < 12; i += 1) await tick(5 * 15_000);
      expect(t.calls()).toBe(5);
      const gone = await setupFlaky(99);
      await tick(0);
      await gone.view.unmount();
      await tick(10 * 15_000);
      expect(gone.calls()).toBe(1);
    });
  });
});
