import { StrictMode, useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeGateways } from '../data/fake-gateways';
import { createUnavailableGateways } from '../data/unavailable-gateways';
import {
  SPLASH_HERO_MAX_WAIT_MS,
  SPLASH_MAX_WAIT_MS,
  SPLASH_MIN_VISIBLE_MS,
} from '../domain/launch';
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

/** Ảnh minh họa tải xong (Jest không tự bắn onLoad): Splash của app "thật sự hiện" từ lúc này. */
const heroImage = () => screen.getByTestId('splash-hero-image', { includeHiddenElements: true });
const settleHero = async (event: 'load' | 'error' = 'load') => {
  await act(async () => {
    fireEvent(heroImage(), event);
  });
};

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

describe('UI-A01 Splash: ẩn splash hệ điều hành theo ảnh', () => {
  it('chưa ẩn khi ảnh chưa xong; onLoad thì ẩn', async () => {
    await renderWithProviders(<SplashScreen />);
    expect(mockHideNativeSplash).not.toHaveBeenCalled();
    await settleHero();
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it('onError của ảnh cũng ẩn (không treo splash hệ điều hành)', async () => {
    await renderWithProviders(<SplashScreen />);
    await settleHero('error');
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it('ảnh chưa xong mà bố cục đổi nhưng vẫn cần ảnh (xoay/đổi cỡ chữ): không ẩn splash hệ điều hành', async () => {
    let rerenderSplash: () => void = () => undefined;
    function Host() {
      const [, setTick] = useState(0);
      rerenderSplash = () => setTick((n) => n + 1);
      return <SplashScreen />;
    }
    await renderWithProviders(<Host />);
    for (const size of [
      { width: 390, height: 900, scale: 3, fontScale: 1.1 },
      { width: 412, height: 915, scale: 3, fontScale: 1 },
    ]) {
      mockWindow.mockReturnValue(size);
      await act(async () => {
        rerenderSplash();
      });
      expect(screen.getByTestId('splash-hero', { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(mockHideNativeSplash).not.toHaveBeenCalled();
    await settleHero();
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it('ảnh chưa xong, bố cục đổi sang không cần ảnh: coi như sẵn sàng, ẩn đúng một lần', async () => {
    let rerenderSplash: () => void = () => undefined;
    function Host() {
      const [, setTick] = useState(0);
      rerenderSplash = () => setTick((n) => n + 1);
      return <SplashScreen />;
    }
    await renderWithProviders(<Host />);
    expect(mockHideNativeSplash).not.toHaveBeenCalled();
    mockWindow.mockReturnValue({ width: 844, height: 200, scale: 3, fontScale: 1 });
    await act(async () => {
      rerenderSplash();
    });
    expect(screen.queryByTestId('splash-hero', { includeHiddenElements: true })).toBeNull();
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
    mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    await act(async () => {
      rerenderSplash();
    });
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it('bố cục không cần ảnh ngay từ đầu: coi như sẵn sàng, ẩn ngay', async () => {
    mockWindow.mockReturnValue({ width: 844, height: 200, scale: 3, fontScale: 1 });
    await renderWithProviders(<SplashScreen />);
    expect(screen.queryByTestId('splash-hero', { includeHiddenElements: true })).toBeNull();
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it('gỡ màn thì ẩn; quá hạn bảo hiểm thì coi như đã hiện và ẩn', async () => {
    await renderWithProviders(<SplashScreen />);
    await advance(SPLASH_HERO_MAX_WAIT_MS - 1);
    expect(mockHideNativeSplash).not.toHaveBeenCalled();
    await advance(1);
    expect(mockHideNativeSplash).toHaveBeenCalledTimes(1);
  });
});

describe('UI-A01 Splash: thời gian và điều hướng', () => {
  it('cổng nhanh: chờ đủ thời gian tối thiểu rồi mới chuyển', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await settleHero();
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
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledWith(route);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('cổng chậm hơn thời gian tối thiểu nhưng trước hạn: chuyển ngay khi cổng xong', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in_no_shop', 2500)),
    });
    await settleHero();
    await advance(2499);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.createShop);
  });

  it('cổng quá chậm: đến hạn tối đa thì coi như chưa đăng nhập, đi Chào mừng, chỉ một lần', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in', 60_000)),
    });
    await settleHero();
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
    await settleHero();
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
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);

    mockNavigation.reset.mockReset();
    const weird = { restore: () => Promise.resolve('admin' as unknown as SessionState) };
    await renderWithProviders(<SplashScreen />, { gateways: gatewaysWith(weird) });
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('cổng "chưa kết nối" (bản build thường) không bao giờ đưa vào Tổng quan', async () => {
    await renderWithProviders(<SplashScreen />, { gateways: createUnavailableGateways() });
    await settleHero();
    await advance(SPLASH_MAX_WAIT_MS + 1000);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('gỡ màn trước hạn: không chuyển hướng muộn và không để timer chạy', async () => {
    const { unmount } = await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await settleHero();
    await unmount();
    await advance(SPLASH_MAX_WAIT_MS * 2);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('UI-A01 Splash: thời gian hiển thị tính từ lúc Splash của app thật sự hiện', () => {
  it('(a) ảnh chậm 1,5 s: không chuyển sớm hơn lúc hiện + 2 s dù phiên đã xong từ đầu', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await advance(1500);
    await settleHero();
    // Mốc cũ (2 s kể từ mở app) đã qua từ lâu nhưng người dùng mới thấy Splash được 0,5 s.
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
  });

  it('(b) ảnh nhanh + cổng nhanh: đúng 2 s', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in', 100)),
    });
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
  });

  it('(c1) cổng chậm, ảnh nhanh: theo hạn 3 s kể từ mở app, về Chào mừng', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in', 60_000)),
    });
    await settleHero();
    await advance(SPLASH_MAX_WAIT_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('(c2) cổng chậm, ảnh hiện lúc 1,5 s: quá hạn 3 s nhưng chưa đủ 2 s hiển thị thì chờ tiếp', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in', 60_000)),
    });
    await advance(1500);
    await settleHero();
    await advance(SPLASH_MAX_WAIT_MS - 1500 + 400); // đã qua hạn 3 s, mới hiện 1,9 s
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(100); // hiện đủ 2 s
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('(c3) cổng lỗi, ảnh hiện lúc 1,5 s: về Chào mừng, không sớm hơn lúc hiện + 2 s', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: createFakeGateways({ sessionFails: true }),
    });
    await advance(1500);
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('(c4) kết quả phiên đến sau hạn 3 s bị bỏ, kể cả khi Splash còn đang đợi đủ 2 s', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in', 3200)),
    });
    await advance(2900);
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('ảnh không bao giờ xong: đường bảo hiểm coi như đã hiện, rồi hiện đủ 2 s mới chuyển', async () => {
    await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await advance(SPLASH_HERO_MAX_WAIT_MS); // bảo hiểm: coi như đã hiện (React cập nhật khi act kết thúc)
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
  });

  it('(d) StrictMode: effect chạy hai lần (restore gọi hai lần) vẫn chỉ chuyển một lần, không rò timer', async () => {
    const restore = jest.fn(() => Promise.resolve<SessionState>('signed_in'));
    await renderWithProviders(
      <StrictMode>
        <SplashScreen />
      </StrictMode>,
      { gateways: gatewaysWith({ restore }) },
    );
    await settleHero();
    expect(restore.mock.calls.length).toBeGreaterThanOrEqual(1);
    await advance(SPLASH_MIN_VISIBLE_MS - 1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await advance(SPLASH_MAX_WAIT_MS * 3);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('(e) gỡ màn khi đang chờ (trước hoặc sau khi ảnh xong): không chuyển, không còn timer', async () => {
    const before = await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await before.unmount();
    await advance(SPLASH_HERO_MAX_WAIT_MS * 2);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    const after = await renderWithProviders(<SplashScreen />, {
      gateways: gatewaysWith(restoring('signed_in')),
    });
    await settleHero();
    await advance(SPLASH_MIN_VISIBLE_MS - 500);
    await after.unmount();
    await advance(SPLASH_HERO_MAX_WAIT_MS * 2);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
