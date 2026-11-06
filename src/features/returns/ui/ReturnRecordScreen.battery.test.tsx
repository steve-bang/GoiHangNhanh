import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { LOCAL_SHOP_ID } from '@/features/orders';
import { mockRecorder, resetMockRecorder } from '@/test-utils/mock-camera-recorder';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import type { ReturnStore } from '../domain';
import { ReturnRecordScreen } from './ReturnRecordScreen';

// Cổng kiểm pin của UI-D04 (B04 dùng chung kiểm tra kỹ thuật A04): chặn TRƯỚC khi mở camera.
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
jest.mock('@/platform/recording-files', () => ({
  persistRecording: jest.fn(),
  resolveRecordingUri: (stored: string) => stored,
  recordingExists: () => true,
  getAvailableDiskBytes: () => 10 * 1024 * 1024 * 1024,
}));
jest.mock('@/platform/file-hasher', () => ({ HASH_CHUNK_BYTES: 1, hashFile: jest.fn() }));
let mockDevice: {
  batteryLevel: number | null;
  charging: boolean | null;
  thermal: string | null;
} = { batteryLevel: 0.8, charging: false, thermal: null };
let mockHang = false;
jest.mock('@/platform/device-condition', () => ({
  readDeviceCondition: () =>
    mockHang ? new Promise(() => undefined) : Promise.resolve(mockDevice),
  UNKNOWN_DEVICE_CONDITION: { batteryLevel: null, charging: null, thermal: null },
}));

const SHOP = LOCAL_SHOP_ID;

beforeEach(() => {
  mockDevice = { batteryLevel: 0.8, charging: false, thermal: null };
  mockHang = false;
  resetMockNavigation();
  resetMockScanner();
  resetMockRecorder();
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

async function open(store: ReturnStore, id: ReturnCaseId) {
  mockNavigation.params = { returnId: id };
  return renderWithProviders(<ReturnRecordScreen />, { returnStore: store });
}

describe('UI-D04 kiểm pin trước khi quay (B04 dùng chung A04)', () => {
  it('pin đủ: mở camera, không hiện cảnh báo', async () => {
    const store = createMemoryReturnStore();
    await open(store, await seedOpening(store));
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-device-issue-battery')).toBeNull();
  });

  it('pin thấp, không sạc: CHẶN trước khi mở camera, không tạo bản ghi video, hồ sơ giữ nguyên', async () => {
    mockDevice = { batteryLevel: 0.05, charging: false, thermal: null };
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    expect(await screen.findByTestId('return-device-issue-battery')).toBeOnTheScreen();
    expect(screen.getByText(/Pin còn quá thấp/)).toBeOnTheScreen();
    expect(screen.queryByText('Xem trước')).toBeNull();
    expect(mockRecorder.recordCalls).toBe(0);
    expect(await store.listMedia(SHOP, id)).toEqual([]);
    expect((await store.getReturn(SHOP, id))?.returnCase.status).toBe('opening');
  });

  it('pin thấp nhưng đang cắm sạc: không chặn', async () => {
    mockDevice = { batteryLevel: 0.05, charging: true, thermal: null };
    const store = createMemoryReturnStore();
    await open(store, await seedOpening(store));
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
  });

  it('không đọc được pin: không chặn (không đoán)', async () => {
    mockDevice = { batteryLevel: null, charging: null, thermal: null };
    const store = createMemoryReturnStore();
    await open(store, await seedOpening(store));
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
  });

  it('máy quá nóng (khi có nguồn đo): chặn bằng DEVICE_OVERHEATED', async () => {
    mockDevice = { batteryLevel: 0.8, charging: false, thermal: 'critical' };
    const store = createMemoryReturnStore();
    await open(store, await seedOpening(store));
    expect(await screen.findByTestId('return-device-issue-thermal')).toBeOnTheScreen();
  });

  it('bị chặn: "Kiểm tra lại" sau khi cắm sạc thì cho quay', async () => {
    mockDevice = { batteryLevel: 0.05, charging: false, thermal: null };
    const store = createMemoryReturnStore();
    await open(store, await seedOpening(store));
    await screen.findByTestId('return-device-issue-battery');
    mockDevice = { batteryLevel: 0.05, charging: true, thermal: null };
    await fireEvent.press(screen.getByTestId('return-device-recheck'));
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-device-issue-battery')).toBeNull();
  });

  it('bị chặn: "Lưu tạm, quay sau" về danh sách, không ghi gì vào hồ sơ', async () => {
    mockDevice = { batteryLevel: 0.05, charging: false, thermal: null };
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await fireEvent.press(await screen.findByTestId('return-device-later'));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returns);
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toBeNull();
  });

  it('bị chặn: ghi nhận lý do chưa có video vẫn đi tiếp được, không ép hủy hồ sơ', async () => {
    mockDevice = { batteryLevel: 0.05, charging: false, thermal: null };
    const store = createMemoryReturnStore();
    const id = await seedOpening(store);
    await open(store, id);
    await fireEvent.press(await screen.findByTestId('return-device-note-reason'));
    await fireEvent.press(await screen.findByText('Máy hoặc camera gặp sự cố'));
    await fireEvent.press(screen.getByText('Tiếp tục không có video'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, { returnId: id }),
    );
    expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toMatchObject({
      reason: 'device_problem',
    });
  });

  it('đọc pin treo quá hạn: coi là không biết, không kẹt, không chặn', async () => {
    mockHang = true;
    const store = createMemoryReturnStore();
    await open(store, await seedOpening(store));
    expect(screen.getByTestId('return-device-checking')).toBeOnTheScreen();
    expect(await screen.findByText('Xem trước', {}, { timeout: 4500 })).toBeOnTheScreen();
  }, 10_000);
});
