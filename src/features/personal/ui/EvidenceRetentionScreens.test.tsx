import { act, fireEvent, screen, within } from '@testing-library/react-native';

import {
  createMemoryDeviceSettingsStore,
  createMemoryEvidenceFileStore,
  LOCAL_SHOP_ID,
} from '@/features/orders';
import { createMemoryReturnStore } from '@/features/returns';

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
  it('máy trống: tổng và ba ô là 0 THẬT của shop trên máy này (V1-10), nói rõ phạm vi đếm', async () => {
    await renderWithProviders(<EvidenceDataScreen />);
    const labels: [string, string][] = [
      ['evidence-total-metric', 'Tổng số bằng chứng: 0'],
      ['evidence-on-device', 'Trên thiết bị: 0'],
      ['evidence-pending-sync', 'Đang chờ đồng bộ: 0'],
      ['evidence-cloud', 'Trên đám mây: 0'],
    ];
    for (const [id, label] of labels) {
      expect((await screen.findByLabelText(label)).props.testID).toBe(id);
    }
    expect(screen.getByTestId('evidence-explain')).toHaveTextContent(
      /Chỉ tính tệp của cửa hàng này trên máy này\./,
    );
  });

  it('có tệp: đếm theo trạng thái tệp thật (đóng gói + hàng hoàn); đám mây chỉ tính tệp đã xác minh', async () => {
    const files = createMemoryEvidenceFileStore();
    const returns = createMemoryReturnStore();
    const evidenceFileStore = {
      ...files,
      countByState: async (shop: string) =>
        shop === LOCAL_SHOP_ID ? { queued: 2, uploaded: 1, verified: 3, recording: 1 } : {},
    };
    const returnStore = {
      ...returns,
      countMediaByState: async (shop: string) =>
        shop === LOCAL_SHOP_ID ? { verified: 1, upload_failed: 1 } : {},
    };
    await renderWithProviders(<EvidenceDataScreen />, { evidenceFileStore, returnStore });
    const labels: [string, string][] = [
      ['evidence-total-metric', 'Tổng số bằng chứng: 9'],
      ['evidence-on-device', 'Trên thiết bị: 8'],
      ['evidence-pending-sync', 'Đang chờ đồng bộ: 4'],
      ['evidence-cloud', 'Trên đám mây: 4'],
    ];
    for (const [id, label] of labels) {
      expect((await screen.findByLabelText(label)).props.testID).toBe(id);
    }
  });

  it('đọc kho lỗi: ô hiện "–" và câu báo không đọc được (không số giả)', async () => {
    const files = createMemoryEvidenceFileStore();
    const evidenceFileStore = {
      ...files,
      countByState: async () => {
        throw new Error('disk');
      },
    };
    await renderWithProviders(<EvidenceDataScreen />, { evidenceFileStore });
    expect(await screen.findByTestId('evidence-load-error')).toHaveTextContent(
      'Không đọc được số liệu trên máy.',
    );
    expect(screen.getByTestId('evidence-cloud').props.accessibilityLabel).toBe('Trên đám mây: –');
  });

  it('giải thích phân biệt "trên thiết bị" (chưa là sao lưu) với "trên đám mây" (máy chủ đã xác nhận)', async () => {
    await renderWithProviders(<EvidenceDataScreen />);
    const text = screen.getByTestId('evidence-explain');
    expect(text).toHaveTextContent(/Trên thiết bị: .*chưa phải bản sao lưu/);
    expect(text).toHaveTextContent(
      /Trên đám mây: chỉ tính tệp máy chủ đã xác nhận và kiểm tra khớp/,
    );
    expect(screen.getByTestId('screen-UI-I01-evidence')).not.toHaveTextContent(OVERPROMISE);
  });

  it('"Xem trung tâm đồng bộ" mở UI-F01; hàng Thời hạn lưu mở khung 12', async () => {
    await renderWithProviders(<EvidenceDataScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xem trung tâm đồng bộ' }));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
    await fireEvent.press(screen.getByTestId('evidence-retention-link'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.retentionDetail);
  });
  it('V1-09: công tắc "Chỉ tải khi có Wi‑Fi" mặc định tắt, bật thì lưu vào cài đặt máy', async () => {
    const store = createMemoryDeviceSettingsStore();
    await renderWithProviders(<EvidenceDataScreen />, { deviceSettingsStore: store });
    const toggle = await screen.findByRole('switch', { name: 'Chỉ tải khi có Wi‑Fi' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    await act(async () => fireEvent.press(toggle));
    expect(await store.read('upload.wifi_only')).toBe('true');
    expect(
      screen.getByRole('switch', { name: 'Chỉ tải khi có Wi‑Fi' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
  });
});

describe('RetentionDetailScreen (UI-I01 route con, khung 12)', () => {
  it('câu thời hạn lưu v1 đúng nguyên văn (v1-release-plan mục 1.2), không "theo gói", không "Chưa có thông tin"', async () => {
    await renderWithProviders(<RetentionDetailScreen />);
    expect(screen.getByTestId('retention-plan-name')).toHaveTextContent('Chưa áp dụng');
    expect(screen.getByText('Thời hạn lưu bằng chứng')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('retention-note')).getByText(
        'Hiện ứng dụng chưa tự động xóa bằng chứng đã tải lên và chưa áp dụng thời hạn lưu. Nếu có thay đổi, bạn sẽ được báo trước trong ứng dụng.',
      ),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('retention-device-note')).getByText(
        'Tệp trên máy này sẽ mất nếu bạn gỡ ứng dụng.',
      ),
    ).toBeOnTheScreen();
    const root = screen.getByTestId('screen-UI-I01-retention');
    expect(root).not.toHaveTextContent(/theo gói|Chưa có thông tin|Ảnh giao hàng/);
  });

  it('không hứa dữ liệu còn xem được/khôi phục, không ngày, số ngày hay gói bịa', async () => {
    await renderWithProviders(<RetentionDetailScreen />);
    expect(screen.getByTestId('screen-UI-I01-retention')).not.toHaveTextContent(OVERPROMISE);
    expect(screen.getByTestId('screen-UI-I01-retention')).not.toHaveTextContent(/vĩnh viễn/);
  });
});
