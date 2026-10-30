import { join } from 'node:path';

import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { ROUTES } from '@/core/navigation';
import { resetDefaultGatewaysForTests } from '@/features/shop';

const APP_DIR = join(__dirname, '..', '..', 'app');
const DEMO = 'demo@example.com';
const DEMO_PASSWORD = 'demo-matkhau-1';
const NEW_PASSWORD = 'mat-khau-moi-9';

// v1 chạy `email_link` (D-14; decisions.md Q-29 / V1-03). Nhóm test luồng mã 6 số (để sau v1) đặt
// `otp` để giữ kiểm thử giao diện đã có. Getter: đọc lúc dùng, không chép lúc nạp module.
let mockRecoveryMode: 'email_link' | 'otp' = 'email_link';
jest.mock('@/core/config/feature-flags', () =>
  Object.defineProperty(
    { ...jest.requireActual<object>('@/core/config/feature-flags') },
    'PASSWORD_RECOVERY_MODE',
    { get: () => mockRecoveryMode, enumerable: true },
  ),
);

/**
 * Luồng đăng nhập và khôi phục mật khẩu qua Expo Router thật (trong bộ nhớ) với cổng giả của môi
 * trường test. Không thay thế kiểm thử trên thiết bị (bàn phím/tự điền mã thật, Back phần cứng).
 */
beforeEach(() => {
  resetDefaultGatewaysForTests();
});

async function forgotAndVerify(email: string) {
  await fireEvent.press(screen.getByTestId('signin-forgot'));
  await fireEvent.changeText(screen.getByTestId('forgot-email'), email);
  await fireEvent.press(screen.getByTestId('forgot-submit'));
  expect(await screen.findByTestId('screen-UI-A08')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
  expect(await screen.findByTestId('screen-UI-A09')).toBeOnTheScreen();
}

describe('đăng nhập (Expo Router thật, cổng giả)', () => {
  it('đăng nhập đúng: vào Tổng quan, không còn quay lại được màn đăng nhập', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await fireEvent.changeText(screen.getByTestId('signin-email'), DEMO);
    await fireEvent.changeText(screen.getByTestId('signin-password'), DEMO_PASSWORD);
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('screen-UI-B01')).toBeOnTheScreen();
    expect(screen.queryByTestId('signin-submit')).toBeNull();
    expect(router.canGoBack()).toBe(false);
  });

  it('sai mật khẩu: ở lại màn, banner chung, giữ dữ liệu', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await fireEvent.changeText(screen.getByTestId('signin-email'), DEMO);
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'sai-mat-khau-1');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(
      await screen.findByText('Email hoặc mật khẩu chưa chính xác. Bạn kiểm tra lại nhé!'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('signin-email').props.value).toBe(DEMO);
    expect(screen.queryByTestId('screen-UI-B01')).toBeNull();
  });

  it('tài khoản chưa có shop: sang màn tạo shop', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await fireEvent.changeText(screen.getByTestId('signin-email'), 'chua.co.shop@example.com');
    await fireEvent.changeText(screen.getByTestId('signin-password'), DEMO_PASSWORD);
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('shop-name-input')).toBeOnTheScreen();
  });

  it('từ màn đăng ký: liên kết "Đăng nhập" mang email sang /sign-in (không mang mật khẩu)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signUp.path });
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'ban.moi@example.com');
    await fireEvent.changeText(screen.getByTestId('signup-password'), 'matkhau-khong-duoc-mang');
    await fireEvent.press(screen.getByTestId('signup-to-sign-in'));
    expect(await screen.findByTestId('signin-email')).toBeOnTheScreen();
    expect(screen.getByTestId('signin-email').props.value).toBe('ban.moi@example.com');
    expect(screen.getByTestId('signin-password').props.value).toBe('');
  });

  it('màn Đăng nhập thật không có "Duy trì đăng nhập", TikTok, và v1 không có Apple/Google (O-15)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    expect(screen.queryByText(/Duy trì đăng nhập/)).toBeNull();
    expect(screen.queryByText(/TikTok/i)).toBeNull();
    expect(screen.queryByTestId('signin-social-apple')).toBeNull();
    expect(screen.queryByTestId('signin-social-google')).toBeNull();
    expect(screen.queryByText(/Apple|Google/)).toBeNull();
  });

  it.each([ROUTES.welcome.path, ROUTES.signUp.path])(
    '%s: v1 không có nút Apple/Google (O-15)',
    async (path) => {
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(screen.queryByText(/Apple|Google/)).toBeNull();
    },
  );
});

