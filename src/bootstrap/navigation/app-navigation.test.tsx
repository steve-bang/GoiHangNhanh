import { join } from 'node:path';

import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { ROUTES } from '@/core/navigation';

const APP_DIR = join(__dirname, '..', '..', 'app');
const TAB_LABELS = ['Tổng quan', 'Đơn hàng', 'Hàng hoàn', 'Đồng bộ'] as const;

function expectTabBarVisible(visible: boolean) {
  for (const label of TAB_LABELS) {
    const found = screen.queryAllByRole('button', { name: label });
    expect(found).toHaveLength(visible ? 1 : 0);
  }
}

/**
 * Chạy Expo Router thật trên thư mục `src/app` (trong bộ nhớ, không cần máy ảo): kiểm tra thanh tab
 * hiện ở Tổng quan, đủ 4 tab, và ẩn ở màn quay. Không thay thế kiểm thử trên thiết bị.
 */
describe('điều hướng thật (Expo Router, trong bộ nhớ)', () => {
  it('Tổng quan có thanh tab 4 mục theo D-11', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    expectTabBarVisible(true);
  });

  it('màn quay đóng gói không có thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: `${ROUTES.packRecord.path}?code=DEMO-0001` });
    expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
    expectTabBarVisible(false);
  });

  it('màn quay mở kiện hoàn không có thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.returnRecord.path });
    expect(screen.getByTestId('screen-UI-D04')).toBeOnTheScreen();
    expectTabBarVisible(false);
  });

  it('đi sâu trong tab (Tạo đơn nhanh) vẫn giữ thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.quickOrder.path });
    expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it('quay lại (Back/cử chỉ) khi đang ở màn quay bị chặn và hiện cảnh báo, không rời màn', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    await act(async () => {
      router.push(`${ROUTES.packRecord.path}?code=DEMO-0001`);
    });
    expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Giữ video và quay lại' })).toBeOnTheScreen();
  });

  it('"Kết thúc phiên" mở chặn rồi sang Xác nhận video; "Giữ video và quay lại" ở lại màn quay', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    await act(async () => {
      router.push(`${ROUTES.packRecord.path}?code=DEMO-0001`);
    });
    await act(async () => {
      router.back();
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Giữ video và quay lại' }));
    expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
    expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();

    await act(async () => {
      router.back();
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(screen.getByTestId('screen-UI-C04')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-C03')).toBeNull();
  });
});
