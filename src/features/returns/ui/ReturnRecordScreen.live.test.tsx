import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { LOCAL_SHOP_ID } from '@/features/orders';
import { mockRecorder, resetMockRecorder } from '@/test-utils/mock-camera-recorder';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import { hasOpeningEvidenceLimit, type ReturnStore } from '../domain';
import { ReturnRecordScreen } from './ReturnRecordScreen';

// Nhánh khi bộ ghi video thật đã bật (RECORDER_ENABLED=true): quay video mở kiện thật qua CameraRecorder
// (mock). Cờ TẮT được phủ ở returns-flow.test.tsx (màn xem trước như cũ).
jest.mock('@/core/config/recorder', () => ({ RECORDER_ENABLED: true }));
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
let mockFreeBytes: number | null = 10 * 1024 * 1024 * 1024;
const mockPersist = jest.fn();
const mockHash = jest.fn();
jest.mock('@/platform/recording-files', () => ({
  persistRecording: (...args: unknown[]) => mockPersist(...args),
  resolveRecordingUri: (stored: string) => `file:///docs/${stored}`,
  recordingExists: () => true,
  getAvailableDiskBytes: () => mockFreeBytes,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: (...args: unknown[]) => mockHash(...args),
}));

const SHOP = LOCAL_SHOP_ID;
const SHA = 'cd'.repeat(32);

beforeEach(() => {
  mockFreeBytes = 10 * 1024 * 1024 * 1024;
  resetMockNavigation();
  resetMockScanner();
  resetMockRecorder();
  mockPersist.mockReset().mockImplementation((_t: string, id: string, ext: string) => ({
    ok: true,
    uri: `evidence/${id}.${ext}`,
    sizeBytes: 4096,
  }));
  mockHash.mockReset().mockResolvedValue({ ok: true, sha256: SHA, sizeBytes: 4096 });
});

async function seedOpening(store: ReturnStore, openedBefore = false): Promise<ReturnCaseId> {
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
    openedBefore: openedBefore ? { reason: 'mở sẵn', markedAtDevice: 2_000 } : null,
    eventId: `x-${id}`,
    openedEventId: `y-${id}`,
  });
  return id;
}

async function open(store: ReturnStore, id: ReturnCaseId) {
  mockNavigation.params = { returnId: id };
  return renderWithProviders(<ReturnRecordScreen />, { returnStore: store });
}

const dev = (type: string) => ({ type, origin: 'device' }) as never;

