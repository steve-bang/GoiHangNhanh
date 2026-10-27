import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { colors } from '@/core/theme';
import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeGateways } from '../data/fake-gateways';
import { createUnavailableGateways } from '../data/unavailable-gateways';
import type { AuthAccount, Gateways } from '../domain/types';
import { SignUpScreen } from './SignUpScreen';

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
/** Thông báo hai câu gồm `title` (in đậm) + `hint`; một câu chỉ có chuỗi. */
const fullText = (m: string | { title: string; hint: string }) =>
  typeof m === 'string' ? m : `${m.title} ${m.hint}`;

type Tree = { [key: string]: string | Tree };
/** Chỉ các giá trị chữ (hiển thị cho người dùng), không gồm tên khóa. */
function flattenValues(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : flattenValues(v)));
}
const VALID_EMAIL = 'shop@example.com';
const VALID_PASSWORD = 'matkhau-du-dai';

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
  mockProviders.mockReset().mockReturnValue(['apple', 'google']);
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('signup-email'), email);
  await fireEvent.changeText(screen.getByTestId('signup-password'), password);
}

const submitButton = () => screen.getByTestId('signup-submit');

/** Cổng có lời gọi treo để kiểm tra trạng thái "đang xử lý" và chống bấm đúp. */
function pendingGateways() {
  let resolve: (account: AuthAccount) => void = () => undefined;
  const signUpWithEmail = jest.fn(
    () =>
      new Promise<AuthAccount>((r) => {
        resolve = r;
      }),
  );
  const fake = createFakeGateways();
  const gateways: Gateways = {
    auth: { signUpWithEmail, signInWithProvider: fake.auth.signInWithProvider.bind(fake.auth) },
    shop: fake.shop,
  };
  return { gateways, signUpWithEmail, resolve: (account: AuthAccount) => resolve(account) };
}

