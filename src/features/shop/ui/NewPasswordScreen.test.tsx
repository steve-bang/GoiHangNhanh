import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeApi, FAKE_DEMO_EMAIL, createUnavailableApi } from '@/api/testing';
import type { Gateways } from '../domain/types';
import { NewPasswordScreen } from './NewPasswordScreen';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { WithRecoveryState } from './recovery-test-harness';
import { SignInScreen } from './SignInScreen';

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

const NEW_PASSWORD = 'mat-khau-moi-9';
beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
});

/** Chỉ để test đọc trạng thái luồng khôi phục. */
function RecoveryProbe() {
  const { recovery } = useOnboardingFlow();
  return (
    <>
      <Text testID="probe-ticket">{recovery.ticket ?? '(không)'}</Text>
      <Text testID="probe-requested">{recovery.requestedEmail ?? '(không)'}</Text>
      <Text testID="probe-signin-email">{recovery.signInEmail ?? '(không)'}</Text>
      <Text testID="probe-notice">{String(recovery.resetNotice)}</Text>
    </>
  );
}

/** Dựng màn sau khi đã qua bước nhập mã (có vé). `ticketExpiresAt` là mốc hạn cổng báo (nếu có). */
function renderNew(
  gateways: Gateways = createFakeApi(),
  ticket = 'fake-ticket-1',
  ticketExpiresAt: number | null = null,
) {
  return renderWithProviders(
    <>
      <RecoveryProbe />
      <WithRecoveryState
        actions={() => [
          { type: 'code_requested', email: FAKE_DEMO_EMAIL, resendAvailableAt: 0 },
          { type: 'code_verified', ticket, ticketExpiresAt },
        ]}
      >
        <NewPasswordScreen />
      </WithRecoveryState>
    </>,
    { gateways },
  );
}
const password = () => screen.getByTestId('newpass-password');
const confirm = () => screen.getByTestId('newpass-confirm');
const submit = () => screen.getByTestId('newpass-submit');
async function fill(a: string, b: string) {
  await fireEvent.changeText(password(), a);
  await fireEvent.changeText(confirm(), b);
}

/** Cổng thật của bản giả đã đi qua bước xin mã + nhập mã, trả vé hợp lệ. */
async function realTicket(fake: ReturnType<typeof createFakeApi>) {
  await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
  return (await fake.auth.verifyRecoveryCode({ email: FAKE_DEMO_EMAIL, code: '123456' })).ticket;
}

describe('UI-A09 Mật khẩu mới: chặn vào khi chưa qua bước trước', () => {
  it('chưa có vé và chưa xin mã: về /forgot-password, không hiện màn', async () => {
    await renderWithProviders(<NewPasswordScreen />);
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.forgotPassword);
  });

  it('đã xin mã nhưng chưa xác minh: về /verify-otp', async () => {
    await renderWithProviders(
      <WithRecoveryState
        actions={() => [{ type: 'code_requested', email: 'a@b.co', resendAvailableAt: 0 }]}
      >
        <NewPasswordScreen />
      </WithRecoveryState>,
    );
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.verifyOtp);
  });
});

describe('UI-A09 Mật khẩu mới: vé hết hạn theo hạn cổng báo', () => {
  it('vé quá hạn: không hiện màn, xóa vé, về /verify-otp để nhập mã lại', async () => {
    await renderNew(createFakeApi(), 't', Date.now() - 1000);
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.verifyOtp);
    expect(screen.getByTestId('probe-ticket')).toHaveTextContent('(không)');
  });

  it('vé còn hạn: vào được màn', async () => {
    await renderNew(createFakeApi(), 't', Date.now() + 60_000);
    expect(screen.getByTestId('screen-UI-A09')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });
});

