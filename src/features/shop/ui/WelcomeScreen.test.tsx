import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking, useWindowDimensions } from 'react-native';

import { LEGAL_LINKS } from '@/core/config/legal-links';
import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { WelcomeScreen } from './WelcomeScreen';

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

const mockSignInWithProvider = jest.fn();
jest.mock('../data/auth-gateway', () => ({
  signInWithProvider: (provider: string) => mockSignInWithProvider(provider) as Promise<void>,
}));

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
  mockProviders.mockReset().mockReturnValue(['apple', 'google']);
  mockSignInWithProvider.mockReset().mockResolvedValue(undefined);
});

describe('UI-A02 Chào mừng', () => {
  it('hiện tiêu đề, dòng phụ, hai nút, nhóm social và hai liên kết', async () => {
    await renderWithProviders(<WelcomeScreen />);
    expect(screen.getByTestId('screen-UI-A02')).toBeOnTheScreen();
    expect(screen.getByText('Đơn chứng')).toBeOnTheScreen();
    expect(screen.getByText(/Bảo vệ bằng chứng\s*cho từng đơn hàng/)).toBeOnTheScreen();
    expect(
      screen.getByText('Ghi hình đầy đủ – Lưu trữ an toàn – An tâm kinh doanh'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeOnTheScreen();
    expect(screen.getByText('Hoặc đăng nhập với')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng nhập với Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Đăng nhập với Google' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Điều khoản sử dụng' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Chính sách quyền riêng tư' })).toBeOnTheScreen();
  });

  it('hình minh họa ẩn khỏi trình đọc màn hình', async () => {
    await renderWithProviders(<WelcomeScreen />);
    const illustration = screen.getByTestId('welcome-illustration', {
      includeHiddenElements: true,
    });
    expect(illustration.props.accessibilityElementsHidden).toBe(true);
  });

  it('màn thấp 320x568: không có hình nhưng vẫn đủ nút, social và dòng pháp lý', async () => {
    mockWindow.mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });
    await renderWithProviders(<WelcomeScreen />);
    expect(
      screen.queryByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Chính sách quyền riêng tư' })).toBeOnTheScreen();
  });

  it('Đăng nhập và Tạo tài khoản điều hướng đúng route', async () => {
    await renderWithProviders(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.signIn);
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.signUp);
  });

  it('nút social gọi cổng xác thực, không điều hướng, không báo thành công', async () => {
    await renderWithProviders(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập với Apple' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập với Google' }));
    expect(mockSignInWithProvider.mock.calls).toEqual([['apple'], ['google']]);
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('cờ tắt một nhà cung cấp: chỉ còn nút còn lại', async () => {
    mockProviders.mockReturnValue(['google']);
    await renderWithProviders(<WelcomeScreen />);
    expect(screen.queryByRole('button', { name: 'Đăng nhập với Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng nhập với Google' })).toBeOnTheScreen();
    expect(screen.getByText('Hoặc đăng nhập với')).toBeOnTheScreen();
  });

  it('cờ tắt cả hai: ẩn nhóm social và đường kẻ "Hoặc đăng nhập với"', async () => {
    mockProviders.mockReturnValue([]);
    await renderWithProviders(<WelcomeScreen />);
    expect(screen.queryByTestId('welcome-social-group')).toBeNull();
    expect(screen.queryByText('Hoặc đăng nhập với')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeOnTheScreen();
  });

  it('bấm liên kết pháp lý mở đúng URL cấu hình', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithProviders(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Điều khoản sử dụng' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Chính sách quyền riêng tư' }));
    expect(open.mock.calls).toEqual([[LEGAL_LINKS.terms], [LEGAL_LINKS.privacy]]);
    open.mockRestore();
  });

  it('mở liên kết lỗi không làm văng exception', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderWithProviders(<WelcomeScreen />);
    await expect(
      fireEvent.press(screen.getByRole('link', { name: 'Điều khoản sử dụng' })),
    ).resolves.not.toThrow();
    await act(async () => {
      await Promise.resolve();
    });
    expect(open).toHaveBeenCalledTimes(1);
    open.mockRestore();
    warn.mockRestore();
  });

  it('URL pháp lý giữ chỗ dùng tên miền .invalid', () => {
    for (const url of Object.values(LEGAL_LINKS))
      expect(new URL(url).hostname).toMatch(/\.invalid$/);
  });

  it('chuỗi màn Chào mừng không chứa chữ tạm/placeholder/minh họa', () => {
    const text = JSON.stringify(resources.vi.screens.welcome).toLowerCase();
    for (const word of ['tạm', 'placeholder', 'minh họa', 'giữ chỗ']) {
      expect(text).not.toContain(word);
    }
  });
});
