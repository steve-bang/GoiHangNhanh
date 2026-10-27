import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { ReturnRecordScreen } from './ReturnRecordScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

describe('UI-D04 Quay video mở kiện (dùng chung khung quay)', () => {
  it('chưa ghi video thật: huy hiệu "Xem trước", không "Đang quay", không chấm đỏ, không đồng hồ', async () => {
    await renderWithProviders(<ReturnRecordScreen />);
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(screen.queryByTestId('recording-dot')).toBeNull();
    expect(screen.queryByText('00:00')).toBeNull();
    expect(screen.getByText('Hồ sơ hoàn')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
  });

  it('có dải "chưa ghi video" như UI-C03', async () => {
    await renderWithProviders(<ReturnRecordScreen />);
    expect(await screen.findByTestId('recording-notice')).toBeOnTheScreen();
    expect(screen.getByText('Bản thử giao diện: chưa ghi video')).toBeOnTheScreen();
  });

  it('rời màn khi chưa ghi: hộp thoại nói đúng đích (kiểm tra hàng), "Kết thúc phiên" tới returnItems', async () => {
    await renderWithProviders(<ReturnRecordScreen />);
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    expect(screen.getByText(/sang bước kiểm tra hàng/)).toBeOnTheScreen();
    expect(screen.queryByText(/màn hình đơn/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems);
  });
});
