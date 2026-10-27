import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Text, useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeApi, FAKE_DEMO_EMAIL, createUnavailableApi } from '@/api/testing';
import type { Gateways } from '../domain/types';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockWindow = jest.mocked(useWindowDimensions);
const errors = resources.vi.errors;
const fullText = (m: string | { title: string; hint: string }) =>
  typeof m === 'string' ? m : `${m.title} ${m.hint}`;

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
});

const email = () => screen.getByTestId('forgot-email');
const submit = () => screen.getByTestId('forgot-submit');

describe('UI-A07 Quên mật khẩu: giao diện', () => {
  it('có tiêu đề header, hình, lời trấn an, mô tả, ô Email + gợi ý, nút, link quay lại và thẻ Mẹo', async () => {
    await renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByTestId('screen-UI-A07')).toBeOnTheScreen();
    expect(screen.getByText('Quên mật khẩu')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeOnTheScreen();
    expect(
      screen.getByTestId('forgot-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Đừng lo, mình cùng lấy lại nhé!')).toBeOnTheScreen();
    expect(
      screen.getByText('Nhập email đã đăng ký. Đơn Chứng sẽ gửi mã xác minh cho bạn.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Dùng email bạn đã đăng ký tài khoản.')).toBeOnTheScreen();
    expect(submit()).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Quay lại đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByText('Mẹo nhỏ cho bạn')).toBeOnTheScreen();
    expect(screen.queryByText(/điện thoại/i)).toBeNull();
  });

  it.each([
    [375, 667],
    [320, 568],
  ])('màn thấp %ix%i: vẫn đủ ô, nút, link và thẻ Mẹo', async (w, h) => {
    mockWindow.mockReturnValue({ width: w, height: h, scale: 2, fontScale: 1 });
    await renderWithProviders(<ForgotPasswordScreen />);
    expect(email()).toBeOnTheScreen();
    expect(submit()).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Quay lại đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByTestId('forgot-tip')).toBeOnTheScreen();
  });
});

describe('UI-A07 Quên mật khẩu: kiểm tra dữ liệu', () => {
  it('mới mở: không lỗi; rời ô khi trống thì báo; sai định dạng thì báo đúng chữ', async () => {
    await renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.queryByTestId('forgot-email-error')).toBeNull();
    await fireEvent(email(), 'blur');
    expect(
      within(screen.getByTestId('forgot-email-error')).getByText('Bạn nhập email trước nhé.'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(email(), 'abc');
    expect(screen.getByText('Email chưa đúng. Ví dụ: ten@cuahang.com')).toBeOnTheScreen();
    // lỗi ẩn gợi ý
    expect(screen.queryByText('Dùng email bạn đã đăng ký tài khoản.')).toBeNull();
  });

  it('bấm gửi khi sai: lỗi, KHÔNG gọi cổng, KHÔNG chuyển màn', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: fake });
    await fireEvent.press(submit());
    expect(screen.getByText('Bạn nhập email trước nhé.')).toBeOnTheScreen();
    expect(fake.auth.recoveryRequests).toHaveLength(0);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});

describe('UI-A07 Quên mật khẩu: gửi', () => {
  it('thành công: gọi cổng với email đã bỏ khoảng trắng rồi sang /verify-otp', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: fake });
    await fireEvent.changeText(email(), `  ${FAKE_DEMO_EMAIL} `);
    await fireEvent.press(submit());
    expect(fake.auth.recoveryRequests).toEqual([FAKE_DEMO_EMAIL]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.verifyOtp);
  });

  it('TRUNG TÍNH: email chưa có tài khoản cũng sang /verify-otp, không báo gì khác', async () => {
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: createFakeApi() });
    await fireEvent.changeText(email(), 'khong.co@example.com');
    await fireEvent.press(submit());
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.verifyOtp);
    expect(screen.queryByTestId('form-error')).toBeNull();
    expect(screen.queryByText(/chưa có tài khoản|không tồn tại|không tìm thấy/i)).toBeNull();
  });

  it('đang xử lý: nút khóa; bấm đúp chỉ gọi cổng một lần', async () => {
    let resolve: () => void = () => undefined;
    const requestPasswordRecovery = jest.fn(
      () =>
        new Promise<{ retryAfterSeconds?: number }>((r) => {
          resolve = () => r({ retryAfterSeconds: 30 });
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, requestPasswordRecovery },
      shop: createFakeApi().shop,
    };
    await renderWithProviders(<ForgotPasswordScreen />, { gateways });
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    await fireEvent.press(submit());
    await fireEvent.press(submit());
    await fireEvent(email(), 'submitEditing');
    expect(requestPasswordRecovery).toHaveBeenCalledTimes(1);
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await act(async () => resolve());
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
  });

  it('không gửi được (hệ thống bận): câu theo thiết kế + Thử lại; giữ email; Thử lại gửi lại đúng email', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: fake });
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    fake.auth.failNext('AUTH_SERVICE_UNAVAILABLE');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText('Chưa gửi được mã. Bạn thử lại sau ít phút nhé!'),
    ).toBeOnTheScreen();
    expect(email().props.value).toBe(FAKE_DEMO_EMAIL);
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await fireEvent.press(within(banner).getByRole('button', { name: 'Thử lại' }));
    expect(fake.auth.recoveryRequests).toEqual([FAKE_DEMO_EMAIL, FAKE_DEMO_EMAIL]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.verifyOtp);
  });

  it('mất mạng: câu mất mạng chuẩn + Thử lại', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: fake });
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(within(banner).getByText(fullText(errors.AUTH_NETWORK_ERROR))).toBeOnTheScreen();
    expect(within(banner).getByRole('button', { name: 'Thử lại' })).toBeOnTheScreen();
  });

  it('xin mã quá nhiều lần: câu theo thiết kế, không có Thử lại', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: fake });
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    fake.auth.failNext('AUTH_TOO_MANY_REQUESTS');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText('Bạn đã xin mã nhiều lần. Hãy thử lại sau ít phút.'),
    ).toBeOnTheScreen();
    expect(within(banner).queryByRole('button')).toBeNull();
  });

  it('bản "chưa kết nối": báo lỗi, không sang bước sau', async () => {
    await renderWithProviders(<ForgotPasswordScreen />, { gateways: createUnavailableApi() });
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    await fireEvent.press(submit());
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});

