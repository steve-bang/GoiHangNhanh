import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { EvidenceDataScreen } from './EvidenceDataScreen';
import { RetentionDetailScreen } from './RetentionDetailScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

/** Số liệu, gói, ngày, quyền lợi bịa và lời hứa quá mức mà board 07 vẽ hoặc dễ viết (D4, D19; bất biến 3, 6, 9, 11). */
const OVERPROMISE =
  /vui lòng|bảo vệ|an toàn|tuyệt đối|vẫn xem được|khôi phục|Gói tiêu chuẩn|Đang hoạt động|\bGB\b|\d{2,}\s*(ngày|tháng)|\d{1,2}\/\d{1,2}\/\d{2,4}/i;

describe('EvidenceDataScreen (UI-I01 route con, khung 11)', () => {
  it('tổng và ba ô đều "Chưa có số liệu", không có chữ số nào (không số giả)', async () => {
    await renderWithProviders(<EvidenceDataScreen />);
    const labels: [string, string][] = [
      ['evidence-total-metric', 'Tổng số bằng chứng: Chưa có số liệu'],
      ['evidence-on-device', 'Trên thiết bị: Chưa có số liệu'],
      ['evidence-pending-sync', 'Đang chờ đồng bộ: Chưa có số liệu'],
      ['evidence-cloud', 'Trên đám mây: Chưa có số liệu'],
    ];
    for (const [id, label] of labels) {
      expect(screen.getByTestId(id).props.accessibilityLabel).toBe(label);
    }
    expect(screen.getByTestId('screen-UI-I01-evidence')).not.toHaveTextContent(/\d/);
  });

  it('giải thích phân biệt "trên thiết bị" (chưa là sao lưu) với "trên đám mây" (máy chủ đã xác nhận)', async () => {
    await renderWithProviders(<EvidenceDataScreen />);
    const text = screen.getByTestId('evidence-explain');
    expect(text).toHaveTextContent(/Trên thiết bị: .*chưa phải bản sao lưu/);
    expect(text).toHaveTextContent(/Trên đám mây: chỉ tính tệp mà máy chủ đã xác nhận/);
    expect(screen.getByTestId('screen-UI-I01-evidence')).not.toHaveTextContent(OVERPROMISE);
  });

  it('"Xem trung tâm đồng bộ" mở UI-F01; hàng Thời hạn lưu mở khung 12', async () => {
    await renderWithProviders(<EvidenceDataScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xem trung tâm đồng bộ' }));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
    await fireEvent.press(screen.getByTestId('evidence-retention-link'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.retentionDetail);
  });
});

describe('RetentionDetailScreen (UI-I01 route con, khung 12)', () => {
  it('tên gói và ba loại bằng chứng đều "Chưa có thông tin"', async () => {
    await renderWithProviders(<RetentionDetailScreen />);
    expect(screen.getByTestId('retention-plan-name')).toHaveTextContent('Chưa có thông tin');
    const rows: [string, string][] = [
      ['retention-row-videoPack', 'Video đóng gói: Chưa có thông tin'],
      ['retention-row-photoDelivery', 'Ảnh giao hàng: Chưa có thông tin'],
      ['retention-row-photoReturn', 'Ảnh hoàn hàng: Chưa có thông tin'],
    ];
    for (const [id, label] of rows) {
      expect(screen.getByTestId(id).props.accessibilityLabel).toBe(label);
    }
    expect(screen.getByText('Thời hạn lưu theo gói dịch vụ')).toBeOnTheScreen();
  });

  it('thẻ ghi chú không hứa dữ liệu còn xem được/khôi phục sau hết hạn (D19), không ngày hay gói bịa', async () => {
    await renderWithProviders(<RetentionDetailScreen />);
    const note = screen.getByTestId('retention-note');
    expect(note).toHaveTextContent(/chưa được công bố/);
    expect(note).toHaveTextContent(/tranh chấp được giữ lại/);
    expect(note).toHaveTextContent(/hạ cấp gói không xóa bằng chứng ngay/);
    expect(screen.getByTestId('screen-UI-I01-retention')).not.toHaveTextContent(OVERPROMISE);
  });
});
