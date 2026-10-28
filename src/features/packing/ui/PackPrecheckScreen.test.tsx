import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore } from '@/features/orders';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import type { DeviceCondition } from '@/platform';

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
// Mỗi lần đọc máy lấy một phần tử của hàng đợi (nếu có) để test điều khiển thời điểm kết quả đến.
let mockDeviceReads: (() => Promise<unknown>)[] = [];
jest.mock('@/platform/device-condition', () => ({
  readDeviceCondition: () =>
    mockDeviceReads.shift()?.() ??
    (mockDeviceHang ? new Promise(() => undefined) : Promise.resolve(mockDevice)),
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
  mockDeviceReads = [];
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

describe('kết quả đo của lượt cũ đến muộn', () => {
  const OK: DeviceCondition = { batteryLevel: 0.8, charging: false, thermal: null };
  const LOW: DeviceCondition = { batteryLevel: 0.05, charging: false, thermal: null };
  /** Một lần đọc máy mà test tự quyết lúc nào trả. */
  function deferredRead() {
    let resolve: (value: DeviceCondition) => void = () => undefined;
    const promise = new Promise<DeviceCondition>((r) => (resolve = r));
    mockDeviceReads.push(() => promise);
    return (value: DeviceCondition) => resolve(value);
  }

  it('Kiểm tra lại: lượt mới chưa có kết quả thì KHÔNG dùng số liệu lượt trước (không còn màn lỗi cũ, không điều hướng); kết quả lượt mới mới được áp dụng', async () => {
    mockDevice = LOW;
    const session = await open();
    expect(await screen.findByTestId('precheck-issue-battery')).toBeOnTheScreen();
    const answer = deferredRead();
    mockDevice = OK;
    await fireEvent.press(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    await act(async () => undefined);
    // Lượt 1 đang đọc: không được dựng kết quả từ lượt 0 (vẫn là pin thấp).
    expect(screen.getByText('Đang kiểm tra máy…')).toBeOnTheScreen();
    expect(screen.queryByTestId('precheck-issue-battery')).toBeNull();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    await act(async () => answer(OK));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: session.id,
    });
  });

  it('đổi sang phiên khác trong lúc đang đọc: kết quả đọc của lượt bị hủy đến muộn KHÔNG áp dụng cho lượt đang chạy (không vào quay bằng số liệu cũ, không ghi đè kết quả mới)', async () => {
    const orders = createMemoryOrderStore();
    // Mỗi phiên một đơn/kiện riêng (mỗi kiện chỉ có một phiên đang hoạt động).
    const sessionOf = async (tag: string) => {
      const base = sampleOrder({ withLines: false });
      const orderId = `order-${tag}` as typeof base.order.id;
      const details = {
        order: { ...base.order, id: orderId, orderCode: `DH-${tag}` },
        lines: [],
        packages: base.packages.map((pkg) => ({ ...pkg, id: `pkg-${tag}` as never, orderId })),
      };
      await seedOrder(orders, details);
      const session = { ...sampleSession(details, Date.now()), id: `phien-${tag}` as never };
      await orders.saveSession(session);
      return session;
    };
    const sessionA = await sessionOf('a');
    const sessionB = await sessionOf('b');
    await orders.updateSessionStatus(sessionB.shopId, sessionB.id, 'recording'); // không còn `created`
    const sessionC = await sessionOf('c');

    let select: (id: string) => void = () => undefined;
    function Host() {
      const [id, setId] = useState(sessionA.id as string);
      select = (next) => {
        mockNavigation.params = { sessionId: next };
        setId(next);
      };
      return id ? <PackPrecheckScreen /> : null;
    }
    mockNavigation.params = { sessionId: sessionA.id };
    const staleRead = deferredRead(); // lượt của phiên A
    await renderWithProviders(<Host />, { orderStore: orders });
    await act(async () => undefined);
    expect(screen.getByText('Đang kiểm tra máy…')).toBeOnTheScreen();

    // Phiên B không còn `created`: màn thôi đo (hủy lượt của A) và chuyển thẳng sang quay.
    await act(async () => select(sessionB.id));
    await act(async () => undefined);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packRecord, {
      sessionId: sessionB.id,
    });
    mockNavigation.replace.mockClear();

    const toC = { sessionId: sessionC.id }; // (mock điều hướng đổi tham chiếu mỗi lần render nên lệnh sang B có thể lặp lại)
    // Phiên C là `created`: lượt đo mới (cùng số lượt 0) bắt đầu; pin lúc này thấp.
    const currentRead = deferredRead();
    await act(async () => select(sessionC.id));
    await act(async () => undefined);
    expect(screen.getByText('Đang kiểm tra máy…')).toBeOnTheScreen();

    // Kết quả "tốt" của lượt cũ (phiên A) đến muộn: phải bị bỏ, không được cho vào quay.
    await act(async () => staleRead(OK));
    expect(mockNavigation.replace).not.toHaveBeenCalledWith(ROUTES.packRecord, toC);
    expect(screen.getByText('Đang kiểm tra máy…')).toBeOnTheScreen();

    // Kết quả của lượt hiện tại (pin thấp) được áp dụng và chặn quay.
    await act(async () => currentRead(LOW));
    expect(await screen.findByTestId('precheck-issue-battery')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalledWith(ROUTES.packRecord, toC);
  });

  it('gỡ màn khi đang đọc: kết quả đến muộn không điều hướng và không gây lỗi', async () => {
    const answer = deferredRead();
    const orders = createMemoryOrderStore();
    const details = await seedOrder(orders, sampleOrder());
    const session = sampleSession(details, Date.now());
    await orders.saveSession(session);
    mockNavigation.params = { sessionId: session.id };
    const view = await renderWithProviders(<PackPrecheckScreen />, { orderStore: orders });
    await act(async () => undefined);
    await act(async () => view.unmount());
    await act(async () => answer(OK));
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });
});
