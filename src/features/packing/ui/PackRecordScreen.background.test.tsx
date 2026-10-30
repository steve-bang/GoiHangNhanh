import { act, fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import {
  LOCAL_SHOP_ID,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
} from '@/features/orders';
import {
  appStateListenerCount,
  emitAppState,
  resetMockAppState,
} from '@/test-utils/mock-app-state';
import { mockRecorder, resetMockRecorder } from '@/test-utils/mock-camera-recorder';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockKeepAwake, resetMockKeepAwake } from '@/test-utils/mock-keep-awake';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { PackConfirmScreen } from './PackConfirmScreen';
import { PackRecordScreen } from './PackRecordScreen';

// V1-11: giữ màn hình sáng, xử lý app vào nền khi đang quay (bộ ghi thật bật, camera mock).
jest.mock('../domain/recorder', () => ({ RECORDER_ENABLED: true }));
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
  recordingExists: () => true,
  getAvailableDiskBytes: () => 10 * 1024 * 1024 * 1024,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: (...args: unknown[]) => mockHash(...args),
}));

const STOPPED_TOAST = 'Đã dừng quay vì ứng dụng chuyển sang nền. Ứng dụng không tự quay tiếp.';

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  resetMockRecorder();
  resetMockKeepAwake();
  resetMockAppState();
  mockPersist.mockReset().mockReturnValue({
    ok: true,
    uri: 'file:///docs/evidence/x.mp4',
    sizeBytes: 4096,
  });
  mockHash.mockReset().mockResolvedValue({ ok: true, sha256: 'cd'.repeat(32), sizeBytes: 4096 });
});

async function setup() {
  const orders = createMemoryOrderStore();
  const files = createMemoryEvidenceFileStore();
  const details = await seedOrder(orders, sampleOrder());
  const session = sampleSession(details, Date.now());
  await orders.saveSession(session);
  mockNavigation.params = { sessionId: session.id };
  const view = await renderWithProviders(<PackRecordScreen />, {
    orderStore: orders,
    evidenceFileStore: files,
  });
  return { session, files, orders, view };
}

async function startRecording() {
  const t = await setup();
  await act(async () => mockRecorder.signalReady());
  await screen.findByText('Đang quay');
  return t;
}

const statusOf = async (t: Awaited<ReturnType<typeof setup>>) =>
  (await t.orders.getSession(LOCAL_SHOP_ID, t.session.id))?.sessionStatus;