describe('UI-A09 Mật khẩu mới: giao diện', () => {
  it('có header, hình, tiêu đề, mô tả, hai ô có hiện/ẩn, khối "Mật khẩu nên có" MỘT dòng, nút', async () => {
    await renderNew();
    expect(screen.getByTestId('screen-UI-A09')).toBeOnTheScreen();
    // "Mật khẩu mới" vừa là tiêu đề header vừa là nhãn ô đầu
    expect(screen.getAllByText('Mật khẩu mới')).toHaveLength(2);
    expect(
      screen.getByTestId('new-password-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Tạo mật khẩu mới')).toBeOnTheScreen();
    expect(
      screen.getByText('Chọn mật khẩu mạnh để giữ tài khoản của bạn an toàn hơn.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nhập lại mật khẩu mới')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Hiện mật khẩu' })).toHaveLength(2);
    expect(password().props.autoComplete).toBe('new-password');
    expect(confirm().props.autoComplete).toBe('new-password');
    expect(screen.getByText('Mật khẩu nên có')).toBeOnTheScreen();
    expect(screen.getByText('Ít nhất 8 ký tự')).toBeOnTheScreen();
    expect(screen.queryByText(/chữ hoa|ít nhất 1 số|yêu cầu bảo mật/i)).toBeNull();
    expect(submit()).toBeOnTheScreen();
  });

  it.each([
    [375, 667],
    [320, 568],
  ])('màn thấp %ix%i: vẫn đủ hai ô, khối quy tắc và nút', async (w, h) => {
    mockWindow.mockReturnValue({ width: w, height: h, scale: 2, fontScale: 1 });
    await renderNew();
    expect(password()).toBeOnTheScreen();
    expect(confirm()).toBeOnTheScreen();
    expect(screen.getByTestId('newpass-rules')).toBeOnTheScreen();
    expect(submit()).toBeOnTheScreen();
  });

  it('hiện/ẩn từng ô độc lập, có nhãn truy cập', async () => {
    await renderNew();
    const [firstToggle] = screen.getAllByRole('button', { name: 'Hiện mật khẩu' });
    if (!firstToggle) throw new Error('thiếu nút hiện mật khẩu');
    await fireEvent.press(firstToggle);
    expect(password().props.secureTextEntry).toBe(false);
    expect(confirm().props.secureTextEntry).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Ẩn mật khẩu' })).toHaveLength(1);
  });
});

describe('UI-A09 Mật khẩu mới: kiểm tra dữ liệu', () => {
  it('dòng "Ít nhất 8 ký tự" đánh dấu theo thời gian thực', async () => {
    await renderNew();
    expect(screen.getByTestId('newpass-rules-length-unmet')).toBeOnTheScreen();
    await fireEvent.changeText(password(), '1234567');
    expect(screen.getByTestId('newpass-rules-length-unmet')).toBeOnTheScreen();
    await fireEvent.changeText(password(), '12345678');
    expect(screen.getByTestId('newpass-rules-length-met')).toBeOnTheScreen();
    expect(screen.getByTestId('newpass-rules').props.accessibilityLabel).toContain('đã đạt');
  });

  it('nút khóa tới khi hợp lệ VÀ khớp', async () => {
    await renderNew();
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true });
    await fill('12345678', '');
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true });
    await fill('12345678', '1234567x');
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true });
    await fill('1234567', '1234567');
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true });
    await fill('12345678', '12345678');
    expect(submit().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('lỗi từng ô, đúng chữ: trống, ngắn, nhập lại trống, không khớp (sau lần chạm đầu)', async () => {
    await renderNew();
    expect(screen.queryByText(/Bạn chưa nhập|Mật khẩu cần|Hai mật khẩu/)).toBeNull();
    await fireEvent(password(), 'blur');
    expect(
      within(screen.getByTestId('newpass-password-error')).getByText('Bạn chưa nhập mật khẩu mới.'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(password(), '123');
    expect(screen.getByText('Mật khẩu cần ít nhất 8 ký tự.')).toBeOnTheScreen();
    await fireEvent(confirm(), 'blur');
    expect(
      within(screen.getByTestId('newpass-confirm-error')).getByText(
        'Bạn nhập lại mật khẩu để xác nhận nhé.',
      ),
    ).toBeOnTheScreen();
    await fill('mat-khau-dai-1', 'mat-khau-dai-2');
    expect(
      within(screen.getByTestId('newpass-confirm-error')).getByText(
        'Hai mật khẩu chưa khớp nhau. Bạn kiểm tra lại nhé!',
      ),
    ).toBeOnTheScreen();
    await fireEvent.changeText(confirm(), 'mat-khau-dai-1');
    expect(screen.queryByTestId('newpass-confirm-error')).toBeNull();
  });

  it('không có câu lỗi thừa "chưa đáp ứng các yêu cầu bảo mật"', async () => {
    await renderNew();
    await fill('123', '456');
    expect(screen.queryByText(/yêu cầu bảo mật/)).toBeNull();
  });
});

describe('UI-A09 Mật khẩu mới: gửi', () => {
  it('thành công: về /sign-in bằng reset (kèm email, KHÔNG kèm mật khẩu), bật cờ banner thành công', async () => {
    const fake = createFakeApi();
    const ticket = await realTicket(fake);
    await renderNew(fake, ticket);
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    await fireEvent.press(submit());
    expect(fake.auth.resetCalls).toEqual([{ ticket, newPassword: NEW_PASSWORD }]);
    // email đi qua trạng thái luồng (dùng một lần ở màn Đăng nhập), không qua tham số điều hướng
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn);
    expect(mockNavigation.reset.mock.calls[0]).toHaveLength(1);
    expect(screen.getByTestId('probe-signin-email')).toHaveTextContent(FAKE_DEMO_EMAIL);
    expect(screen.getByTestId('probe-notice')).toHaveTextContent('true');
    // vé và email đã xin mã bị xóa: không vào lại được màn Mật khẩu mới/Nhập mã
    expect(screen.getByTestId('probe-ticket')).toHaveTextContent('(không)');
    expect(screen.getByTestId('probe-requested')).toHaveTextContent('(không)');
    expect(JSON.stringify(mockNavigation.reset.mock.calls)).not.toContain(NEW_PASSWORD);
    expect(screen.queryByText(/thành công/i)).toBeNull();
    // đặt lại xong, đăng nhập bằng mật khẩu mới được
    await expect(
      fake.auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: NEW_PASSWORD }),
    ).resolves.toBeDefined();
  });

  it('đã rời màn trong lúc chờ: mật khẩu đã đổi thì xóa vé khỏi luồng, nhưng KHÔNG điều hướng', async () => {
    let resolve: () => void = () => undefined;
    const resetPassword = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, resetPassword },
      shop: createFakeApi().shop,
    };
    await renderNew(gateways);
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    await fireEvent.press(submit());
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    mockNavigation.screenActive = false;
    await act(async () => resolve());
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-ticket')).toHaveTextContent('(không)');
  });

  it('kết quả đến muộn sau khi đã rời màn: banner "đã đặt lại" + email điền sẵn vẫn được ghi, hiện MỘT lần ở lần mở Đăng nhập kế tiếp (chủ ý, không toast)', async () => {
    let resolve: () => void = () => undefined;
    const resetPassword = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, resetPassword },
      shop: createFakeApi().shop,
    };
    function Harness() {
      const [screenName, setScreenName] = useState<'new' | 'signIn' | 'none'>('new');
      return (
        <>
          <RecoveryProbe />
          <Pressable testID="to-none" onPress={() => setScreenName('none')} />
          <Pressable testID="to-signin" onPress={() => setScreenName('signIn')} />
          {screenName === 'new' ? (
            <WithRecoveryState
              actions={() => [
                { type: 'code_requested', email: FAKE_DEMO_EMAIL, resendAvailableAt: 0 },
                { type: 'code_verified', ticket: 'fake-ticket-1', ticketExpiresAt: null },
              ]}
            >
              <NewPasswordScreen />
            </WithRecoveryState>
          ) : null}
          {screenName === 'signIn' ? <SignInScreen /> : null}
        </>
      );
    }
    await renderWithProviders(<Harness />, { gateways });
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    await fireEvent.press(submit());
    // người dùng Back về Quên mật khẩu (màn Mật khẩu mới bị gỡ) trong lúc chờ
    await fireEvent.press(screen.getByTestId('to-none'));
    mockNavigation.screenActive = false;
    await act(async () => resolve());
    mockNavigation.screenActive = true;
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.queryByTestId('signin-reset-success')).toBeNull();
    expect(screen.getByTestId('probe-notice')).toHaveTextContent('true');
    expect(screen.getByTestId('probe-signin-email')).toHaveTextContent(FAKE_DEMO_EMAIL);
    expect(screen.getByTestId('probe-ticket')).toHaveTextContent('(không)');
    // lần mở Đăng nhập kế tiếp: hiện banner + email điền sẵn, rồi xóa cờ (một lần)
    await fireEvent.press(screen.getByTestId('to-signin'));
    expect(screen.getByTestId('signin-reset-success')).toBeOnTheScreen();
    expect(screen.getByTestId('signin-email').props.value).toBe(FAKE_DEMO_EMAIL);
    expect(screen.getByTestId('probe-notice')).toHaveTextContent('false');
    expect(screen.getByTestId('probe-signin-email')).toHaveTextContent('(không)');
  });

  it('đang xử lý: nút có vòng xoay/khóa; bấm đúp chỉ gọi cổng một lần', async () => {
    let resolve: () => void = () => undefined;
    const resetPassword = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, resetPassword },
      shop: createFakeApi().shop,
    };
    await renderNew(gateways);
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    await fireEvent.press(submit());
    await fireEvent.press(submit());
    await fireEvent(confirm(), 'submitEditing');
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await act(async () => resolve());
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
  });

  it('hệ thống bận: câu theo thiết kế + Thử lại; giữ dữ liệu; Thử lại gửi lại ĐÚNG dữ liệu', async () => {
    const fake = createFakeApi();
    const ticket = await realTicket(fake);
    await renderNew(fake, ticket);
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    fake.auth.failNext('AUTH_SERVICE_UNAVAILABLE');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText('Chưa thể cập nhật mật khẩu lúc này. Bạn thử lại nhé!'),
    ).toBeOnTheScreen();
    expect(password().props.value).toBe(NEW_PASSWORD);
    expect(confirm().props.value).toBe(NEW_PASSWORD);
    await fireEvent.press(within(banner).getByRole('button', { name: 'Thử lại' }));
    const same = { ticket, newPassword: NEW_PASSWORD };
    expect(fake.auth.resetCalls).toEqual([same, same]);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn);
  });

  it('mất mạng: câu mất mạng chuẩn + Thử lại', async () => {
    const fake = createFakeApi();
    await renderNew(fake, await realTicket(fake));
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(within(banner).getByText(fullText(errors.AUTH_NETWORK_ERROR))).toBeOnTheScreen();
    expect(within(banner).getByRole('button', { name: 'Thử lại' })).toBeOnTheScreen();
  });

  it('phiên hết hạn: câu theo thiết kế, nút "Quay lại bước đầu", xóa mật khẩu đã gõ, không chuyển sang đăng nhập', async () => {
    const fake = createFakeApi();
    await renderNew(fake, 've-het-han');
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText(
        'Phiên xác minh đã hết hạn. Bạn cần xác minh lại để đặt mật khẩu mới.',
      ),
    ).toBeOnTheScreen();
    expect(password().props.value).toBe('');
    expect(confirm().props.value).toBe('');
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await fireEvent.press(within(banner).getByRole('button', { name: 'Quay lại bước đầu' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });

  it('bản "chưa kết nối": báo lỗi, không về đăng nhập', async () => {
    await renderNew(createUnavailableApi());
    await fill(NEW_PASSWORD, NEW_PASSWORD);
    await fireEvent.press(submit());
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });
});
