import { fireEvent, screen } from '@testing-library/react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { PaymentHistoryScreen } from './PaymentHistoryScreen';
import { PlanDetailScreen } from './PlanDetailScreen';
import { PlanScreen } from './PlanScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

/** Gói/giá/hạn/quyền lợi bịa mà board 07 vẽ nhưng app không có cơ sở (D2, D3, D4; bất biến 6, 9, 11). */
const INVENTED =
  /Gói tiêu chuẩn|Đang hoạt động|24\/7|Hỗ trợ|Đối chiếu|₫|đ\/|\bGB\b|\d{2,}\s*(ngày|tháng)/i;

describe('PlanScreen (UI-H01, khung 8)', () => {
  it('tên gói và hạn "Chưa có thông tin", huy hiệu "Sắp có", không gói/trạng thái/quyền lợi bịa', async () => {
    await renderWithProviders(<PlanScreen />);
    expect(screen.getByTestId('plan-name')).toHaveTextContent('Chưa có thông tin');
    expect(screen.getByTestId('plan-status')).toHaveTextContent('Sắp có');
    expect(screen.getByTestId('plan-retention')).toHaveTextContent(
      'Thời hạn lưu: Chưa có thông tin',
    );
    expect(screen.getByTestId('screen-UI-H01')).not.toHaveTextContent(INVENTED);
  });

  it('quyền lợi chỉ là ba nguyên tắc lưu trữ của docs/06, kèm ghi chú chưa công bố từng gói', async () => {
    await renderWithProviders(<PlanScreen />);
    expect(screen.getAllByTestId(/^plan-benefit-/)).toHaveLength(3);
    expect(screen.getByTestId('plan-benefit-retention')).toHaveTextContent(/thời hạn của gói/);
    expect(screen.getByTestId('plan-benefit-dispute')).toHaveTextContent(/tranh chấp/);
    expect(screen.getByTestId('plan-benefit-downgrade')).toHaveTextContent(/Hạ cấp/);
    expect(screen.getByTestId('plan-benefits-note')).toHaveTextContent(/chưa được công bố/);
    // Tiêu đề mềm: không đọc như cam kết của dịch vụ đang chạy (Q-21w).
    expect(screen.getByText('Chính sách lưu trữ dự kiến')).toBeOnTheScreen();
    expect(screen.queryByText('Quyền lợi')).toBeNull();
  });

  it('"Chi tiết gói" mở route con chi tiết', async () => {
    await renderWithProviders(<PlanScreen />);
    await fireEvent.press(screen.getByTestId('plan-detail-action'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.planDetail);
  });

  it('"Nâng cấp gói" bị khóa: vô hiệu, không điều hướng, nêu "Sắp có"', async () => {
    await renderWithProviders(<PlanScreen />);
    const upgrade = screen.getByTestId('plan-upgrade');
    expect(upgrade.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(upgrade);
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(upgrade.props.accessibilityHint).toBe('Sắp có. Hiện chưa nâng cấp được trong ứng dụng.');
    expect(screen.getByTestId('plan-upgrade-soon')).toHaveTextContent(/^Sắp có/);
  });

  it('nút quay lại về màn trước', async () => {
    await renderWithProviders(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /Quay lại/ }));
    expect(mockNavigation.back).toHaveBeenCalled();
  });
});

describe('PlanDetailScreen (route con UI-H01, khung 9)', () => {
  it('quyền lợi chi tiết, thời hạn lưu "Chưa có thông tin", không "Xem tất cả" (D27), không giá', async () => {
    await renderWithProviders(<PlanDetailScreen />);
    expect(screen.getByText('Chính sách lưu trữ dự kiến')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^plan-benefit-/)).toHaveLength(3);
    expect(screen.getByTestId('plan-detail-retention')).toHaveTextContent(/Chưa có thông tin/);
    expect(screen.getByTestId('plan-detail-status')).toHaveTextContent('Sắp có');
    expect(screen.queryByText(/Xem tất cả/)).toBeNull();
    expect(screen.getByTestId('screen-UI-H01-detail')).not.toHaveTextContent(INVENTED);
  });

  it('"Nâng cấp gói" khóa, không điều hướng', async () => {
    await renderWithProviders(<PlanDetailScreen />);
    const upgrade = screen.getByTestId('plan-detail-upgrade');
    expect(upgrade.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(upgrade);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('hàng "Lịch sử thanh toán" mở khung 10', async () => {
    await renderWithProviders(<PlanDetailScreen />);
    await fireEvent.press(screen.getByTestId('plan-detail-history'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.paymentHistory);
  });
});

describe('PaymentHistoryScreen (route con UI-H01, khung 10)', () => {
  it('luôn trống, lời trung thực, không hóa đơn/tải hóa đơn/giao dịch giả', async () => {
    await renderWithProviders(<PaymentHistoryScreen />);
    expect(screen.getByText('Chưa có lịch sử thanh toán')).toBeOnTheScreen();
    expect(screen.getByTestId('screen-UI-H01-payments')).not.toHaveTextContent(INVENTED);
    expect(screen.queryByRole('button', { name: /hóa đơn|Tải/i })).toBeNull();
  });
});

describe('chuỗi gói dịch vụ', () => {
  it('mọi quyền lợi có câu chữ và không có số', () => {
    const { benefits } = resources.vi.personal.planScreen;
    for (const text of Object.values(benefits)) expect(text).not.toMatch(/\d/);
  });
});
