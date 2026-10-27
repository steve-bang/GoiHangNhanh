import { join } from 'node:path';

import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { ROUTES } from '@/core/navigation';

const APP_DIR = join(__dirname, '..', '..', 'app');

/**
 * Luồng thiết lập đi qua Expo Router thật (trong bộ nhớ) với cổng giả của môi trường test:
 * /welcome -> /sign-up -> /create-shop -> /setup-done -> Tổng quan. Không thay thế kiểm thử trên
 * thiết bị (bàn phím thật, Back phần cứng Android, cử chỉ vuốt iOS).
 */
async function signUp(email: string) {
  await fireEvent.press(screen.getByTestId('welcome-create-account'));
  expect(screen.getByTestId('signup-email')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId('signup-email'), email);
  await fireEvent.changeText(screen.getByTestId('signup-password'), 'matkhau-du-dai-1');
  await fireEvent.press(screen.getByTestId('signup-submit'));
  expect(await screen.findByTestId('shop-name-input')).toBeOnTheScreen();
}

describe('luồng thiết lập (Expo Router thật, cổng giả)', () => {
  it('đi hết luồng; Bắt đầu sử dụng vào Tổng quan và không quay lại được màn thiết lập', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.welcome.path });
    await signUp('luong.day.du@example.com');

    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop Minh Anh');
    await fireEvent.press(screen.getByTestId('source-shopee'));
    await fireEvent.press(screen.getByTestId('source-tiktok_shop'));
    await fireEvent.press(screen.getByTestId('create-shop-submit'));

    expect(await screen.findByTestId('setup-start')).toBeOnTheScreen();
    expect(screen.getByText('Shop Minh Anh')).toBeOnTheScreen();
    expect(screen.getByText('Shopee, TikTok Shop')).toBeOnTheScreen();
    expect(screen.queryByText(/Gói/)).toBeNull();

    // Back hệ thống/cử chỉ bị chặn ở màn Hoàn tất.
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('setup-start')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('setup-start'));
    expect(screen.getByTestId('screen-UI-B01')).toBeOnTheScreen();
    expect(screen.queryByTestId('setup-start')).toBeNull();
    expect(router.canGoBack()).toBe(false);
  });

  it('quay lại màn trước rồi tiến tới lại: giữ giá trị đã nhập và không tạo tài khoản lần hai', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.welcome.path });
    await signUp('giu.gia.tri@example.com');

    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Cửa hàng Ánh');
    await fireEvent.press(screen.getByTestId('source-lazada'));

    // Quay về màn đăng ký: email còn nguyên; mật khẩu không được giữ.
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(await screen.findByTestId('signup-email')).toBeOnTheScreen();
    expect(screen.getByTestId('signup-email').props.value).toBe('giu.gia.tri@example.com');

    // Tiến tới lại với cùng email: không gọi cổng lần hai (nếu gọi sẽ báo email đã dùng).
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('shop-name-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).toBeNull();
    expect(screen.getByTestId('shop-name-input').props.value).toBe('Cửa hàng Ánh');
    expect(screen.getByRole('checkbox', { name: 'Lazada' }).props.accessibilityState).toMatchObject(
      {
        checked: true,
      },
    );
  });

  it('email đã dùng: ở lại màn đăng ký, hiện thông báo, không sang màn shop', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.welcome.path });
    await fireEvent.press(screen.getByTestId('welcome-create-account'));
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'da.dung@example.com');
    await fireEvent.changeText(screen.getByTestId('signup-password'), 'matkhau-du-dai-1');
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('form-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('shop-name-input')).toBeNull();
  });

  it('"Bỏ qua, để sau" đi hết luồng khi đã có tên: Nguồn bán hiện "Chưa chọn"', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.welcome.path });
    await signUp('bo.qua@example.com');
    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop A');
    await fireEvent.press(screen.getByTestId('source-shopee'));
    await fireEvent.press(screen.getByTestId('create-shop-skip'));
    expect(await screen.findByTestId('setup-start')).toBeOnTheScreen();
    expect(screen.getByText('Chưa chọn')).toBeOnTheScreen();
  });

  it('hàng tóm tắt mở Cài đặt shop, Xem hướng dẫn nhanh mở Trợ giúp; Back về lại màn Hoàn tất', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.welcome.path });
    await signUp('lien.ket@example.com');
    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop B');
    await fireEvent.press(screen.getByTestId('create-shop-submit'));
    await screen.findByTestId('setup-start');

    await fireEvent.press(screen.getByTestId('summary-shop'));
    expect(screen.getByTestId('screen-UI-I02')).toBeOnTheScreen();
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('setup-start')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('setup-guide'));
    expect(screen.getByTestId('screen-UI-I06')).toBeOnTheScreen();
  });
});
