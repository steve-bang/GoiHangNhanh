import { act, fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore } from '@/features/orders';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockPreview, resetMockPreview } from '@/test-utils/mock-camera-preview';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { PackRecordScreen } from './PackRecordScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
jest.mock(
  '@/platform/camera-preview',
  () => jest.requireActual('@/test-utils/mock-camera-preview').cameraPreviewMock,
);

async function renderWithSession(startedAtDevice = Date.now()) {
  const store = createMemoryOrderStore();
  const details = await seedOrder(store, sampleOrder());
  const session = sampleSession(details, startedAtDevice);
  await store.saveSession(session);
  mockNavigation.params = { sessionId: session.id };
  await renderWithProviders(<PackRecordScreen />, { orderStore: store });
  return { store, session };
}

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  resetMockPreview();
});

describe('UI-C03 màn quay đóng gói (bản thử giao diện)', () => {
  it('lấy mã đơn và kiện từ phiên (theo sessionId), hiện huy hiệu, đồng hồ, hướng dẫn, nút Dừng quay', async () => {
    await renderWithSession(Date.now() - 28_000);
    expect(await screen.findByText('DH1234567890')).toBeOnTheScreen();
    expect(screen.getByText('Kiện 1')).toBeOnTheScreen();
    expect(screen.getByText('Đang quay')).toBeOnTheScreen();
    expect(screen.getByText(/^00:2[89]$|^00:3[0-1]$/)).toBeOnTheScreen();
    expect(screen.getByText(/Quay toàn bộ quá trình đóng gói/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
  });

  it('nút dừng chỉ có nhãn trợ năng, không có chữ "Dừng quay" hiển thị dưới nút', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
    expect(screen.queryByText('Dừng quay')).toBeNull();
    expect(screen.getByTestId('recording-stop')).toBeOnTheScreen();
  });

  it('luôn kèm dải "chưa ghi video" khi chưa có bộ ghi thật (không nói dối Đang quay)', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    expect(screen.getByTestId('recording-notice')).toBeOnTheScreen();
    expect(screen.getByText('Bản thử giao diện: chưa ghi video')).toBeOnTheScreen();
  });

  it('xem trước camera khi có quyền; đèn pin bật/tắt được; không có nút thư viện ảnh hay chụp ảnh (O-02)', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    expect(screen.getByTestId('record-camera')).toBeOnTheScreen();
    expect(mockPreview.torch).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Bật đèn pin' }));
    expect(mockPreview.torch).toBe(true);
    expect(screen.queryByLabelText(/thư viện|chụp ảnh/i)).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(ROUTES.packRecord.tabBar).toBe(false);
  });

  it('chưa có quyền camera: không mở camera, báo rõ, không có nút đèn pin', async () => {
    mockScanner.permission = 'blocked';
    await renderWithSession();
    await screen.findByText('Đang quay');
    expect(screen.queryByTestId('record-camera')).toBeNull();
    expect(screen.getByText(/Không mở được camera/)).toBeOnTheScreen();
    expect(screen.queryByTestId('recording-torch')).toBeNull();
  });

  it('camera báo lỗi mở thì thôi hiện xem trước và báo rõ', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    await act(async () => mockPreview.onError?.());
    expect(screen.queryByTestId('record-camera')).toBeNull();
    expect(screen.getByText(/Không mở được camera/)).toBeOnTheScreen();
  });

  it('phiên không tồn tại: báo rõ và có đường quay lại, không hiện camera', async () => {
    mockNavigation.params = { sessionId: 'khong-co' };
    await renderWithProviders(<PackRecordScreen />);
    expect(await screen.findByText('Không mở được phiên quay này.')).toBeOnTheScreen();
    expect(screen.queryByTestId('record-camera')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalled();
  });

  it('không có sessionId (mở bằng mã đơn qua tham số cũ) thì không dùng mã đơn đó', async () => {
    mockNavigation.params = { code: 'DEMO-0001' };
    await renderWithProviders(<PackRecordScreen />);
    expect(await screen.findByText('Không mở được phiên quay này.')).toBeOnTheScreen();
    expect(screen.queryByText('DEMO-0001')).toBeNull();
  });

  it('luôn bật chặn rời màn (nút Back/cử chỉ đi qua cảnh báo)', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    expect(mockNavigation.leaveGuardEnabled).toBe(true);
  });

  it('bấm X hiện hộp thoại cảnh báo với nhãn nút cụ thể; "Giữ video và quay lại" ở lại màn', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kết thúc phiên' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Giữ video và quay lại' }));
    expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockNavigation.allowLeave).not.toHaveBeenCalled();
  });

  it('cố rời bằng Back/cử chỉ (onAttempt) cũng hiện hộp thoại', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
  });

  it('"Kết thúc phiên" mở chặn rồi chuyển sang Xác nhận video, không bỏ mất phiên', async () => {
    await renderWithSession();
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(mockNavigation.allowLeave).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      code: 'DH1234567890',
    });
  });
});
