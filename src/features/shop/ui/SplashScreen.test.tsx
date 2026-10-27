import { act, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeGateways } from '../data/fake-gateways';
import { createUnavailableGateways } from '../data/unavailable-gateways';
import { SPLASH_MAX_WAIT_MS, SPLASH_MIN_VISIBLE_MS } from '../domain/launch';
import type { Gateways, SessionGateway, SessionState } from '../domain/types';
import { SplashScreen } from './SplashScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

const mockHideNativeSplash = jest.fn();
jest.mock('@/platform/native-splash', () => ({
  holdNativeSplash: jest.fn(),
  hideNativeSplash: () => mockHideNativeSplash() as void,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockWindow = jest.mocked(useWindowDimensions);

/** Cổng với phiên giả: `restore` do bài test điều khiển. */
function gatewaysWith(session: SessionGateway): Gateways {
  return { ...createFakeGateways(), session };
}
const restoring = (state: SessionState, latencyMs = 0): SessionGateway => ({
  restore: () => new Promise((resolve) => setTimeout(() => resolve(state), latencyMs)),
});

beforeEach(() => {
  jest.useFakeTimers();
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
  mockHideNativeSplash.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

describe('UI-A01 Splash: nội dung', () => {
  it('có testID, đủ chữ theo thiết kế đã duyệt, không nút và không chấm phân trang', async () => {
    await renderWithProviders(<SplashScreen />);
    expect(screen.getByTestId('screen-UI-A01')).toBeOnTheScreen();
    const hidden = { includeHiddenElements: true };
    expect(screen.getByText('Đơn Chứng', hidden)).toBeOnTheScreen();
    expect(screen.getByText(/Ghi hình đầy đủ\s*Lưu bằng chứng an tâm/, hidden)).toBeOnTheScreen();
    for (const label of [/Quay video\s*đóng gói/, /Lưu trữ\s*đám mây/, /Quản lý\s*đơn hàng/]) {
      expect(screen.getByText(label, hidden)).toBeOnTheScreen();
    }
    expect(screen.getByText(/Bảo vệ\s*quyền lợi/, hidden)).toBeOnTheScreen();
    expect(screen.getByText(/Mỗi đơn hàng\s*đều xứng đáng được bảo vệ!/, hidden)).toBeOnTheScreen();
    expect(screen.queryAllByRole('button', hidden)).toHaveLength(0);
    expect(screen.queryByTestId('splash-dots', hidden)).toBeNull();
  });

  it('trợ năng: chỉ đọc tên app; mọi thành phần trang trí ẩn khỏi trình đọc màn hình', async () => {
    await renderWithProviders(<SplashScreen />);
    const root = screen.getByTestId('screen-UI-A01');
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe('Đơn Chứng');
    // Không thấy khi truy vấn theo trợ năng (mặc định bỏ qua phần tử bị ẩn): chữ nằm trong khối ẩn.
    expect(screen.queryByText(/Mỗi đơn hàng/)).toBeNull();
    expect(screen.queryByText(/Quay video/)).toBeNull();
    expect(screen.queryByText('Đơn Chứng')).toBeNull();
    for (const id of ['splash-hero', 'splash-wave', 'splash-backdrop', 'splash-logo']) {
      expect(screen.getByTestId(id, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('splash-hero', { includeHiddenElements: true })).not.toBeVisible();
  });

  it('chữ lớn (fontScale 1,3): ẩn hàng tính năng và khẩu hiệu; vẫn có tên app', async () => {
    mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1.3 });
    await renderWithProviders(<SplashScreen />);
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByTestId('splash-features', hidden)).toBeNull();
    expect(screen.queryByTestId('splash-tagline', hidden)).toBeNull();
    expect(screen.getByTestId('splash-wordmark', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('splash-logo', hidden)).toBeOnTheScreen();
  });

  it('màn rất thấp (320x568): vẫn có khiên + tên app; không có hàng tính năng', async () => {
    mockWindow.mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });
    await renderWithProviders(<SplashScreen />);
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('splash-logo', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('splash-wordmark', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('splash-features', hidden)).toBeNull();
  });

  it('chữ thật có giới hạn phóng (không khóa allowFontScaling)', async () => {
    await renderWithProviders(<SplashScreen />);
    const wordmark = screen.getByTestId('splash-wordmark', { includeHiddenElements: true });
    expect(wordmark.props.maxFontSizeMultiplier).toBeGreaterThan(1);
    expect(wordmark.props.allowFontScaling).not.toBe(false);
  });
});

describe('UI-A01 Splash: ẩn splash hệ điều hành', () => {
  it('ẩn khi gỡ màn (luôn ẩn, kể cả khi ảnh chưa báo tải xong)', async () => {
    const { unmount } = await renderWithProviders(<SplashScreen />);
    await unmount();
    expect(mockHideNativeSplash).toHaveBeenCalled();
  });
});

describe('UI-A01 Splash: thời gian và điều hướng', () => {
  it('cổng nhanh: chờ đủ thời gian tối thiểu rồi mới chuyển', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
  });

  it.each([
    ['signed_out', ROUTES.welcome],
    ['signed_in_no_shop', ROUTES.createShop],
    ['signed_in', ROUTES.home],
  ] as const)('phiên %s -> %s', async (state, route) => {
    await renderWithProviders(<SplashScreen />, { gateways: gatewaysWith(restoring(state)) });
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledWith(route);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('cổng chậm hơn thời gian tối thiểu nhưng trước hạn: chuyển ngay khi cổng xong', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in_no_shop', 2500)),
    });
    await advance(2499);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.createShop);
  });

  it('cổng quá chậm: đến hạn tối đa thì coi như chưa đăng nhập, đi Chào mừng, chỉ một lần', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in', 60_000)),
    });
    await advance(SPLASH_MAX_WAIT_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
    // Cổng trả muộn sau hạn không được kéo thêm lần chuyển nào, và không chuyển "đã đăng nhập".
    await advance(60_000);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
  });

  it('cổng lỗi: coi như chưa đăng nhập, đi Chào mừng sau thời gian tối thiểu (không báo thành công)', async () => {
    const gateways = createFakeGateways({ sessionFails: true });
    await renderWithProviders(<SplashScreen />, { gateways });
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('cổng ném lỗi đồng bộ hoặc trả giá trị lạ: cũng là chưa đăng nhập', async () => {
    const throwing: SessionGateway = {
      restore: () => {
        throw new Error('boom');
      },
    };
    await renderWithProviders(<SplashScreen />, { gateways: gatewaysWith(throwing) });
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);

    mockNavigation.reset.mockReset();
    const weird = { restore: () => Promise.resolve('admin' as unknown as SessionState) };
    await renderWithProviders(<SplashScreen />, { gateways: gatewaysWith(weird) });
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('cổng "chưa kết nối" (bản build thường) không bao giờ đưa vào Tổng quan', async () => {
    await renderWithProviders(<SplashScreen />, { gateways: createUnavailableGateways() });
    await advance(SPLASH_MAX_WAIT_MS + 1000);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('gỡ màn trước hạn: không chuyển hướng muộn và không để timer chạy', async () => {
    const { unmount } = await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await unmount();
    await advance(SPLASH_MAX_WAIT_MS * 2);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
