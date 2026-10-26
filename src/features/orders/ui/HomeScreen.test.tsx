import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { HomeScreen } from './HomeScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

describe('UI-B01 Tổng quan', () => {
  it('có hai nút lớn Đóng gói đơn và Nhận hàng hoàn dẫn đúng route', async () => {
    await renderWithProviders(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('home-pack-order'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.scan);
    await fireEvent.press(screen.getByTestId('home-receive-return'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnFindOrder);
  });

  it('có đơn gần đây và việc cần xử lý, ghi rõ dữ liệu minh họa', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText('Đơn gần đây')).toBeOnTheScreen();
    expect(screen.getByText('Việc cần xử lý')).toBeOnTheScreen();
    expect(screen.getByText(/Dữ liệu minh họa/)).toBeOnTheScreen();
  });

  it('không có biểu đồ doanh thu, banner quảng bá hay nhãn mơ hồ của mockup', async () => {
    await renderWithProviders(<HomeScreen />);
    for (const banned of [/doanh thu/i, /lợi nhuận/i, /Đơn đã xử lý/, /Đã đồng bộ/, /uy tín/i]) {
      expect(screen.queryByText(banned)).toBeNull();
    }
  });

  it('khối đồng bộ dùng nhãn trạng thái chuẩn, không hứa tự hoàn tất', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getAllByText('Lỗi – cần xử lý').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tải nền có thể tạm dừng/)).toBeOnTheScreen();
  });

  it('menu tài khoản mở bottom sheet với hồ sơ, cài đặt, gói, trợ giúp (không phải tab)', async () => {
    await renderWithProviders(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('account-menu-button'));
    for (const label of ['Hồ sơ tài khoản', 'Cài đặt shop', 'Gói dịch vụ', 'Trợ giúp']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByText('Gói dịch vụ'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.plan);
  });
});
