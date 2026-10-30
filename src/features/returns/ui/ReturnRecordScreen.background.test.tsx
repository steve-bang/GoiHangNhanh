import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { LOCAL_SHOP_ID } from '@/features/orders';
import { emitAppState, resetMockAppState } from '@/test-utils/mock-app-state';
import { mockRecorder, resetMockRecorder } from '@/test-utils/mock-camera-recorder';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockKeepAwake, resetMockKeepAwake } from '@/test-utils/mock-keep-awake';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import { hasOpeningEvidenceLimit, type ReturnStore } from '../domain';
import { ReturnRecordScreen } from './ReturnRecordScreen';

// V1-11 cho UI-D04 (video mở kiện hàng hoàn): giữ màn hình sáng, app vào nền khi đang quay.
jest.mock('@/core/config/recorder', () => ({ RECORDER_ENABLED: true }));
jest.mock(
  '@/platform/app-state',
  () => jest.requireActual('@/test-utils/mock-app-state').appStateMock,
);
jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
jest.mock(
  '@/platform/camera-recorder',
  () => jest.requireActual('@/test-utils/mock-camera-recorder').cameraRecorderMock,
);
const mockPersist = jest.fn();
const mockHash = jest.fn();
jest.mock('@/platform/recording-files', () => ({
  persistRecording: (...args: unknown[]) => mockPersist(...args),
  resolveRecordingUri: (stored: string) => `file:///docs/${stored}`,
  recordingExists: () => true,
  getAvailableDiskBytes: () => 10 * 1024 * 1024 * 1024,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: (...args: unknown[]) => mockHash(...args),
}));

const SHOP = LOCAL_SHOP_ID;
const STOPPED_TOAST = 'Đã dừng quay vì ứng dụng chuyển sang nền. Ứng dụng không tự quay tiếp.';

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  resetMockRecorder();
  resetMockKeepAwake();
  resetMockAppState();
  mockPersist.mockReset().mockImplementation((_t: string, id: string, ext: string) => ({
    ok: true,
    uri: `evidence/${id}.${ext}`,
    sizeBytes: 4096,
  }));
  mockHash.mockReset().mockResolvedValue({ ok: true, sha256: 'cd'.repeat(32), sizeBytes: 4096 });
});

async function seedOpening(store: ReturnStore): Promise<ReturnCaseId> {
  const id = `ret-${Math.random().toString(36).slice(2)}` as ReturnCaseId;
  await store.createReturn({
    id,
    shopId: SHOP,
    atDevice: 1_000,
    eventId: `e-${id}`,
    observedCode: null,
    link: null,
    lines: [],
  });
  await store.saveExterior(SHOP, id, {
    exterior: { signs: ['dented'], note: '', recordedAtDevice: 2_000 },
    openedBefore: null,
    eventId: `x-${id}`,
    openedEventId: `y-${id}`,
  });
  return id;
}

async function startRecording(store: ReturnStore = createMemoryReturnStore()) {
  const id = await seedOpening(store);
  mockNavigation.params = { returnId: id };
  const view = await renderWithProviders(<ReturnRecordScreen />, { returnStore: store });
  await act(async () => mockRecorder.signalReady());
  await screen.findByText('Đang quay');
  return { store, id, view };
}

const openingVideo = async (store: ReturnStore, id: ReturnCaseId) =>
  (await store.getReturn(SHOP, id))?.returnCase.openingVideo;

