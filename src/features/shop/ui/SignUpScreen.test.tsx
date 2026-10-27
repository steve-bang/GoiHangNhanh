import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { AppError } from '@/core/errors/app-error';
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
    expect(screen.getByRole('header')).toHaveTextContent(/Tạo tài khoản\s*Đơn Chứng/);
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
    expect(screen.getByText(/Email chưa đúng định dạng/)).toBeOnTheScreen();
    expect(screen.queryByText(/Mật khẩu cần/)).toBeNull();
    await fireEvent.changeText(screen.getByTestId('signup-password'), '1234567');
    expect(screen.getByText(/Mật khẩu cần có ít nhất 8 ký tự/)).toBeOnTheScreen();
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

  it('lỗi từ cổng: hiện thông báo ba phần, không điều hướng, nút mở lại để thử lại', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submitButton());
    expect(
      within(screen.getByTestId('form-error')).getByText(errors.AUTH_NETWORK_ERROR),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(submitButton().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(submitButton());
    expect(screen.queryByTestId('form-error')).toBeNull();
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.createShop);
  });

  it.each(['AUTH_EMAIL_IN_USE', 'AUTH_WEAK_PASSWORD', 'AUTH_SERVICE_UNAVAILABLE'] as const)(
    'mã %s hiện đúng thông báo, mỗi thông báo có ít nhất ba câu',
    async (code) => {
      const fake = createFakeGateways();
      await renderWithProviders(<SignUpScreen />, { gateways: fake });
      await fill(VALID_EMAIL, VALID_PASSWORD);
      fake.auth.failNext(code);
      await fireEvent.press(submitButton());
      const text = errors[code];
      expect(within(screen.getByTestId('form-error')).getByText(text)).toBeOnTheScreen();
      expect(text.split(/(?<=\.)\s+/).length).toBeGreaterThanOrEqual(3);
    },
  );

  it('"email đã dùng" không xác nhận tài khoản có tồn tại', () => {
    const text = errors.AUTH_EMAIL_IN_USE.toLowerCase();
    for (const leak of ['đã được đăng ký', 'đã tồn tại', 'đã có tài khoản', 'đã được sử dụng']) {
      expect(text).not.toContain(leak);
    }
  });

  it('bản "chưa kết nối": báo AUTH_SERVICE_UNAVAILABLE, không điều hướng, không báo đã tạo', async () => {
    await renderWithProviders(<SignUpScreen />, { gateways: createUnavailableGateways() });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(
      within(screen.getByTestId('form-error')).getByText(errors.AUTH_SERVICE_UNAVAILABLE),
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
      within(screen.getByTestId('form-error')).getByText(errors.AUTH_SERVICE_UNAVAILABLE),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('sửa email sau lỗi thì xóa thông báo lỗi', async () => {
    const fake = createFakeGateways({ takenEmails: [VALID_EMAIL] });
    await renderWithProviders(<SignUpScreen />, { gateways: fake });
    await fill(VALID_EMAIL, VALID_PASSWORD);
    await fireEvent.press(submitButton());
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('signup-email'), 'khac@example.com');
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
      within(screen.getByTestId('form-error')).getByText(errors.AUTH_SERVICE_UNAVAILABLE),
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
