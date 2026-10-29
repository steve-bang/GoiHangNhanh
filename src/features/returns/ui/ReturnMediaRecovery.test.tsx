import { screen, waitFor } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { LOCAL_SHOP_ID } from '@/features/orders';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import { ReturnMediaRecovery } from './ReturnMediaRecovery';

const mockPersist = jest.fn();
const mockHash = jest.fn();
const mockExisting = new Set<string>();
jest.mock('@/platform/recording-files', () => ({
  persistRecording: (...args: unknown[]) => mockPersist(...args),
  recordingExists: (path: string) => mockExisting.has(path),
  findPersistedRecording: (id: string) =>
    mockExisting.has(`evidence/${id}.jpg`) ? `evidence/${id}.jpg` : null,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: (...args: unknown[]) => mockHash(...args),
}));

const SHOP = LOCAL_SHOP_ID;
const dev = (type: string) => ({ type, origin: 'device' }) as never;

beforeEach(() => {
  mockExisting.clear();
  mockPersist.mockReset();
  mockHash.mockReset().mockResolvedValue({ ok: true, sha256: 'ab'.repeat(32), sizeBytes: 77 });
});

async function seed(store: ReturnType<typeof createMemoryReturnStore>) {
  const id = 'ret-rec' as ReturnCaseId;
  await store.createReturn({
    id,
    shopId: SHOP,
    atDevice: 1,
    eventId: 'e1',
    observedCode: null,
    link: null,
    lines: [],
  });
  // tạo từ thời điểm 5 (< mốc khởi động app) = tàn dư của lần chạy trước
  await store.createMedia({ id: 'p-save', shopId: SHOP, returnId: id, kind: 'photo', atDevice: 5 });
  await store.applyMediaEvent(SHOP, 'p-save', dev('STOP_RECORDING'), 6, { localPath: 'tmp/p.jpg' });
  await store.createMedia({ id: 'p-rec', shopId: SHOP, returnId: id, kind: 'photo', atDevice: 5 });
  return id;
}

describe('ReturnMediaRecovery', () => {
  it('khôi phục ảnh dở dang khi mở app: cứu ảnh còn tệp, đánh dấu ảnh không còn tệp, báo một thông báo ngắn', async () => {
    const store = createMemoryReturnStore();
    const id = await seed(store);
    mockExisting.add('evidence/p-save.jpg');
    await renderWithProviders(<ReturnMediaRecovery />, { returnStore: store });
    await waitFor(async () => {
      const media = await store.listMedia(SHOP, id);
      expect(media.find((m) => m.id === 'p-save')?.state).toBe('queued');
      expect(media.find((m) => m.id === 'p-rec')?.state).toBe('unrecoverable');
    });
    expect(
      await screen.findByText(/Lần chụp hoặc quay hàng hoàn trước bị gián đoạn/),
    ).toBeOnTheScreen();
    expect(mockPersist).not.toHaveBeenCalled(); // đã ở thư mục bền
  });

  it('không có media dở dang: không làm gì, không thông báo', async () => {
    const store = createMemoryReturnStore();
    await renderWithProviders(<ReturnMediaRecovery />, { returnStore: store });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/gián đoạn/)).toBeNull();
  });

  it('chỉ chạy một lần cho mỗi kho dù gắn lại', async () => {
    const store = createMemoryReturnStore();
    const id = await seed(store);
    mockExisting.add('evidence/p-save.jpg');
    const first = await renderWithProviders(<ReturnMediaRecovery />, { returnStore: store });
    await waitFor(async () =>
      expect((await store.listMedia(SHOP, id)).find((m) => m.id === 'p-save')?.state).toBe(
        'queued',
      ),
    );
    first.unmount();
    mockHash.mockClear();
    await renderWithProviders(<ReturnMediaRecovery />, { returnStore: store });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockHash).not.toHaveBeenCalled();
  });
});