/** Chỉ để test đọc trạng thái luồng khôi phục. */
function RecoveryProbe() {
  const { recovery } = useOnboardingFlow();
  return (
    <>
      <Text testID="probe-requested">{recovery.requestedEmail ?? '(không)'}</Text>
      <Text testID="probe-signin-email">{recovery.signInEmail ?? '(không)'}</Text>
    </>
  );
}

describe('UI-A07 Quên mật khẩu: điều hướng', () => {
  it('không đọc email từ tham số điều hướng (email điền sẵn đi qua trạng thái luồng)', async () => {
    mockNavigation.params = { email: 'tham.so@example.com' };
    await renderWithProviders(<ForgotPasswordScreen />);
    expect(email().props.value).toBe('');
  });

  it('Quay lại đăng nhập: reset về /sign-in KHÔNG kèm tham số; email đã gõ đi qua trạng thái luồng; nút Back gọi back', async () => {
    await renderWithProviders(
      <>
        <RecoveryProbe />
        <ForgotPasswordScreen />
      </>,
    );
    await fireEvent.press(screen.getByRole('link', { name: 'Quay lại đăng nhập' }));
    expect(mockNavigation.reset).toHaveBeenLastCalledWith(ROUTES.signIn);
    expect(screen.getByTestId('probe-signin-email')).toHaveTextContent('(không)');
    await fireEvent.changeText(email(), 'a@b.co');
    await fireEvent.press(screen.getByRole('link', { name: 'Quay lại đăng nhập' }));
    expect(mockNavigation.reset).toHaveBeenLastCalledWith(ROUTES.signIn);
    expect(mockNavigation.reset.mock.calls.every((call) => call.length === 1)).toBe(true);
    expect(screen.getByTestId('probe-signin-email')).toHaveTextContent('a@b.co');
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });

  it('đã rời màn trong lúc chờ gửi mã (Back): không sang /verify-otp, không ghi điều kiện vào màn Nhập mã', async () => {
    let resolve: () => void = () => undefined;
    const requestPasswordRecovery = jest.fn(
      () =>
        new Promise<{ retryAfterSeconds?: number }>((r) => {
          resolve = () => r({ retryAfterSeconds: 30 });
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, requestPasswordRecovery },
      shop: createFakeApi().shop,
    };
    await renderWithProviders(
      <>
        <RecoveryProbe />
        <ForgotPasswordScreen />
      </>,
      { gateways },
    );
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    await fireEvent.press(submit());
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    mockNavigation.screenActive = false;
    await act(async () => resolve());
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-requested')).toHaveTextContent('(không)');
  });

  it('gửi mã xong rồi đổi sang email khác: điều kiện vào màn Nhập mã bị xóa', async () => {
    await renderWithProviders(
      <>
        <RecoveryProbe />
        <ForgotPasswordScreen />
      </>,
    );
    await fireEvent.changeText(email(), FAKE_DEMO_EMAIL);
    await fireEvent.press(submit());
    expect(screen.getByTestId('probe-requested')).toHaveTextContent(FAKE_DEMO_EMAIL);
    await fireEvent.changeText(email(), 'khac@example.com');
    expect(screen.getByTestId('probe-requested')).toHaveTextContent('(không)');
  });
});
