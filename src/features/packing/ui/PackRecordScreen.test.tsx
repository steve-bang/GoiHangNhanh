import { act, fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { PackRecordScreen } from './PackRecordScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => {
  resetMockNavigation();
  mockNavigation.params = { code: 'DEMO-0001', package: '2' };
});

describe('UI-C03 màn quay đóng gói (khung)', () => {
  it('hiện mã đơn, kiện, đồng hồ, hướng dẫn và nút Dừng quay', async () => {
    await renderWithProviders(<PackRecordScreen />);
    expect(screen.getByText('DEMO-0001')).toBeOnTheScreen();
    expect(screen.getByText('Kiện 2')).toBeOnTheScreen();
    expect(screen.getByText('00:00')).toBeOnTheScreen();
    expect(screen.getByText(/niêm phong xong/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
  });

  it('không có thanh tab trong màn này và không có nút thư viện ảnh (O-02)', async () => {
    await renderWithProviders(<PackRecordScreen />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByLabelText(/thư viện/i)).toBeNull();
    expect(ROUTES.packRecord.tabBar).toBe(false);
  });

  it('luôn bật chặn rời màn (nút Back/cử chỉ đi qua cảnh báo)', async () => {
    await renderWithProviders(<PackRecordScreen />);
    expect(mockNavigation.leaveGuardEnabled).toBe(true);
  });

  it('bấm X hiện hộp thoại cảnh báo với nhãn nút cụ thể; "Giữ video và quay lại" ở lại màn', async () => {
    await renderWithProviders(<PackRecordScreen />);
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
    await renderWithProviders(<PackRecordScreen />);
    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
  });

  it('"Kết thúc phiên" mở chặn rồi chuyển sang Xác nhận video, không bỏ mất phiên', async () => {
    await renderWithProviders(<PackRecordScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(mockNavigation.allowLeave).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, { code: 'DEMO-0001' });
  });
});