describe('quên mật khẩu bằng thư đặt lại (v1, D-14; Expo Router thật, cổng giả)', () => {
  it('Đăng nhập -> Quên mật khẩu -> Kiểm tra hộp thư -> Quay lại đăng nhập (email điền sẵn, không quay lại được)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await fireEvent.press(screen.getByTestId('signin-forgot'));
    await fireEvent.changeText(screen.getByTestId('forgot-email'), DEMO);
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('screen-UI-A07-sent')).toBeOnTheScreen();
    expect(screen.getByTestId('recovery-sent-description')).toHaveTextContent(/de•••@example\.com/);
    expect(screen.queryByTestId('screen-UI-A08')).toBeNull();

    await fireEvent.press(screen.getByTestId('recovery-sent-back-to-sign-in'));
    expect(await screen.findByTestId('signin-email')).toBeOnTheScreen();
    expect(screen.getByTestId('signin-email').props.value).toBe(DEMO);
    expect(screen.getByTestId('signin-password').props.value).toBe('');
    // không có banner "đã đặt lại": app không biết người dùng đã đặt mật khẩu mới trên trang web chưa
    expect(screen.queryByTestId('signin-reset-success')).toBeNull();
    expect(router.canGoBack()).toBe(false);
  });

  it('email chưa có tài khoản: cùng màn Kiểm tra hộp thư (trung tính)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.forgotPassword.path });
    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'khong.co@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('screen-UI-A07-sent')).toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('"Đổi email": về Quên mật khẩu với email cũ', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.forgotPassword.path });
    await fireEvent.changeText(screen.getByTestId('forgot-email'), DEMO);
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('screen-UI-A07-sent');
    await fireEvent.press(screen.getByTestId('recovery-sent-change-email'));
    expect(await screen.findByTestId('forgot-email')).toBeOnTheScreen();
    expect(screen.getByTestId('forgot-email').props.value).toBe(DEMO);
  });

  it.each([ROUTES.verifyOtp.path, ROUTES.newPassword.path])(
    'liên kết sâu %s: về Đăng nhập (không có màn mã/mật khẩu mới ở v1)',
    async (path) => {
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByTestId('signin-email')).toBeOnTheScreen();
      expect(screen.queryByTestId('screen-UI-A08')).toBeNull();
      expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
    },
  );

  it('liên kết sâu /forgot-password/sent khi chưa gửi: về Quên mật khẩu', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.recoveryEmailSent.path });
    expect(await screen.findByTestId('screen-UI-A07')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A07-sent')).toBeNull();
  });
});

describe('quên mật khẩu -> nhập mã -> mật khẩu mới -> đăng nhập (chế độ otp, để sau v1; Expo Router thật, cổng giả)', () => {
  beforeEach(() => {
    mockRecoveryMode = 'otp';
  });
  afterEach(() => {
    mockRecoveryMode = 'email_link';
  });

  it('đi hết luồng; về /sign-in kèm banner thành công MỘT lần; đăng nhập được bằng mật khẩu mới', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await forgotAndVerify(DEMO);

    await fireEvent.changeText(screen.getByTestId('newpass-password'), NEW_PASSWORD);
    await fireEvent.changeText(screen.getByTestId('newpass-confirm'), NEW_PASSWORD);
    await fireEvent.press(screen.getByTestId('newpass-submit'));

    expect(await screen.findByTestId('signin-reset-success')).toBeOnTheScreen();
    expect(router.canGoBack()).toBe(false);
    // email điền sẵn, mật khẩu thì không
    expect(screen.getByTestId('signin-email').props.value).toBe(DEMO);
    expect(screen.getByTestId('signin-password').props.value).toBe('');

    // mở lại màn Đăng nhập (đóng rồi vào lại): không còn banner
    await act(async () => {
      router.replace(ROUTES.welcome.path);
    });
    await fireEvent.press(screen.getByTestId('welcome-sign-in'));
    expect(screen.queryByTestId('signin-reset-success')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('signin-email'), DEMO);
    await fireEvent.changeText(screen.getByTestId('signin-password'), NEW_PASSWORD);
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('screen-UI-B01')).toBeOnTheScreen();
  });

  it('email chưa có tài khoản: vẫn tới màn nhập mã (trung tính) nhưng mã không bao giờ đúng', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await fireEvent.press(screen.getByTestId('signin-forgot'));
    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'khong.co@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('screen-UI-A08')).toBeOnTheScreen();
    expect(screen.getByTestId('otp-description')).toHaveTextContent(/kh•••@example\.com/);
    await fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
    expect(
      await screen.findByText('Mã xác minh chưa chính xác. Bạn kiểm tra lại nhé!'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
  });

  it('"Thay đổi thông tin" quay về Quên mật khẩu với email cũ', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await fireEvent.press(screen.getByTestId('signin-forgot'));
    await fireEvent.changeText(screen.getByTestId('forgot-email'), DEMO);
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('screen-UI-A08');
    await fireEvent.press(screen.getByTestId('otp-change'));
    expect(await screen.findByTestId('forgot-email')).toBeOnTheScreen();
    expect(screen.getByTestId('forgot-email').props.value).toBe(DEMO);
  });

  it('Back từ Mật khẩu mới không quay lại màn nhập mã (mã đã dùng): về Quên mật khẩu', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.signIn.path });
    await forgotAndVerify(DEMO);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-A07')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A08')).toBeNull();
  });

  it('đường dẫn trực tiếp khi chưa có bước trước bị chặn', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.verifyOtp.path });
    expect(await screen.findByTestId('screen-UI-A07')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A08')).toBeNull();
  });

  it('đường dẫn trực tiếp tới /new-password khi chưa xác minh bị chặn', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.newPassword.path });
    expect(await screen.findByTestId('screen-UI-A07')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
  });

  it('đã xin mã nhưng chưa xác minh mà vào /new-password: về màn nhập mã', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.forgotPassword.path });
    await fireEvent.changeText(screen.getByTestId('forgot-email'), DEMO);
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('screen-UI-A08');
    await act(async () => {
      router.push(ROUTES.newPassword.path);
    });
    expect(await screen.findByTestId('screen-UI-A08')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
  });
});
