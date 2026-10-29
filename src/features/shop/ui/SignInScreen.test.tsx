import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { useSession } from '@/features/personal';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import {
  createFakeApi,
  FAKE_BUSY_EMAIL,
  FAKE_DEMO_EMAIL,
  FAKE_DEMO_PASSWORD,
  FAKE_NO_SHOP_EMAIL,
  createUnavailableApi,
} from '@/api/testing';
import type { Gateways, SignedInAccount } from '../domain/types';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
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
const mockProviders = jest.fn();
jest.mock('@/core/config/feature-flags', () => ({
  getEnabledSocialProviders: () => mockProviders() as string[],
}));

const errors = resources.vi.errors;
const fullText = (m: string | { title: string; hint: string }) =>
  typeof m === 'string' ? m : `${m.title} ${m.hint}`;

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
  mockProviders.mockReset().mockReturnValue(['apple', 'google']);
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
}
const submit = () => screen.getByTestId('signin-submit');

function pendingGateways() {
  let resolve: (a: SignedInAccount) => void = () => undefined;
  const signInWithPassword = jest.fn(
    () =>
      new Promise<SignedInAccount>((r) => {
        resolve = r;
      }),
  );
  const gateways: Gateways = {
    session: createFakeApi().session,
    auth: { ...createUnavailableApi().auth, signInWithPassword },
    shop: createFakeApi().shop,
  };
  return { gateways, signInWithPassword, resolve: (a: SignedInAccount) => resolve(a) };
}

describe('UI-A03 Đăng nhập: giao diện', () => {
  it('có logo xếp dọc, tiêu đề, dòng phụ, hai ô, link Quên mật khẩu, nút, social, link tạo tài khoản', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByTestId('screen-UI-A03')).toBeOnTheScreen();
    expect(screen.getByTestId('stacked-brand-logo')).toBeOnTheScreen();
    expect(screen.getByText('Bảo vệ đơn hàng – Vững bước kinh doanh')).toBeOnTheScreen();
    expect(screen.getByText('Chào mừng bạn trở lại!')).toBeOnTheScreen();
    expect(
      screen.getByText('Cùng Đơn Chứng lưu bằng chứng cho từng đơn hàng nhé!'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Mật khẩu')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Quên mật khẩu?' })).toBeOnTheScreen();
    expect(submit()).toBeOnTheScreen();
    expect(screen.getByText('Hoặc đăng nhập bằng')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng nhập bằng Google' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng nhập bằng Apple' })).toBeOnTheScreen();
    expect(screen.getByText('Bạn chưa có tài khoản?')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Tạo tài khoản' })).toBeOnTheScreen();
    expect(
      screen.getByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('KHÔNG có ô "Duy trì đăng nhập", nút TikTok, nhãn "Số điện thoại", nút quay lại', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByText(/Duy trì đăng nhập/)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/TikTok/i)).toBeNull();
    expect(screen.queryByLabelText(/TikTok/i)).toBeNull();
    expect(screen.queryByText(/điện thoại/i)).toBeNull();
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
  });

  it('thuộc tính ô nhập đúng cho bàn phím và trình quản lý mật khẩu; hiện/ẩn mật khẩu có nhãn', async () => {
    await renderWithProviders(<SignInScreen />);
    const email = screen.getByTestId('signin-email');
    expect(email.props.keyboardType).toBe('email-address');
    expect(email.props.autoComplete).toBe('email');
    const password = screen.getByTestId('signin-password');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('current-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByTestId('signin-password').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(screen.getByTestId('signin-password').props.secureTextEntry).toBe(true);
  });

  it.each([
    [375, 667],
    [320, 568],
  ])('màn thấp %ix%i: ẩn hình nhưng vẫn đủ ô, nút chính, social và link', async (w, h) => {
    mockWindow.mockReturnValue({ width: w, height: h, scale: 2, fontScale: 1 });
    await renderWithProviders(<SignInScreen />);
    expect(
      screen.queryByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.getByTestId('signin-email')).toBeOnTheScreen();
    expect(submit()).toBeOnTheScreen();
    expect(screen.getByTestId('signin-social-group')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Tạo tài khoản' })).toBeOnTheScreen();
  });
});