describe('UI-C03 giữ màn hình sáng (V1-11)', () => {
  it('bật đúng một lần từ lúc chuẩn bị, giữ qua lúc quay và lưu; tắt khi lưu xong rời màn', async () => {
    const { view } = await setup();
    expect(mockKeepAwake.activations).toBe(1);
    expect(mockKeepAwake.activeCount()).toBe(1);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    expect(mockKeepAwake.activations).toBe(1); // không bật lại khi đổi pha
    expect(mockKeepAwake.activeCount()).toBe(1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await act(async () => view.unmount());
    expect(mockKeepAwake.activeCount()).toBe(0);
    expect(mockKeepAwake.deactivations).toBe(1);
  });

  it('lỗi (camera dừng đột ngột): tắt giữ sáng ngay trên màn lỗi', async () => {
    await startRecording();
    await act(async () => mockRecorder.finish({ ok: false, reason: 'RECORDER_FAILED' }));
    await screen.findByText('Camera dừng đột ngột. Video chưa được lưu.');
    expect(mockKeepAwake.activeCount()).toBe(0);
  });

  it('dòng giới hạn Q-24b hiện dưới nút dừng', async () => {
    await setup();
    expect(screen.getByTestId('recording-footnote')).toHaveTextContent(
      'Giữ ứng dụng mở trong lúc quay. Nếu ứng dụng bị tắt, đoạn đang quay có thể mất.',
    );
  });
});

describe('UI-C03 app vào nền khi đang quay (V1-11)', () => {
  it('dừng đúng một lần qua đường lưu sẵn có, phiên interrupted, tệp vẫn của đúng phiên/kiện; quay lại thì báo', async () => {
    const t = await startRecording();
    await act(async () => emitAppState('background'));
    expect(mockRecorder.stopCalls).toBe(1);
    expect(
      screen.getByText('Đã dừng quay vì ứng dụng chuyển sang nền. Đang lưu phần đã quay…'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dừng quay' })).toBeNull();
    await act(async () => emitAppState('background')); // lần hai: không dừng lại
    expect(mockRecorder.stopCalls).toBe(1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await act(async () => undefined);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: t.session.id,
    });
    expect(await statusOf(t)).toBe('interrupted');
    const files = await t.files.listBySession(LOCAL_SHOP_ID, t.session.id);
    expect(files).toHaveLength(1); // không ghép, không tệp thứ hai
    expect(files[0]).toMatchObject({
      state: 'queued',
      sessionId: t.session.id,
      packageId: t.session.packageId,
    });
    expect(screen.queryByText(STOPPED_TOAST)).toBeNull();
    await act(async () => emitAppState('active'));
    expect(await screen.findByText(STOPPED_TOAST)).toBeOnTheScreen();
    expect(mockRecorder.recordCalls).toBe(1); // không tự quay tiếp
  });

  it('iOS inactive (Trung tâm điều khiển, hộp thoại hệ thống): KHÔNG dừng quay', async () => {
    await startRecording();
    await act(async () => emitAppState('inactive'));
    await act(async () => emitAppState('active'));
    expect(mockRecorder.stopCalls).toBe(0);
    expect(screen.getByText('Đang quay')).toBeOnTheScreen();
  });

  it('vào nền khi chưa bắt đầu ghi: không làm gì (chưa có tệp/phiên recording)', async () => {
    const t = await setup();
    await act(async () => emitAppState('background'));
    expect(mockRecorder.stopCalls).toBe(0);
    expect(await statusOf(t)).toBe('created');
    expect(await t.files.listBySession(LOCAL_SHOP_ID, t.session.id)).toEqual([]);
  });

  it('người dùng đã bấm dừng rồi mới vào nền (đang lưu): phiên ended như thường, không báo dừng vì nền', async () => {
    const t = await startRecording();
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await act(async () => emitAppState('background'));
    expect(mockRecorder.stopCalls).toBe(1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await act(async () => undefined);
    expect(await statusOf(t)).toBe('ended');
    await act(async () => emitAppState('active'));
    expect(screen.queryByText(STOPPED_TOAST)).toBeNull();
  });

  it('camera tự dừng sớm (hệ thống ngắt) mà không ai yêu cầu: phiên interrupted', async () => {
    const t = await startRecording();
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await act(async () => undefined);
    expect(await statusOf(t)).toBe('interrupted');
  });

  it('màn đã gỡ thì hủy đăng ký: vào nền sau đó không dừng lần nữa', async () => {
    const { view } = await startRecording();
    expect(appStateListenerCount()).toBeGreaterThan(0);
    await act(async () => view.unmount());
    expect(mockRecorder.stopCalls).toBe(1); // dừng do gỡ màn (đường cũ)
    expect(appStateListenerCount()).toBe(0);
    await act(async () => emitAppState('background'));
    expect(mockRecorder.stopCalls).toBe(1);
  });
});

describe('UI-C04 phiên bị gián đoạn (V1-11)', () => {
  it('nói video có thể thiếu phần sau, vẫn cho lưu bằng chứng', async () => {
    const t = await startRecording();
    await act(async () => emitAppState('background'));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await act(async () => undefined);
    await act(async () => t.view.unmount());
    await renderWithProviders(<PackConfirmScreen />, {
      orderStore: t.orders,
      evidenceFileStore: t.files,
    });
    expect(await screen.findByTestId('confirm-interrupted')).toHaveTextContent(
      'Lần quay bị gián đoạn giữa chừng. Video có thể thiếu phần sau.',
    );
    expect(screen.getByText('Đã lưu trên máy')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lưu bằng chứng' })).toBeEnabled();
  });
});
