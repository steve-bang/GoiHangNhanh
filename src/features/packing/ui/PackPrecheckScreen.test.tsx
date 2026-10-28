import { act, fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore } from '@/features/orders';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { MIN_FREE_BYTES_TO_RECORD } from '../domain';
import { PackPrecheckScreen } from './PackPrecheckScreen';

let mockEnabled = true;
jest.mock('@/core/config/recorder', () => ({
  get RECORDER_ENABLED() {
    return mockEnabled;
  },
}));
jest.mock('../domain/recorder', () => ({
  get RECORDER_ENABLED() {
    return mockEnabled;
  },
}));
jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
let mockFree: number | null = MIN_FREE_BYTES_TO_RECORD + 1;
let mockWritable = true;
const mockProbe = jest.fn(() => mockWritable);
jest.mock('@/platform/recording-files', () => ({
  getAvailableDiskBytes: () => mockFree,
  probeEvidenceDirWritable: () => mockProbe(),
  persistRecording: jest.fn(),
  recordingExists: jest.fn(),
  findPersistedRecording: jest.fn(),
  resolveRecordingUri: (uri: string) => uri,
}));
let mockDevice: { batteryLevel: number | null; charging: boolean | null; thermal: string | null } =
  {
    batteryLevel: 0.8,
    charging: false,
    thermal: null,
  };
jest.mock('@/platform/device-condition', () => ({
  readDeviceCondition: () =>
    mockDeviceHang ? new Promise(() => undefined) : Promise.resolve(mockDevice),
  UNKNOWN_DEVICE_CONDITION: { batteryLevel: null, charging: null, thermal: null },
}));
let mockDeviceHang = false;
const mockOpenSettings = jest.fn();
jest.mock('@/platform/external-link', () => ({
  openExternalLink: jest.fn(),
  openAppSettings: (...args: unknown[]) => mockOpenSettings(...args),
}));

beforeEach(() => {
  mockEnabled = true;
  mockFree = MIN_FREE_BYTES_TO_RECORD + 1;
  mockWritable = true;
  mockDevice = { batteryLevel: 0.8, charging: false, thermal: null };
  mockDeviceHang = false;
  mockProbe.mockClear();
  mockOpenSettings.mockReset();
  resetMockNavigation();
  resetMockScanner();
});

async function open(status: 'created' | 'recording' = 'created') {
  const orders = createMemoryOrderStore();
  const details = await seedOrder(orders, sampleOrder());
  const session = sampleSession(details, Date.now());
  await orders.saveSession(session);
  if (status !== 'created') await orders.updateSessionStatus(session.shopId, session.id, status);
  mockNavigation.params = { sessionId: session.id };
  await renderWithProviders(<PackPrecheckScreen />, { orderStore: orders });
  await act(async () => undefined);
  return session;
}