describe('UI-A03 Đăng nhập: kiểm tra dữ liệu', () => {
  it('mới mở màn: không có lỗi', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByText(/Hãy nhập|Bạn chưa nhập|Email chưa đúng/)).toBeNull();
  });

  it('email sai định dạng hiện lỗi dưới ô; sửa đúng thì mất', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('signin-email'), 'abc');
    expect(
      within(screen.getByTestId('signin-email-error')).getByText(
        'Email chưa đúng. Ví dụ: ten@cuahang.com',
      ),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('signin-email'), 'a@b.co');
    expect(screen.queryByTestId('signin-email-error')).toBeNull();
  });

  it('bấm Đăng nhập khi trống: lỗi cả hai ô, KHÔNG gọi cổng, KHÔNG chuyển màn', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fireEvent.press(submit());
    expect(screen.getByText('Hãy nhập email của bạn.')).toBeOnTheScreen();
    expect(screen.getByText('Bạn chưa nhập mật khẩu.')).toBeOnTheScreen();
    expect(fake.auth.signInCalls).toHaveLength(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('mật khẩu ngắn KHÔNG bị chặn khi đăng nhập (không nhân bản luật độ dài)', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fill(FAKE_DEMO_EMAIL, 'ngan');
    await fireEvent.press(submit());
    expect(fake.auth.signInCalls).toHaveLength(1);
  });
});

