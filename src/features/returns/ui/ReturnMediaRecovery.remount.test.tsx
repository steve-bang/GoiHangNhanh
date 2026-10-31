import { waitFor } from '@testing-library/react-native';

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

describe('ReturnMediaRecovery (gỡ gắn giữa lượt)', () => {
  it('chờ lượt đang chạy của effect trước rồi tự thử lại khi nó lỗi kho', async () => {
    const store = createMemoryReturnStore();
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
    await store.createMedia({
      id: 'p-save',
      shopId: SHOP,
      returnId: id,
      kind: 'photo',
      atDevice: 5,
    });
    await store.applyMediaEvent(SHOP, 'p-save', dev('STOP_RECORDING'), 6, {
      localPath: 'tmp/p.jpg',
    });
    mockExisting.add('evidence/p-save.jpg');
    const real = store.listUnfinishedMedia.bind(store);
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.listUnfinishedMedia = async () => {
      calls += 1;
      if (calls === 1) {
        await gate; // lượt đầu còn đang chạy khi bị gỡ gắn
        throw new Error('db');
      }
      return real();
    };
    const first = await renderWithProviders(<ReturnMediaRecovery />, { returnStore: store });
    await waitFor(() => expect(calls).toBe(1));
    first.unmount();
    await renderWithProviders(<ReturnMediaRecovery />, { returnStore: store });
    release();
    // Không chờ hẹn giờ 15 giây: lần gắn lại đang chờ lượt đầu rồi tự thử tiếp.
    await waitFor(async () =>
      expect((await store.listMedia(SHOP, id)).find((m) => m.id === 'p-save')?.state).toBe(
        'queued',
      ),
    );
    expect(calls).toBe(2);
  });
});
