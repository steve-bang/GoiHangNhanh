import { act, fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { ScanScreen } from './ScanScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
const mockOpenAppSettings = jest.fn();
jest.mock('@/platform/external-link', () => ({
  openExternalLink: jest.fn(),
  openAppSettings: (...args: unknown[]) => mockOpenAppSettings(...args),
}));

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  mockOpenAppSettings.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('UI-B02 Quét mã đơn hàng', () => {
  it('có đủ thành phần theo mẫu: hướng dẫn, nhập tay, mẹo, trợ giúp', async () => {
    await renderWithProviders(<ScanScreen />);
    expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
    expect(screen.getByText('Quét mã đơn hàng')).toBeOnTheScreen();
    expect(
      screen.getByText('Đưa mã QR / mã vạch vào khung hình để quét tự động'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nhập mã đơn thủ công')).toBeOnTheScreen();
    expect(screen.getByText('Mẹo nhỏ cho bạn')).toBeOnTheScreen();
    expect(screen.getByText('Nếu không quét được, hãy nhập tay nhé!')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Trợ giúp quét mã' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.help);
  });

  it('quét được mã thì tự tra cứu (sang tạo đơn nhanh) và hiện mã vừa quét, không cần bấm Tìm', async () => {
    await renderWithProviders(<ScanScreen />);
    await act(async () => mockScanner.emit('SPX123456'));
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.quickOrder, { code: 'SPX123456' });
    expect(screen.getByText('Vừa quét: SPX123456')).toBeOnTheScreen();
  });

  it('chống quét lặp: camera đọc liên tục cùng một mã chỉ điều hướng một lần', async () => {
    await renderWithProviders(<ScanScreen />);
    await act(async () => {
      mockScanner.emit('SPX123456');
      mockScanner.emit('SPX123456');
      mockScanner.emit('SPX123456');
    });
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
  });

  it('sau khoảng chống lặp, quét mã khác (quay lại màn quét) vẫn hoạt động', async () => {
    await renderWithProviders(<ScanScreen />);
    await act(async () => mockScanner.emit('A-1'));
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    await act(async () => mockScanner.emit('B-2'));
    expect(mockNavigation.push).toHaveBeenCalledTimes(2);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.quickOrder, { code: 'B-2' });
  });

  it('nhập tay: nút Tra cứu bị khóa khi trống, nhập mã rồi sang tạo đơn nhanh', async () => {
    await renderWithProviders(<ScanScreen />);
    await fireEvent.press(screen.getByTestId('scan-manual-open'));
    expect(screen.getByTestId('scan-manual-lookup')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('scan-manual-code'), '  ab-12 ');
    await fireEvent.press(screen.getByTestId('scan-manual-lookup'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.quickOrder, { code: 'ab-12' });
  });

  it('nhập tay có lối tìm đơn đã lưu', async () => {
    await renderWithProviders(<ScanScreen />);
    await fireEvent.press(screen.getByTestId('scan-manual-open'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tìm đơn đã lưu' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.search);
  });

  it('đèn pin bật/tắt được khi camera sẵn sàng', async () => {
    await renderWithProviders(<ScanScreen />);
    expect(mockScanner.torch).toBe(false);
    await fireEvent.press(screen.getByTestId('scan-torch'));
    expect(mockScanner.torch).toBe(true);
    await fireEvent.press(screen.getByTestId('scan-torch'));
    expect(mockScanner.torch).toBe(false);
  });

  it('chưa cấp quyền: hiện nút xin quyền, vẫn nhập tay được, không có camera', async () => {
    mockScanner.permission = 'askable';
    await renderWithProviders(<ScanScreen />);
    expect(screen.queryByTestId('scan-camera')).toBeNull();
    expect(screen.getByText('Cần dùng camera để quét mã')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cho phép camera' }));
    expect(mockScanner.request).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Nhập mã đơn thủ công')).toBeOnTheScreen();
  });

  it('bị từ chối hẳn: nút mở Cài đặt của hệ điều hành', async () => {
    mockScanner.permission = 'blocked';
    await renderWithProviders(<ScanScreen />);
    expect(screen.getByText('Camera đang bị tắt')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở Cài đặt' }));
    expect(mockOpenAppSettings).toHaveBeenCalledTimes(1);
  });

  it('camera không mở được: báo ngắn gọn và vẫn nhập tay được', async () => {
    await renderWithProviders(<ScanScreen />);
    await act(async () => mockScanner.onError?.());
    expect(screen.getByText('Không mở được camera')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-camera')).toBeNull();
    expect(screen.getByText('Nhập mã đơn thủ công')).toBeOnTheScreen();
  });

  it('màn khác phủ lên (mất focus) thì tắt camera, không quét ngầm', async () => {
    mockNavigation.screenActive = false;
    await renderWithProviders(<ScanScreen />);
    expect(screen.queryByTestId('scan-camera')).toBeNull();
  });

  it('nút quay lại gọi back', async () => {
    await renderWithProviders(<ScanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });
});