describe('UI-A03 Đăng nhập: gửi và kết quả', () => {
  it('thành công + đã có shop: reset sang Tổng quan, không thông báo "thành công", không đưa mật khẩu vào điều hướng', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fill(`  ${FAKE_DEMO_EMAIL} `, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(fake.auth.signInCalls).toEqual([
      { email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD },
    ]);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
    expect(screen.queryByText(/thành công/i)).toBeNull();
    expect(
      JSON.stringify([
        mockNavigation.push.mock.calls,
        mockNavigation.replace.mock.calls,
        mockNavigation.reset.mock.calls,
      ]),
    ).not.toContain(FAKE_DEMO_PASSWORD);
  });

  it('thành công: ghi phiên toàn app (chỉ uid/email, không mật khẩu); thất bại thì không ghi', async () => {
    function SessionProbe() {
      const { state } = useSession();
      return <Text testID="probe-session">{JSON.stringify(state.user)}</Text>;
    }
    const fake = createFakeApi();
    await renderWithProviders(
      <>
        <SessionProbe />
        <SignInScreen />
      </>,
      { gateways: fake },
    );
    await fill(FAKE_DEMO_EMAIL, 'sai-mat-khau-1');
    await fireEvent.press(submit());
    expect(screen.getByTestId('probe-session')).toHaveTextContent('null');

    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    const user = JSON.parse(screen.getByTestId('probe-session').props.children as string) as Record<
      string,
      unknown
    >;
    expect(user.email).toBe(FAKE_DEMO_EMAIL);
    expect(JSON.stringify(user)).not.toContain(FAKE_DEMO_PASSWORD);
  });

  it('thành công: phiên nhận đúng shopId do cổng trả (không phải null); chưa có shop thì shopId null', async () => {
    function ShopProbe() {
      const { state } = useSession();
      return <Text testID="probe-shop">{String(state.shopId)}</Text>;
    }
    const fake = createFakeApi();
    await renderWithProviders(
      <>
        <ShopProbe />
        <SignInScreen />
      </>,
      { gateways: fake },
    );
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    const signedIn = await fake.auth.signInWithPassword({
      email: FAKE_DEMO_EMAIL,
      password: FAKE_DEMO_PASSWORD,
    });
    expect(signedIn.shopId).not.toBeNull();
    expect(screen.getByTestId('probe-shop')).toHaveTextContent(String(signedIn.shopId));

    await fill(FAKE_NO_SHOP_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(screen.getByTestId('probe-shop')).toHaveTextContent('null');
  });

  it('thành công: phiên mang họ tên do cổng trả (giống hồ sơ sau khi khởi động lại)', async () => {
    function NameProbe() {
      const { state } = useSession();
      return <Text testID="probe-name">{String(state.user?.displayName)}</Text>;
    }
    const { gateways, resolve } = pendingGateways();
    await renderWithProviders(
      <>
        <NameProbe />
        <SignInScreen />
      </>,
      { gateways },
    );
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    await act(async () => {
      resolve({
        uid: 'u',
        email: FAKE_DEMO_EMAIL,
        emailVerified: false,
        displayName: 'Chị Lan',
        hasShop: true,
        shopId: 'shop-1',
      });
    });
    expect(screen.getByTestId('probe-name')).toHaveTextContent('Chị Lan');
  });

  it('thành công nhưng chưa có shop: sang /create-shop', async () => {
    await renderWithProviders(<SignInScreen />, { gateways: createFakeApi() });
    await fill(FAKE_NO_SHOP_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.createShop);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('đã rời màn trong lúc chờ cổng: kết quả muộn không điều hướng (không reset, không push)', async () => {
    const { gateways, signInWithPassword, resolve } = pendingGateways();
    await renderWithProviders(<SignInScreen />, { gateways });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    // người dùng bấm Back / đi chỗ khác trong lúc cổng còn chờ
    mockNavigation.screenActive = false;
    await act(async () => {
      resolve({
        uid: 'u',
        email: FAKE_DEMO_EMAIL,
        emailVerified: false,
        displayName: null,
        hasShop: true,
        shopId: 'shop-1',
      });
    });
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('phím Return ở ô mật khẩu gửi form', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent(screen.getByTestId('signin-password'), 'submitEditing');
    expect(fake.auth.signInCalls).toHaveLength(1);
  });

  it('đang xử lý: nút khóa; bấm đúp chỉ gọi cổng một lần', async () => {
    const { gateways, signInWithPassword, resolve } = pendingGateways();
    await renderWithProviders(<SignInScreen />, { gateways });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    await fireEvent.press(submit());
    await fireEvent(screen.getByTestId('signin-password'), 'submitEditing');
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await act(async () => {
      resolve({
        uid: 'u',
        email: FAKE_DEMO_EMAIL,
        emailVerified: false,
        displayName: null,
        hasShop: true,
        shopId: 'shop-1',
      });
    });
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
  });

  it('sai thông tin: banner chung, không nói cái nào sai, không có nút; giữ nguyên dữ liệu', async () => {
    await renderWithProviders(<SignInScreen />, { gateways: createFakeApi() });
    await fill(FAKE_DEMO_EMAIL, 'sai-mat-khau-1');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(banner.props.accessibilityRole).toBe('alert');
    expect(within(banner).getByText(fullText(errors.AUTH_INVALID_CREDENTIALS))).toBeOnTheScreen();
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('signin-email-error')).toBeNull();
    expect(screen.queryByTestId('signin-password-error')).toBeNull();
    expect(screen.getByTestId('signin-email').props.value).toBe(FAKE_DEMO_EMAIL);
    expect(screen.getByTestId('signin-password').props.value).toBe('sai-mat-khau-1');
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    // sửa ô nào thì banner mất
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'sai-mat-khau-2');
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('quá nhiều lần: banner AUTH_TOO_MANY_REQUESTS, không có nút Thử lại', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    fake.auth.failNext('AUTH_TOO_MANY_REQUESTS');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText('Bạn đã thử quá nhiều lần. Hãy thử lại sau ít phút.'),
    ).toBeOnTheScreen();
    expect(within(banner).queryByRole('button')).toBeNull();
  });

  it('lỗi mạng: banner + Thử lại gửi lại ĐÚNG dữ liệu rồi vào Tổng quan', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submit());
    const banner = screen.getByTestId('form-error');
    expect(within(banner).getByText(fullText(errors.AUTH_NETWORK_ERROR))).toBeOnTheScreen();
    expect(screen.getByTestId('signin-password').props.value).toBe(FAKE_DEMO_PASSWORD);
    await fireEvent.press(within(banner).getByRole('button', { name: 'Thử lại' }));
    const same = { email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD };
    expect(fake.auth.signInCalls).toEqual([same, same]);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
  });

  it('hệ thống bận (kịch bản email): banner + Thử lại; bản "chưa kết nối" không bao giờ báo thành công', async () => {
    await renderWithProviders(<SignInScreen />, { gateways: createFakeApi() });
    await fill(FAKE_BUSY_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(
      within(screen.getByTestId('form-error')).getByRole('button', { name: 'Thử lại' }),
    ).toBeOnTheScreen();
  });

  it('bản "chưa kết nối": AUTH_SERVICE_UNAVAILABLE, không điều hướng', async () => {
    await renderWithProviders(<SignInScreen />, { gateways: createUnavailableApi() });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('lỗi lạ (không phải AppError) cũng coi là chưa kết nối, không báo thành công', async () => {
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: {
        ...createUnavailableApi().auth,
        signInWithPassword: () => Promise.reject(new Error('boom')),
      },
      shop: createFakeApi().shop,
    };
    await renderWithProviders(<SignInScreen />, { gateways });
    await fill(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(submit());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });
});

describe('UI-A03 Đăng nhập: điều hướng và email điền sẵn', () => {
  /** Mô phỏng: màn khác đặt email điền sẵn vào trạng thái luồng; mở/đóng màn Đăng nhập; đọc luồng. */
  function PrefillHarness() {
    const { dispatchRecovery, recovery } = useOnboardingFlow();
    const [shown, setShown] = useState(false);
    return (
      <>
        <Pressable
          testID="seed"
          onPress={() =>
            dispatchRecovery({ type: 'signin_email_set', email: 'tu.dang.ky@example.com' })
          }
        />
        <Pressable testID="toggle" onPress={() => setShown((value) => !value)} />
        <Text testID="probe-forgot-email">{recovery.email}</Text>
        <Text testID="probe-prefill">{recovery.signInEmail ?? '(trống)'}</Text>
        {shown ? <SignInScreen /> : null}
      </>
    );
  }

  it('điền sẵn email từ trạng thái luồng MỘT lần (chỉ email, không mật khẩu, không qua tham số)', async () => {
    await renderWithProviders(<PrefillHarness />);
    await fireEvent.press(screen.getByTestId('seed'));
    await fireEvent.press(screen.getByTestId('toggle'));
    expect(screen.getByTestId('signin-email').props.value).toBe('tu.dang.ky@example.com');
    expect(screen.getByTestId('signin-password').props.value).toBe('');
    expect(screen.getByTestId('probe-prefill')).toHaveTextContent('(trống)');
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('toggle'));
    expect(screen.getByTestId('signin-email').props.value).toBe('');
  });

  it('không đọc email từ tham số điều hướng', async () => {
    mockNavigation.params = { email: 'tham.so@example.com' };
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByTestId('signin-email').props.value).toBe('');
  });

  it('Quên mật khẩu? mở /forgot-password KHÔNG kèm tham số; email đã gõ đi vào trạng thái luồng', async () => {
    await renderWithProviders(<PrefillHarness />);
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByRole('link', { name: 'Quên mật khẩu?' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.forgotPassword);
    expect(screen.getByTestId('probe-forgot-email')).toHaveTextContent('');
    await fireEvent.changeText(screen.getByTestId('signin-email'), ' a@b.co ');
    await fireEvent.press(screen.getByRole('link', { name: 'Quên mật khẩu?' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.forgotPassword);
    expect(mockNavigation.push.mock.calls.every((call) => call.length === 1)).toBe(true);
    expect(screen.getByTestId('probe-forgot-email')).toHaveTextContent('a@b.co');
  });

  it('Tạo tài khoản mở /sign-up', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Tạo tài khoản' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.signUp);
  });
});

describe('UI-A03 Đăng nhập: banner "vừa đặt lại mật khẩu"', () => {
  /** Mô phỏng: luồng đặt lại xong (bật cờ) rồi màn Đăng nhập được mở; đóng và mở lại. */
  function Harness() {
    const { dispatchRecovery } = useOnboardingFlow();
    const [shown, setShown] = useState(false);
    return (
      <>
        <Pressable testID="seed" onPress={() => dispatchRecovery({ type: 'reset_completed' })} />
        <Pressable testID="toggle" onPress={() => setShown((value) => !value)} />
        {shown ? <SignInScreen /> : null}
      </>
    );
  }

  it('hiện banner thành công khi có cờ, và chỉ MỘT lần (mở lại màn thì không còn)', async () => {
    await renderWithProviders(<Harness />);
    await fireEvent.press(screen.getByTestId('seed'));
    await fireEvent.press(screen.getByTestId('toggle'));
    const banner = screen.getByTestId('signin-reset-success');
    expect(banner.props.accessibilityRole).toBe('alert');
    expect(
      within(banner).getByText(
        'Mật khẩu đã được cập nhật! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('toggle'));
    expect(screen.queryByTestId('signin-reset-success')).toBeNull();
  });

  it('không có cờ thì không có banner', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByTestId('signin-reset-success')).toBeNull();
  });
});

describe('UI-A03 Đăng nhập: Apple/Google', () => {
  it('bấm gọi cổng, không điều hướng, không báo thành công', async () => {
    const fake = createFakeApi();
    await renderWithProviders(<SignInScreen />, { gateways: fake });
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập bằng Apple' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }));
    expect(fake.auth.providerCalls).toEqual(['apple', 'google']);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('bản "chưa kết nối": hiện lỗi thay vì im lặng', async () => {
    await renderWithProviders(<SignInScreen />, { gateways: createUnavailableApi() });
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }));
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
  });

  it('cờ tắt một nhà cung cấp: chỉ còn nút còn lại', async () => {
    mockProviders.mockReturnValue(['google']);
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByRole('button', { name: 'Đăng nhập bằng Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng nhập bằng Google' })).toBeOnTheScreen();
  });

  it('cờ tắt cả hai: ẩn cả nhóm và đường kẻ "Hoặc đăng nhập bằng"', async () => {
    mockProviders.mockReturnValue([]);
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByTestId('signin-social-group')).toBeNull();
    expect(screen.queryByText('Hoặc đăng nhập bằng')).toBeNull();
  });
});