describe('UI-D04 khi bộ ghi video thật bật', () => {
  it('chưa sẵn sàng: "Xem trước", chưa tạo bản ghi; camera sẵn sàng: tạo bản ghi video TRƯỚC rồi "Đang quay"', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(await store.listMedia(SHOP, id)).toEqual([]);
    await act(async () => mockRecorder.signalReady());
    expect(await screen.findByText('Đang quay')).toBeOnTheScreen();
    expect(mockRecorder.recordCalls).toBe(1);
    expect(mockRecorder.lastRecordOptions).toEqual({ maxDurationSec: 600 });
    expect(await store.listMedia(SHOP, id)).toMatchObject([
      { kind: 'video', state: 'recording', returnId: id },
    ]);
    // hồ sơ chưa có kết luận video khi mới bắt đầu quay
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toBeNull();
  });

  it('camera báo sẵn sàng hai lần chỉ bắt đầu ghi một lần', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await act(async () => mockRecorder.signalReady());
    await act(async () => mockRecorder.signalReady());
    expect(mockRecorder.recordCalls).toBe(1);
  });

  it('dừng quay: lưu bền + băm, queued, hồ sơ ghi video, rồi sang kiểm hàng; KHÔNG nói đã tải lên', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    expect(mockRecorder.stopCalls).toBe(1);
    expect(await screen.findByTestId('recording-notice')).toBeOnTheScreen();
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    const [video] = await store.listMedia(SHOP, id);
    expect(video).toMatchObject({
      kind: 'video',
      state: 'queued',
      localPath: `evidence/${video?.id}.mov`,
      sha256Client: SHA,
    });
    expect(mockPersist).toHaveBeenCalledWith('file:///cache/v.mov', video?.id, 'mov');
    const saved = await store.getReturn(SHOP, id);
    expect(saved?.returnCase.status).toBe('checking');
    expect(saved?.returnCase.openingVideo).toMatchObject({
      kind: 'recorded',
      mediaId: video?.id,
      interrupted: false,
    });
    expect(screen.queryByText(/đã tải lên|đã xác minh/i)).toBeNull();
  });

  it('hết bộ nhớ khi lưu: nói đúng, không sang kiểm hàng, bản ghi local_save_failed, hồ sơ chưa có video', async () => {
    mockPersist.mockReturnValue({ ok: false, reason: 'STORAGE_FULL' });
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    expect(await screen.findByText(/Máy đã đầy bộ nhớ/)).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalledWith(ROUTES.returnItems, expect.anything());
    expect((await store.listMedia(SHOP, id))[0]).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///cache/v.mp4',
    });
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toBeNull();
    expect(screen.queryByText(/đã lưu/i)).toBeNull();
  });

  it('camera dừng đột ngột: báo video chưa được lưu, rồi ghi nhận lý do để tiếp tục (không quay bù)', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await act(async () => mockRecorder.finish({ ok: false, reason: 'RECORDER_FAILED' }));
    expect(await screen.findByText(/Camera dừng đột ngột/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-video-note-reason'));
    await screen.findByTestId('return-skip-sheet');
    // Kiện chưa mở trước: chỉ các lý do trung thực khi quay hỏng, không có "bản này chưa quay được".
    expect(screen.queryByTestId('return-skip-reason-recorder_unavailable')).toBeNull();
    await fireEvent.press(screen.getByTestId('return-skip-confirm'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toMatchObject({
      kind: 'missing',
      reason: 'device_problem',
    });
  });

  it('dung lượng trống không đủ: nói rõ, chưa tạo bản ghi nào', async () => {
    mockFreeBytes = 10 * 1024 * 1024;
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await act(async () => mockRecorder.signalReady());
    expect(await screen.findByText(/Máy cần đủ chỗ cho 10 phút quay/)).toBeOnTheScreen();
    expect(await store.listMedia(SHOP, id)).toEqual([]);
    expect(mockRecorder.recordCalls).toBe(0);
  });

  it('đã có lần quay trước không lưu được: không mở camera, yêu cầu ghi nhận lý do (không quay bù)', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await store.createMedia({
      id: 'v-old',
      shopId: SHOP,
      returnId: id,
      kind: 'video',
      atDevice: 5,
    });
    await store.applyMediaEvent(SHOP, 'v-old', dev('LOCAL_WRITE_FAILED'), 6);
    await open(store, id);
    expect(await screen.findByText(/Lần quay trước chưa lưu được/)).toBeOnTheScreen();
    expect(mockRecorder.mounted).toBe(false);
    await fireEvent.press(screen.getByTestId('return-video-note-reason'));
    await fireEvent.press(await screen.findByTestId('return-skip-confirm'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo?.kind).toBe('missing');
  });

  it('video đã lưu bền mà hồ sơ chưa ghi nhận (app bị đóng ở bước cuối): tự ghi nhận rồi sang kiểm hàng, không mở camera', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await store.createMedia({ id: 'v1', shopId: SHOP, returnId: id, kind: 'video', atDevice: 5 });
    await store.applyMediaEvent(SHOP, 'v1', dev('STOP_RECORDING'), 6, { localPath: 'tmp.mov' });
    await store.applyMediaEvent(SHOP, 'v1', dev('LOCAL_FILE_READABLE'), 7, {
      localPath: 'evidence/v1.mov',
      sizeBytes: 10,
      sha256Client: SHA,
    });
    await open(store, id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toMatchObject({
      kind: 'recorded',
      mediaId: 'v1',
      interrupted: false,
    });
    expect(mockRecorder.mounted).toBe(false);
  });

  it('bước video đã xong (đã có video): không mở camera, chỉ cho tiếp tục kiểm hàng', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await store.saveOpeningVideoMissing(SHOP, id, {
      reason: 'user_skipped',
      atDevice: 3_000,
      eventId: 'm1',
    });
    await open(store, id);
    expect(await screen.findByText('Bước video mở kiện đã xong.')).toBeOnTheScreen();
    expect(mockRecorder.mounted).toBe(false);
    await fireEvent.press(screen.getByTestId('return-video-continue'));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id });
  });

  it('kiện đã mở trước khi quay: vẫn quay được nhưng nói rõ chỉ ghi tình trạng hiện tại; hạn chế bằng chứng KHÔNG mất', async () => {
    const store = createMemoryReturnStore();
    const id = await seedOpening(store, true);
    await open(store, id);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    expect(screen.getByText(/chỉ ghi lại tình trạng hiện tại/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const saved = await store.getReturn(SHOP, id);
    expect(saved?.returnCase.openingVideo?.kind).toBe('recorded');
    expect(hasOpeningEvidenceLimit(saved?.returnCase ?? ({} as never))).toBe(true);
  });

  it('chưa ghi tình trạng bên ngoài: quay về bước đó, không mở camera', async () => {
    const store = createMemoryReturnStore();
    const id = `ret-x` as ReturnCaseId;
    await store.createReturn({
      id,
      shopId: SHOP,
      atDevice: 1,
      eventId: 'e',
      observedCode: null,
      link: null,
      lines: [],
    });
    await open(store, id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnExterior, { returnId: id }),
    );
    expect(mockRecorder.mounted).toBe(false);
  });
});
