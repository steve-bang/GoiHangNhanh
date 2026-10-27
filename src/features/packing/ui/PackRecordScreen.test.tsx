import { StyleSheet } from 'react-native';
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
  it('lấy mã đơn và kiện từ phiên (theo sessionId), hiện huy hiệu Xem trước, hướng dẫn, nút Dừng quay', async () => {
    await renderWithSession(Date.now() - 28_000);
    expect(await screen.findByText('DH1234567890')).toBeOnTheScreen();
    expect(screen.getByText('Kiện 1')).toBeOnTheScreen();
    expect(screen.getByText('Xem trước')).toBeOnTheScreen();
    expect(screen.getByText(/Quay toàn bộ quá trình đóng gói/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
  });

  it('chưa ghi thật: KHÔNG có "Đang quay", chấm đỏ hay đồng hồ chạy; trình đọc màn hình nghe "chưa ghi video"', async () => {
    await renderWithSession(Date.now() - 28_000);
    await screen.findByText('Xem trước');
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(screen.queryByTestId('recording-dot')).toBeNull();
    expect(screen.queryByText(/^\d\d:\d\d$/)).toBeNull();
    expect(screen.queryByLabelText(/Đang quay/)).toBeNull();
    expect(screen.getByLabelText('Xem trước, Bản thử giao diện: chưa ghi video')).toBeOnTheScreen();
  });

  it('mã đơn dài: cỡ chữ cố định >= 12sp, cắt giữa, không co chữ, đọc đủ mã qua nhãn trợ năng', async () => {
    const longCode = 'DH-2026-1027-ABCDEFGHIJKLMNOP-0001';
    const store = createMemoryOrderStore();
    const details = sampleOrder();
    await seedOrder(store, { ...details, order: { ...details.order, orderCode: longCode } });
    const session = sampleSession({ ...details, order: { ...details.order, orderCode: longCode } });
    await store.saveSession(session);
    mockNavigation.params = { sessionId: session.id };
    await renderWithProviders(<PackRecordScreen />, { orderStore: store });
    const code = await screen.findByLabelText(longCode);
    expect(code.props.ellipsizeMode).toBe('middle');
    expect(code.props.numberOfLines).toBe(1);
    expect(code.props.adjustsFontSizeToFit).toBeFalsy();
    expect(code.props.minimumFontScale).toBeUndefined();
    expect(StyleSheet.flatten(code.props.style).fontSize).toBeGreaterThanOrEqual(12);
    expect(code.props.allowFontScaling).not.toBe(false);
  });

  it('nút dừng chỉ có nhãn trợ năng, không có chữ "Dừng quay" hiển thị dưới nút', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
    expect(screen.queryByText('Dừng quay')).toBeNull();
    expect(screen.getByTestId('recording-stop')).toBeOnTheScreen();
  });

  it('luôn kèm dải "chưa ghi video" khi chưa có bộ ghi thật (không nói dối Đang quay)', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
    expect(screen.getByTestId('recording-notice')).toBeOnTheScreen();
    expect(screen.getByText('Bản thử giao diện: chưa ghi video')).toBeOnTheScreen();
  });

  it('xem trước camera khi có quyền; đèn pin bật/tắt được; không có nút thư viện ảnh hay chụp ảnh (O-02)', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
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
    await screen.findByText('Xem trước');
    expect(screen.queryByTestId('record-camera')).toBeNull();
    expect(screen.getByText(/Không mở được camera/)).toBeOnTheScreen();
    expect(screen.queryByTestId('recording-torch')).toBeNull();
  });

  it('camera báo lỗi mở thì thôi hiện xem trước và báo rõ', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
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
    await screen.findByText('Xem trước');
    expect(mockNavigation.leaveGuardEnabled).toBe(true);
  });

  it('bấm X hiện hộp thoại cảnh báo với nhãn nút cụ thể; "Giữ video và quay lại" ở lại màn', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
    expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kết thúc phiên' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ở lại màn quay' }));
    expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockNavigation.allowLeave).not.toHaveBeenCalled();
  });

  it('cố rời bằng Back/cử chỉ (onAttempt) cũng hiện hộp thoại', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
  });

  it('hộp thoại rời màn khi chưa ghi không nói "phần đã ghi"/"giữ video"', async () => {
    await renderWithSession();
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    expect(screen.getByText(/Phiên này chưa ghi video/)).toBeOnTheScreen();
    expect(screen.queryByText(/Phần đã ghi/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Ở lại màn quay' })).toBeOnTheScreen();
  });

  it('chưa ghi: "Kết thúc phiên" quay về Xác nhận đơn (theo orderId của phiên) kèm thông báo, KHÔNG sang màn "đã lưu"', async () => {
    const { session } = await renderWithSession();
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(mockNavigation.allowLeave).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
      notice: 'not_recorded',
    });
    expect(mockNavigation.replace).not.toHaveBeenCalledWith(ROUTES.packConfirm, expect.anything());
  });

  it('chưa ghi: nút Dừng quay cũng quay về Xác nhận đơn, không truyền mã đơn qua tham số', async () => {
    const { session } = await renderWithSession();
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
      notice: 'not_recorded',
    });
    const params = mockNavigation.replace.mock.calls[0]?.[1] as Record<string, string>;
    expect(Object.values(params)).not.toContain('DH1234567890');
  });
});