describe('UI-A03 Tạo tài khoản: giao diện', () => {
  it('hiện tiêu đề, dòng phụ, hai ô, nút chính, nhóm social, liên kết đăng nhập, hình và nút quay lại', async () => {
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByTestId('screen-UI-A03')).toBeOnTheScreen();
    // toHaveTextContent gộp khoảng trắng nên không thấy U+00A0: so sánh chuỗi gốc
    expect(screen.getByRole('header').props.children).toBe('Tạo tài khoản\nĐơn\u00a0Chứng');
    expect(
      screen.getByText('Bắt đầu hành trình bảo vệ đơn hàng của bạn chỉ trong vài phút!'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Email của bạn')).toBeOnTheScreen();
    expect(screen.getByText('Mật khẩu')).toBeOnTheScreen();
    expect(submitButton()).toBeOnTheScreen();
    expect(screen.getByText('Hoặc đăng ký với')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng ký với Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng ký với Google' })).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã có tài khoản?')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeOnTheScreen();
    expect(
      screen.getByTestId('signup-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('màn thấp 320x568: ẩn hình nhưng vẫn đủ trường, nút chính và liên kết', async () => {
    mockWindow.mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });
    await renderWithProviders(<SignUpScreen />);
    expect(screen.queryByTestId('signup-illustration', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('signup-email')).toBeOnTheScreen();
    expect(submitButton()).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeOnTheScreen();
  });

  it('thuộc tính ô nhập đúng cho bàn phím và trình quản lý mật khẩu', async () => {
    await renderWithProviders(<SignUpScreen />);
    const email = screen.getByTestId('signup-email');
    expect(email.props.keyboardType).toBe('email-address');
    expect(email.props.autoCapitalize).toBe('none');
    expect(email.props.autoComplete).toBe('email');
    expect(email.props.textContentType).toBe('emailAddress');
    expect(email.props.returnKeyType).toBe('next');
    const password = screen.getByTestId('signup-password');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('new-password');
    expect(password.props.textContentType).toBe('newPassword');
    expect(password.props.returnKeyType).toBe('go');
  });

  it('nút hiện/ẩn mật khẩu có nhãn truy cập và đổi trạng thái', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByTestId('signup-password').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(screen.getByTestId('signup-password').props.secureTextEntry).toBe(true);
  });

  it('"Đăng nhập" mở /sign-in; nút quay lại gọi back', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Đăng nhập' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.signIn);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });
});

describe('UI-A03 Tạo tài khoản: kiểm tra dữ liệu', () => {
  it('mới mở màn: không có lỗi nào', async () => {
    await renderWithProviders(<SignUpScreen />);
    expect(screen.queryByText(/Email chưa đúng/)).toBeNull();
    expect(screen.queryByText(/Mật khẩu cần/)).toBeNull();
    expect(screen.queryByText(/Hãy nhập/)).toBeNull();
  });

  it('hiện lỗi từng ô ngay khi nhập; sửa đúng thì lỗi biến mất', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'abc');
    expect(screen.getByText('Email chưa đúng. Ví dụ: ten@cuahang.com')).toBeOnTheScreen();
    expect(screen.queryByText(/Mật khẩu cần/)).toBeNull();
    await fireEvent.changeText(screen.getByTestId('signup-password'), '1234567');
    expect(screen.getByText('Mật khẩu cần ít nhất 8 ký tự.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('signup-email'), VALID_EMAIL);
    await fireEvent.changeText(screen.getByTestId('signup-password'), '12345678');
    expect(screen.queryByText(/Email chưa đúng/)).toBeNull();
    expect(screen.queryByText(/Mật khẩu cần/)).toBeNull();
  });

  it('rời ô khi còn trống (chạm rồi bỏ) thì báo cần nhập', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent(screen.getByTestId('signup-email'), 'blur');
    expect(screen.getByText('Hãy nhập email của bạn.')).toBeOnTheScreen();
  });

  it('bấm Tạo tài khoản khi dữ liệu sai: hiện lỗi cả hai ô và KHÔNG gọi cổng', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fireEvent.press(submitButton());
    expect(screen.getByText('Hãy nhập email của bạn.')).toBeOnTheScreen();
    expect(screen.getByText('Hãy nhập mật khẩu.')).toBeOnTheScreen();
    expect(fake.auth.signUpCalls).toHaveLength(0);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});

describe('UI-A03 Tạo tài khoản: gửi và trạng thái xử lý', () => {
  it('thành công: gọi cổng với email đã bỏ khoảng trắng rồi sang /create-shop', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(`  ${VALID_EMAIL} `, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(fake.auth.signUpCalls).toEqual([{ email: VALID_EMAIL, password: VALID_PASSWORD }]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.createShop);
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('phím Return ở ô mật khẩu gửi form', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent(screen.getByTestId('signup-password'), 'submitEditing');
    expect(fake.auth.signUpCalls).toHaveLength(1);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.createShop);
  });

  it('đang xử lý: nút khóa; bấm đúp chỉ gọi cổng một lần; xong thì sang bước sau', async () => {
    const { gateways, signUpWithEmail, resolve } = pendingGateways();
    await renderWithProviders(<SignUpScreen />, { gateways });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    await fireEvent.press(submitButton());
    await fireEvent(screen.getByTestId('signup-password'), 'submitEditing');
    expect(signUpWithEmail).toHaveBeenCalledTimes(1);
    expect(submitButton().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ uid: 'u1', email: VALID_EMAIL, emailVerified: false });
    });
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.createShop);
    expect(submitButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('lỗi mạng: khung phía trên nút chính, câu đầu in đậm, có Thử lại; giữ nguyên giá trị đã nhập', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submitButton());
    const banner = screen.getByTestId('form-error');
    expect(banner.props.accessibilityRole).toBe('alert');
    expect(banner.props.accessibilityLiveRegion).toBe('assertive');
    expect(within(banner).getByText(fullText(errors.AUTH_NETWORK_ERROR))).toBeOnTheScreen();
    expect(within(banner).getByText('Mất kết nối mạng.').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontWeight: '700' })]),
    );
    expect(within(banner).getByRole('button', { name: 'Thử lại' })).toBeOnTheScreen();
    // không phải lỗi theo ô
    expect(screen.queryByTestId('signup-email-error')).toBeNull();
    expect(screen.queryByTestId('signup-password-error')).toBeNull();
    // giữ nguyên dữ liệu
    expect(screen.getByTestId('signup-email').props.value).toBe(VALID_EMAIL);
    expect(screen.getByTestId('signup-password').props.value).toBe(VALID_PASSWORD);
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(submitButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('Thử lại gửi lại đúng yêu cầu (cùng email, mật khẩu) rồi sang bước sau', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submitButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    // lần đầu lỗi + lần Thử lại: hai lời gọi, cùng dữ liệu
    const same = { email: VALID_EMAIL, password: VALID_PASSWORD };
    expect(fake.auth.signUpCalls).toEqual([same, same]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.createShop);
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('Thử lại chống bấm đúp: chỉ một lần gọi cổng khi đang xử lý', async () => {
    const signUpWithEmail = jest
      .fn<Promise<AuthAccount>, [unknown]>()
      .mockRejectedValueOnce(new AppError('AUTH_SERVICE_UNAVAILABLE'))
      .mockImplementation(() => new Promise<AuthAccount>(() => undefined));
    const fake = createFakeGateways();
    const gateways: Gateways = {
      shop: fake.shop,
      auth: { signUpWithEmail, signInWithProvider: () => Promise.resolve() },
    };
    await renderWithProviders(<SignUpScreen />, { gateways });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(signUpWithEmail).toHaveBeenCalledTimes(1);
    const retry = screen.getByRole('button', { name: 'Thử lại' });
    await fireEvent.press(retry);
    await fireEvent.press(retry);
    await fireEvent.press(submitButton());
    expect(signUpWithEmail).toHaveBeenCalledTimes(2);
  });

  it('hệ thống bận: khung phía trên nút chính, có Thử lại', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    fake.auth.failNext('AUTH_SERVICE_UNAVAILABLE');
    await fireEvent.press(submitButton());
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText('Hệ thống đang bận. Bạn thử lại sau ít phút nhé.'),
    ).toBeOnTheScreen();
    expect(within(banner).getByRole('button', { name: 'Thử lại' })).toBeOnTheScreen();
  });

  it('email đã dùng: lỗi nằm DƯỚI ô Email (không phải khung chung), có nút Đăng nhập mở /sign-in', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    fake.auth.failNext('AUTH_EMAIL_IN_USE');
    await fireEvent.press(submitButton());
    expect(screen.queryByTestId('form-error')).toBeNull();
    expect(screen.queryByTestId('signup-password-error')).toBeNull();
    const error = screen.getByTestId('signup-email-error');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(within(error).getByText('Email này đã có tài khoản.')).toBeOnTheScreen();
    await fireEvent.press(within(error).getByRole('button', { name: 'Đăng nhập' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.signIn);
    // giữ nguyên dữ liệu đã nhập
    expect(screen.getByTestId('signup-email').props.value).toBe(VALID_EMAIL);
    expect(screen.getByTestId('signup-password').props.value).toBe(VALID_PASSWORD);
  });

  it('mật khẩu yếu: lỗi nằm DƯỚI ô Mật khẩu, không có nút; mất khi sửa mật khẩu, giữ email', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    fake.auth.failNext('AUTH_WEAK_PASSWORD');
    await fireEvent.press(submitButton());
    expect(screen.queryByTestId('form-error')).toBeNull();
    expect(screen.queryByTestId('signup-email-error')).toBeNull();
    const error = screen.getByTestId('signup-password-error');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(within(error).getByText(errors.AUTH_WEAK_PASSWORD as string)).toBeOnTheScreen();
    expect(within(error).queryByRole('button')).toBeNull();
    expect(screen.getByTestId('signup-email').props.value).toBe(VALID_EMAIL);
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'khac@example.com');
    expect(screen.getByTestId('signup-password-error')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('signup-password'), 'mat-khau-moi-9');
    expect(screen.queryByTestId('signup-password-error')).toBeNull();
  });

  it('lỗi theo ô dùng chữ tối + biểu tượng cảnh báo, viền ô đổi đỏ', async () => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'abc');
    const error = screen.getByTestId('signup-email-error');
    expect(within(error).getByText('Email chưa đúng. Ví dụ: ten@cuahang.com')).toBeOnTheScreen();
    expect(error.props.accessibilityRole).toBe('alert');
    const text = within(error).getByText('Email chưa đúng. Ví dụ: ten@cuahang.com');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: colors.ink });
  });

  it.each([
    ['mật khẩu quá ngắn', '1234567', 'signup-password-error', 'Mật khẩu cần ít nhất 8 ký tự.'],
  ])('%s hiện dưới ô Mật khẩu', async (_n, value, testID, text) => {
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('signup-password'), value);
    expect(within(screen.getByTestId(testID)).getByText(text)).toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('bản "chưa kết nối": báo AUTH_SERVICE_UNAVAILABLE, không điều hướng, không báo đã tạo', async () => {
    await renderWithProviders(<SignUpScreen />, { gateways: createUnavailableGateways() });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('lỗi không rõ (không phải AppError) cũng coi là chưa kết nối, không báo thành công', async () => {
    const fake = createFakeGateways();
    const gateways: Gateways = {
      shop: fake.shop,
      auth: {
        signInWithProvider: () => Promise.resolve(),
        signUpWithEmail: () => Promise.reject(new Error('boom')),
      },
    };
    await renderWithProviders(<SignUpScreen />, { gateways });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('sửa email sau lỗi "đã có tài khoản" thì lỗi mất; lỗi chung mất khi sửa bất kỳ ô nào', async () => {
    const fake = createFakeGateways({ takenEmails: [VALID_EMAIL] });
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(screen.getByTestId('signup-email-error')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'khac@example.com');
    expect(screen.queryByTestId('signup-email-error')).toBeNull();
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submitButton());
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('signup-password'), 'mat-khau-khac-1');
    expect(screen.queryByTestId('form-error')).toBeNull();
  });
});

describe('UI-A03 Tạo tài khoản: đăng ký với Apple/Google', () => {
  it('bấm gọi cổng, không điều hướng, không báo thành công', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng ký với Apple' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng ký với Google' }));
    expect(fake.auth.providerCalls).toEqual(['apple', 'google']);
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('bản "chưa kết nối": hiện lỗi chưa kết nối thay vì im lặng', async () => {
    await renderWithProviders(<SignUpScreen />, { gateways: createUnavailableGateways() });
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng ký với Google' }));
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('cờ tắt một nhà cung cấp: chỉ còn nút còn lại', async () => {
    mockProviders.mockReturnValue(['google']);
    await renderWithProviders(<SignUpScreen />);
    expect(screen.queryByRole('button', { name: 'Đăng ký với Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng ký với Google' })).toBeOnTheScreen();
    expect(screen.getByText('Hoặc đăng ký với')).toBeOnTheScreen();
  });

  it('cờ tắt cả hai: ẩn nhóm social và đường kẻ "Hoặc đăng ký với"', async () => {
    mockProviders.mockReturnValue([]);
    await renderWithProviders(<SignUpScreen />);
    expect(screen.queryByTestId('signup-social-group')).toBeNull();
    expect(screen.queryByText('Hoặc đăng ký với')).toBeNull();
    expect(submitButton()).toBeOnTheScreen();
  });
});

describe('UI-A03 Tạo tài khoản: câu chữ', () => {
  it('không có chữ tạm/placeholder/minh họa và không hứa quá mức', () => {
    const text = JSON.stringify(flattenValues(resources.vi.screens.signUp)).toLowerCase();
    for (const word of ['tạm', 'placeholder', 'minh họa', 'giữ chỗ', 'tuyệt đối', 'đảm bảo']) {
      expect(text).not.toContain(word);
    }
  });

  it('tạo lỗi AppError có mã được khai báo', () => {
    expect(new AppError('AUTH_EMAIL_IN_USE').code).toBe('AUTH_EMAIL_IN_USE');
  });
});
