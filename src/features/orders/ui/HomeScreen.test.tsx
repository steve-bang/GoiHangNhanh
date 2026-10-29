import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget } from '@/platform';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { HomeScreen } from './HomeScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

describe('UI-B01 Trang chủ (mẫu thiết kế, D-16)', () => {
  it('đầu trang có tên shop, lời chào và chuông thông báo dẫn tới tab Thông báo', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText('Shop minh họa')).toBeOnTheScreen();
    expect(screen.getByText('Chào mừng trở lại!')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-notifications'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.notificationList);
  });

  it('có hai nút lớn Đóng gói đơn và Nhận hàng hoàn dẫn đúng route', async () => {
    await renderWithProviders(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('home-pack-order'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.scan);
    await fireEvent.press(screen.getByTestId('home-receive-return'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnFindOrder);
  });

  it('có liên kết Danh sách hàng hoàn dẫn tới UI-D01, vùng chạm đủ lớn', async () => {
    await renderWithProviders(<HomeScreen />);
    const link = screen.getByTestId('home-returns-list');
    expect(screen.getByText('Danh sách hàng hoàn')).toBeOnTheScreen();
    expect(link).toHaveStyle({ minHeight: getMinTouchTarget() });
    await fireEvent.press(link);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returns);
  });

  it('có 3 lối tắt: Tạo đơn nhanh, Danh sách đơn, Bằng chứng (Quét đã có ở nút giữa và thẻ chính)', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.queryByTestId('home-quick-scan')).toBeNull();
    const cases: [string, unknown][] = [
      ['home-quick-order', ROUTES.quickOrder],
      ['home-quick-orders', ROUTES.orders],
      ['home-quick-evidence', ROUTES.sync],
    ];
    for (const [id, route] of cases) {
      await fireEvent.press(screen.getByTestId(id));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(route);
    }
  });

  it('thống kê hôm nay dùng nhãn trạng thái chuẩn và dẫn tới màn tương ứng', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText('Thống kê hôm nay')).toBeOnTheScreen();
    expect(screen.getByText('Đơn đã đóng gói')).toBeOnTheScreen();
    expect(screen.getByText('Đã tải lên')).toBeOnTheScreen();
    expect(screen.getByText('Lỗi – cần xử lý')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-stat-error'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.sync);
    await fireEvent.press(screen.getByTestId('home-stat-packed'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orders);
    await fireEvent.press(screen.getByTestId('home-today-detail'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.sync);
  });

  it('hàng hướng dẫn mở Trợ giúp; ghi rõ dữ liệu minh họa; không còn banner trang trí', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.queryByTestId('home-banner')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-tip-guide'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.help);
    expect(screen.getByText(/Dữ liệu minh họa/)).toBeOnTheScreen();
  });

  it('không có biểu đồ doanh thu và không có lời hứa quá mức hay nhãn mơ hồ của mockup', async () => {
    await renderWithProviders(<HomeScreen />);
    const banned = [
      /doanh thu/i,
      /lợi nhuận/i,
      /Đơn đã xử lý/,
      /Đã đồng bộ/,
      /Lỗi đồng bộ/,
      /uy tín/i,
      /tuyệt đối/i,
      /chống giả mạo/i,
      /quyền lợi/i,
      /pháp lý/i,
    ];
    for (const pattern of banned) {
      expect(screen.queryByText(pattern)).toBeNull();
    }
  });
});
