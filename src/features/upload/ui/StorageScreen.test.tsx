import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryEvidenceFileStore, LOCAL_SHOP_ID } from '@/features/orders';
import type { EvidenceFile } from '@/features/evidence';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { StorageScreen } from './StorageScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

/** Chữ hứa quá mức hoặc số gói/hạn lưu bịa (bất biến 3, 9, 11; D-4). */
const OVERPROMISE = /an toàn|tuyệt đối|bảo vệ|Gói |hạn mức|\d+\s*(ngày|tháng)|xóa|giải phóng/i;

function storeWith(files: Partial<EvidenceFile>[]) {
  const base = createMemoryEvidenceFileStore();
  return {
    ...base,
    listByStates: async (shop: string, states: readonly string[]) =>
      shop === LOCAL_SHOP_ID
        ? (files.filter((f) => states.includes(f.state as string)) as EvidenceFile[])
        : [],
  };
}

const f = (id: string, state: string, sizeBytes: number | null): Partial<EvidenceFile> => ({
  id: id as EvidenceFile['id'],
  shopId: LOCAL_SHOP_ID as EvidenceFile['shopId'],
  state: state as EvidenceFile['state'],
  sizeBytes,
  sessionId: 's1' as EvidenceFile['sessionId'],
  orderId: 'o1' as EvidenceFile['orderId'],
  createdAtDevice: 1,
  updatedAtDevice: 1,
});

describe('StorageScreen (UI-F03, V1-30)', () => {
  it('máy trống: một câu "chưa có tệp", không hàng số 0, có phạm vi đếm, không hứa quá mức', async () => {
    await renderWithProviders(<StorageScreen />);
    expect(await screen.findByTestId('storage-empty')).toHaveTextContent(
      'Chưa có tệp bằng chứng nào trên máy này.',
    );
    expect(screen.queryByTestId('storage-on-server')).toBeNull();
    expect(screen.getByTestId('screen-UI-F03')).toBeTruthy();
    const explain = screen.getByTestId('storage-explain');
    expect(explain).toHaveTextContent(/Chỉ tính tệp của tài khoản này/);
    expect(explain).not.toHaveTextContent(OVERPROMISE);
    for (const id of ['storage-risk', 'storage-unknown-size', 'storage-other-accounts']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('có tệp: cộng dung lượng theo nhóm, báo tệp chưa rõ cỡ', async () => {
    const evidenceFileStore = storeWith([
      f('a', 'verified', 1024 * 1024),
      f('b', 'uploaded', 1024 * 1024),
      f('c', 'queued', 1536),
      f('d', 'upload_failed', null),
      f('e', 'recording', null),
    ]);
    await renderWithProviders(<StorageScreen />, { evidenceFileStore });
    expect(await screen.findByLabelText('Đã lên máy chủ: 2 tệp · 2 MB')).toBeTruthy();
    expect(screen.getByLabelText('Chưa lên máy chủ: 2 tệp · 1,5 KB')).toBeTruthy();
    expect(screen.getByLabelText('Chưa có bản lưu trên máy: 1 tệp')).toBeTruthy();
    expect(screen.getByTestId('storage-risk')).toHaveTextContent(/có thể mất nếu bạn gỡ ứng dụng/);
    expect(screen.getByTestId('storage-unknown-size')).toHaveTextContent(
      '1 tệp chưa rõ dung lượng, nên tổng có thể cao hơn.',
    );
  });

  it('đọc kho lỗi: hiện "–", câu báo lỗi và nút Thử lại (không số giả)', async () => {
    const evidenceFileStore = {
      ...createMemoryEvidenceFileStore(),
      listByStates: async () => {
        throw new Error('disk');
      },
    };
    await renderWithProviders(<StorageScreen />, { evidenceFileStore });
    expect(await screen.findByTestId('storage-load-error')).toHaveTextContent(
      'Không đọc được số liệu trên máy.',
    );
    expect(screen.getByLabelText('Đã lên máy chủ: –')).toBeTruthy();
    expect(screen.queryByTestId('storage-empty')).toBeNull();
    expect(screen.getByTestId('storage-retry')).toBeTruthy();
  });

  it('không có nút xóa/giải phóng; nút Xem trung tâm đồng bộ mở UI-F01', async () => {
    await renderWithProviders(<StorageScreen />);
    await screen.findByTestId('storage-empty');
    expect(screen.queryByText(/xóa|giải phóng|dọn/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('storage-open-sync'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
  });
});
