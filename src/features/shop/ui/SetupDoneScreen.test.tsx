import { fireEvent, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import type { OnboardingAction } from '../domain/onboarding-flow';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { SetupDoneScreen } from './SetupDoneScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockWindow = jest.mocked(useWindowDimensions);

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
});

/** Nạp trạng thái luồng như thể người dùng đã đi qua các bước trước. */
function Seed({ actions, children }: { actions: OnboardingAction[]; children: ReactNode }) {
  const { dispatch } = useOnboardingFlow();
  useEffect(() => {
    actions.forEach(dispatch);
  }, [actions, dispatch]);
  return <>{children}</>;
}

const SHOP_ACTIONS: OnboardingAction[] = [
  {
    type: 'shop_created',
    shop: { id: 's1', name: 'Shop Minh Anh', sellingSources: ['shopee', 'tiktok_shop'] },
  },
];

async function renderDone(actions: OnboardingAction[] = SHOP_ACTIONS) {
  await renderWithProviders(
    <Seed actions={actions}>
      <SetupDoneScreen />
    </Seed>,
  );
}

describe('UI-A06 Hoàn tất thiết lập', () => {
  it('hiện tiêu đề hai mức, dòng phụ đúng câu chữ, hình và nút', async () => {
    await renderDone();
    expect(screen.getByTestId('screen-UI-A06')).toBeOnTheScreen();
    expect(screen.getByText('Tuyệt vời!')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã sẵn sàng sử dụng Đơn\u00a0Chứng')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Cảm ơn bạn đã hoàn tất thiết lập. Giờ đây bạn có thể bắt đầu ghi hình và bảo vệ đơn hàng của mình.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bắt đầu sử dụng' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Xem hướng dẫn nhanh' })).toBeOnTheScreen();
    expect(
      screen.getByTestId('setup-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('thẻ tóm tắt chỉ có 2 hàng: Shop của bạn và Nguồn bán; giá trị lấy từ shop đã tạo', async () => {
    await renderDone();
    expect(screen.getByText('Shop của bạn')).toBeOnTheScreen();
    expect(screen.getByText('Shop Minh Anh')).toBeOnTheScreen();
    expect(screen.getByText('Nguồn bán')).toBeOnTheScreen();
    expect(screen.getByText('Shopee, TikTok Shop')).toBeOnTheScreen();
    expect(screen.getByTestId('summary-shop')).toBeOnTheScreen();
    expect(screen.getByTestId('summary-sources')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^summary-/)).toHaveLength(2);
  });

  it('KHÔNG hiện hàng "Gói dịch vụ" hay tên gói/thời hạn nào', async () => {
    await renderDone();
    expect(screen.queryByText(/Gói/)).toBeNull();
    expect(screen.queryByText(/Tiêu chuẩn/)).toBeNull();
    expect(screen.queryByText(/ngày/)).toBeNull();
    expect(screen.queryByText(/dịch vụ/i)).toBeNull();
  });

  it('không chọn nguồn bán nào: hiện chữ trung tính "Chưa chọn"', async () => {
    await renderDone([
      { type: 'shop_created', shop: { id: 's1', name: 'Shop A', sellingSources: [] } },
    ]);
    expect(screen.getByText('Chưa chọn')).toBeOnTheScreen();
  });

  it('chưa có tên shop (vào thẳng màn này): chữ trung tính, không bịa tên', async () => {
    await renderDone([]);
    expect(screen.getByText('Chưa có tên shop')).toBeOnTheScreen();
  });

  it('hai hàng dẫn tới Cài đặt shop (UI-I02)', async () => {
    await renderDone();
    await fireEvent.press(screen.getByTestId('summary-shop'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.shopSettings);
    await fireEvent.press(screen.getByTestId('summary-sources'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.shopSettings);
    expect(ROUTES.shopSettings.code).toBe('UI-I02');
  });

  it('"Xem hướng dẫn nhanh" dẫn tới Trợ giúp (UI-I06)', async () => {
    await renderDone();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem hướng dẫn nhanh' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.help);
    expect(ROUTES.help.code).toBe('UI-I06');
  });

  it('"Bắt đầu sử dụng" gỡ chặn rời màn rồi đặt lại điều hướng về Tổng quan', async () => {
    await renderDone();
    await fireEvent.press(screen.getByRole('button', { name: 'Bắt đầu sử dụng' }));
    expect(mockNavigation.allowLeave).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('không có nút Back; Back hệ thống bị chặn (rời màn chỉ qua "Bắt đầu sử dụng")', async () => {
    await renderDone();
    expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull();
    expect(mockNavigation.leaveGuardEnabled).toBe(true);
    expect(mockNavigation.back).not.toHaveBeenCalled();
  });

  it('màn thấp 320x568 ẩn hình nhưng vẫn đủ tiêu đề, thẻ và nút', async () => {
    mockWindow.mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });
    await renderDone();
    expect(screen.queryByTestId('setup-illustration', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Tuyệt vời!')).toBeOnTheScreen();
    expect(screen.getByTestId('summary-sources')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bắt đầu sử dụng' })).toBeOnTheScreen();
  });

  it('câu chữ sạch: không chữ tạm/minh họa, không hứa quá mức', () => {
    const values: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === 'string') values.push(node);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(resources.vi.screens.setupDone);
    const text = values.join(' ').toLowerCase();
    for (const word of ['tạm', 'placeholder', 'minh họa', 'giữ chỗ', 'tuyệt đối', 'gói']) {
      expect(text).not.toContain(word);
    }
  });
});