describe('UI-D04 giữ màn hình sáng và vào nền (V1-11)', () => {
  it('giữ sáng một lần khi quay, có dòng giới hạn Q-24b; tắt khi gỡ màn', async () => {
    const { view } = await startRecording();
    expect(mockKeepAwake.activations).toBe(1);
    expect(mockKeepAwake.activeCount()).toBe(1);
    expect(screen.getByTestId('recording-footnote')).toHaveTextContent(
      'Giữ ứng dụng mở trong lúc quay. Nếu ứng dụng bị tắt, đoạn đang quay có thể mất.',
    );
    await act(async () => view.unmount());
    expect(mockKeepAwake.activeCount()).toBe(0);
  });

  it('vào nền khi đang quay: dừng một lần, video lưu như thường, hồ sơ ghi interrupted (hạn chế bằng chứng), báo khi quay lại', async () => {
    const { store, id } = await startRecording();
    await act(async () => emitAppState('background'));
    expect(mockRecorder.stopCalls).toBe(1);
    expect(
      screen.getByText('Đã dừng quay vì ứng dụng chuyển sang nền. Đang lưu phần đã quay…'),
    ).toBeOnTheScreen();
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    const media = await store.listMedia(SHOP, id);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({ kind: 'video', state: 'queued' });
    expect(await openingVideo(store, id)).toMatchObject({
      kind: 'recorded',
      mediaId: media[0]?.id,
      interrupted: true,
    });
    const details = await store.getReturn(SHOP, id);
    expect(details && hasOpeningEvidenceLimit(details.returnCase)).toBe(true);
    await act(async () => emitAppState('active'));
    expect(await screen.findByText(STOPPED_TOAST)).toBeOnTheScreen();
    expect(mockRecorder.recordCalls).toBe(1);
  });

  it('vào nền khi bản ghi còn đang khởi động: dừng ngay khi bắt đầu xong, video ghi interrupted', async () => {
    const store = createMemoryReturnStore();
    const original = store.createMedia.bind(store);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    store.createMedia = async (...args) => {
      await gate;
      return original(...args);
    };
    const id = await seedOpening(store);
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnRecordScreen />, { returnStore: store });
    await act(async () => mockRecorder.signalReady()); // begin chờ createMedia
    await act(async () => emitAppState('background'));
    expect(mockRecorder.stopCalls).toBe(0);
    await act(async () => release());
    await act(async () => undefined);
    expect(mockRecorder.recordCalls).toBe(1);
    expect(mockRecorder.stopCalls).toBe(1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(async () =>
      expect(await openingVideo(store, id)).toMatchObject({ interrupted: true }),
    );
  });

  it('iOS inactive: không dừng; người dùng tự dừng thì video không bị đánh gián đoạn', async () => {
    const { store, id } = await startRecording();
    await act(async () => emitAppState('inactive'));
    expect(mockRecorder.stopCalls).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(async () =>
      expect(await openingVideo(store, id)).toMatchObject({ interrupted: false }),
    );
  });

  it('camera tự dừng sớm mà không ai yêu cầu: hồ sơ ghi interrupted', async () => {
    const { store, id } = await startRecording();
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(async () =>
      expect(await openingVideo(store, id)).toMatchObject({ interrupted: true }),
    );
  });

  it('lưu xong nhưng ghi vào hồ sơ lỗi: bước đối soát vẫn ghi đúng cờ gián đoạn', async () => {
    const store = createMemoryReturnStore();
    const original = store.saveOpeningVideoRecorded.bind(store);
    let failOnce = true;
    store.saveOpeningVideoRecorded = async (...args) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('db');
      }
      return original(...args);
    };
    const { id } = await startRecording(store);
    await act(async () => emitAppState('background'));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    expect(await openingVideo(store, id)).toMatchObject({ kind: 'recorded', interrupted: true });
  });

  it('V1-13: vào nền ghi cờ gián đoạn BỀN ngay, trước khi camera trả kết quả', async () => {
    const { store, id } = await startRecording();
    await act(async () => emitAppState('background'));
    await waitFor(async () =>
      expect((await store.listMedia(SHOP, id))[0]).toMatchObject({
        kind: 'video',
        state: 'recording',
        interrupted: true,
      }),
    );
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(async () =>
      expect(await openingVideo(store, id)).toMatchObject({ interrupted: true }),
    );
  });

  it('V1-13 (a): mở lại màn khi video đã lưu mà hồ sơ chưa ghi nhận (app bị tắt giữa hai bước): đối soát đọc cờ bền', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    // Trạng thái để lại sau khi app bị tắt: video `queued`, có cờ gián đoạn bền, hồ sơ chưa có video.
    const d = (type: string) => ({ type, origin: 'device' }) as never;
    await store.createMedia({
      id: 'v-old',
      shopId: SHOP,
      returnId: id,
      kind: 'video',
      atDevice: 3,
    });
    await store.markMediaInterrupted(SHOP, 'v-old');
    await store.applyMediaEvent(SHOP, 'v-old', d('STOP_RECORDING'), 4, { localPath: 'tmp/v.mov' });
    await store.applyMediaEvent(SHOP, 'v-old', d('LOCAL_FILE_MOVED'), 5, {
      localPath: 'evidence/v-old.mov',
    });
    await store.applyMediaEvent(SHOP, 'v-old', d('LOCAL_FILE_READABLE'), 6, {
      localPath: 'evidence/v-old.mov',
      sizeBytes: 10,
      sha256Client: 'cd'.repeat(32),
    });
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnRecordScreen />, { returnStore: store });
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    expect(await openingVideo(store, id)).toMatchObject({
      kind: 'recorded',
      mediaId: 'v-old',
      interrupted: true,
    });
    expect(mockRecorder.recordCalls).toBe(0);
  });
});