describe('UI-C02 Kiểm tra trước khi quay', () => {
  it('đạt hết: chạy ngầm, chuyển thẳng sang quay bằng sessionId, không hiện lỗi', async () => {
    const session = await open();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
    expect(screen.queryByTestId('precheck-issue-camera')).toBeNull();
    expect(screen.queryByText('Cần xử lý trước khi quay.')).toBeNull();
  });

  it('quyền camera đang kiểm: chờ, chưa chuyển cũng chưa báo lỗi', async () => {
    mockScanner.permission = 'checking';
    await open();
    expect(await screen.findByText('Đang kiểm tra máy…')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('chưa có quyền camera (có thể xin): nói đúng, có nút Cấp quyền, KHÔNG chuyển sang quay', async () => {
    mockScanner.permission = 'askable';
    await open();
    expect(await screen.findByTestId('precheck-issue-camera')).toBeOnTheScreen();
    expect(
      screen.getByText('Ứng dụng chưa có quyền camera. Hãy cấp quyền để ghi hình.'),
    ).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalledWith(ROUTES.packRecord, expect.anything());
    await fireEvent.press(screen.getByRole('button', { name: 'Cấp quyền camera' }));
    expect(mockScanner.request).toHaveBeenCalled();
  });

  it('quyền bị chặn hẳn: nút Mở Cài đặt', async () => {
    mockScanner.permission = 'blocked';
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Mở Cài đặt' }));
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('thiếu dung lượng: báo INSUFFICIENT_STORAGE kèm cách khắc phục; giải phóng rồi Kiểm tra lại thì vào quay', async () => {
    mockFree = MIN_FREE_BYTES_TO_RECORD - 1;
    const session = await open();
    expect(await screen.findByTestId('precheck-issue-storage')).toBeOnTheScreen();
    expect(screen.getByText(/Hãy giải phóng dung lượng rồi kiểm tra lại/)).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    mockFree = MIN_FREE_BYTES_TO_RECORD + 10;
    await fireEvent.press(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
  });

  it('không ghi được vào nơi lưu: LOCAL_SAVE_UNAVAILABLE, chặn quay', async () => {
    mockWritable = false;
    await open();
    expect(await screen.findByTestId('precheck-issue-localWrite')).toBeOnTheScreen();
    expect(
      screen.getByText('Không thể chuẩn bị nơi lưu video. Chưa bắt đầu ghi hình.'),
    ).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('nhiều điều kiện không đạt: liệt kê hết; Về đơn hàng không mất dữ liệu (về đơn của phiên)', async () => {
    mockScanner.permission = 'askable';
    mockFree = 1;
    mockWritable = false;
    const session = await open();
    for (const id of ['camera', 'storage', 'localWrite']) {
      expect(await screen.findByTestId(`precheck-issue-${id}`)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Về đơn hàng' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
    });
  });

  it('không đọc được dung lượng: không chặn', async () => {
    mockFree = null;
    const session = await open();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
  });

  it('phiên đã qua created: mở thẳng màn quay để màn đó nói đúng tình trạng, không đo máy', async () => {
    mockFree = 1;
    const session = await open('recording');
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
    expect(mockProbe).not.toHaveBeenCalled();
  });

  it('không có phiên (mã sai/liên kết sâu): báo không mở được, không chuyển', async () => {
    mockNavigation.params = { sessionId: 'khong-co' };
    await renderWithProviders(<PackPrecheckScreen />);
    expect(await screen.findByText('Không mở được phiên quay này.')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockProbe).not.toHaveBeenCalled();
  });

  it('bộ ghi tắt: không kiểm tra, không chuyển, nói chưa ghi video', async () => {
    mockEnabled = false;
    await open();
    expect(await screen.findByTestId('pack-not-recorded')).toBeOnTheScreen();
    expect(mockProbe).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('pin thấp khi không sạc: báo BATTERY_LOW kèm lời khuyên cắm sạc, chặn quay; cắm sạc rồi Kiểm tra lại thì vào quay', async () => {
    mockDevice = { batteryLevel: 0.05, charging: false, thermal: null };
    const session = await open();
    expect(await screen.findByTestId('precheck-issue-battery')).toBeOnTheScreen();
    expect(
      screen.getByText('Pin còn quá thấp để quay an toàn. Hãy cắm sạc rồi kiểm tra lại.'),
    ).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    mockDevice = { batteryLevel: 0.05, charging: true, thermal: null };
    await fireEvent.press(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    await act(async () => undefined);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
  });

  it('máy quá nóng (khi hệ điều hành báo): báo DEVICE_OVERHEATED, chặn quay', async () => {
    mockDevice = { batteryLevel: 0.9, charging: false, thermal: 'serious' };
    await open();
    expect(await screen.findByTestId('precheck-issue-thermal')).toBeOnTheScreen();
    expect(
      screen.getByText('Máy đang quá nóng để quay an toàn. Hãy để máy nguội rồi kiểm tra lại.'),
    ).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('không biết pin/nhiệt độ: không chặn', async () => {
    mockDevice = { batteryLevel: null, charging: null, thermal: null };
    const session = await open();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
  });

  it('thăm dò ghi tệp chạy trong effect, mỗi lượt đúng một lần (Kiểm tra lại = lượt mới), không chạy lại khi render lại', async () => {
    mockFree = MIN_FREE_BYTES_TO_RECORD - 1;
    await open();
    expect(await screen.findByTestId('precheck-issue-storage')).toBeOnTheScreen();
    expect(mockProbe).toHaveBeenCalledTimes(1);
    mockScanner.permission = 'askable';
    await fireEvent.press(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    await act(async () => undefined);
    expect(mockProbe).toHaveBeenCalledTimes(2);
  });

  describe('đọc pin treo', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] }));
    afterEach(() => jest.useRealTimers());

    it('treo: lúc đầu "Đang kiểm tra máy…", quá 3 giây coi là không biết (không chặn) và vào quay', async () => {
      mockDeviceHang = true;
      const session = await open();
      expect(screen.getByText('Đang kiểm tra máy…')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(2900);
      });
      expect(mockNavigation.replace).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
        sessionId: session.id,
      });
    });

    it('treo nhưng thiếu dung lượng: sau 3 giây vẫn chặn vì lý do dung lượng', async () => {
      mockDeviceHang = true;
      mockFree = 1;
      await open();
      await act(async () => {
        jest.advanceTimersByTime(3100);
      });
      expect(screen.getByTestId('precheck-issue-storage')).toBeOnTheScreen();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
    });
  });
});
