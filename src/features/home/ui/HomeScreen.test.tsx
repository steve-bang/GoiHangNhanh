import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { EvidenceId, OrderId, PackageId, SessionId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import type { EvidenceFile, FileState } from '@/features/evidence';
import {
  createMemoryDeviceSettingsStore,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
  type OrderStore,
} from '@/features/orders';
import { getMinTouchTarget } from '@/platform';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { HomeScreen } from './HomeScreen';

const NOW = Date.now();

function file(id: string, state: FileState, at = NOW): EvidenceFile {
  return {
    id: id as EvidenceId,
    shopId: LOCAL_SHOP_ID,
    orderId: 'o1' as OrderId,
    packageId: 'p1' as PackageId,
    sessionId: 's1' as SessionId,
    group: 'pack',
    kind: 'video',
    state,
    localPath: 'evidence/x.mp4',
    sizeBytes: 10,
    durationMs: 1,
    sha256Client: 'ab',
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: state === 'needs_attention' ? 'FILE_MISSING' : null,
    createdAtDevice: at,
    updatedAtDevice: at,
  };
}

/** Kho có sẵn tệp (đọc qua đúng các hàm Trang chủ dùng) và số đơn đã đóng gói hôm nay. */
function withData(files: EvidenceFile[], packed: number) {
  const base = createMemoryEvidenceFileStore();
  const orderStore: OrderStore = {
    ...createMemoryOrderStore(),
    countPackedOrders: async () => packed,
    getSession: async (_shop, id) =>
      ({ id, shopId: LOCAL_SHOP_ID, createdBy: 'fake-uid' }) as never,
  };
  const ofShop = (shop: string) => files.filter((f) => f.shopId === shop);
  return {
    orderStore,
    evidenceFileStore: {
      ...base,
      listByStates: async (shop: string, states: readonly FileState[]) =>
        ofShop(shop).filter((f) => states.includes(f.state)),
      countByState: async (shop: string, range?: { fromDevice: number; toDevice: number }) => {
        const counts: Partial<Record<FileState, number>> = {};
        for (const f of ofShop(shop)) {
          if (
            range &&
            (f.updatedAtDevice < range.fromDevice || f.updatedAtDevice >= range.toDevice)
          )
            continue;
          counts[f.state] = (counts[f.state] ?? 0) + 1;
        }
        return counts;
      },
    } as typeof base,
  };
}

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

describe('UI-B01 Trang chủ (mẫu thiết kế, D-16)', () => {
  it('đầu trang có tên shop THẬT của phiên (cổng), lời chào và chuông thông báo dẫn tới tab Thông báo', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Cửa hàng minh họa')).toBeOnTheScreen(); // tên của cổng giả
    expect(screen.queryByText('Shop minh họa')).toBeNull();
    expect(screen.getByText('Chào mừng trở lại!')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-notifications'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.notificationList);
  });

  it('có hai nút lớn Đóng gói đơn và Nhận hàng hoàn dẫn đúng route', async () => {
    await renderWithProviders(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('home-pack-order'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.scan);
    await fireEvent.press(screen.getByTestId('home-receive-return'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnFindOrder);
  });

  it('có liên kết Danh sách hàng hoàn dẫn tới UI-D01, vùng chạm đủ lớn', async () => {
    await renderWithProviders(<HomeScreen />);
    const link = screen.getByTestId('home-returns-list');
    expect(screen.getByText('Danh sách hàng hoàn')).toBeOnTheScreen();
    expect(link).toHaveStyle({ minHeight: getMinTouchTarget() });
    await fireEvent.press(link);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returns);
  });

  it('có 3 lối tắt: Tạo đơn nhanh, Danh sách đơn, Bằng chứng (Quét đã có ở nút giữa và thẻ chính)', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.queryByTestId('home-quick-scan')).toBeNull();
    const cases: [string, unknown][] = [
      ['home-quick-order', ROUTES.quickOrder],
      ['home-quick-orders', ROUTES.orders],
      ['home-quick-evidence', ROUTES.sync],
    ];
    for (const [id, route] of cases) {
      await fireEvent.press(screen.getByTestId(id));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(route);
    }
  });

  it('thống kê hôm nay dùng nhãn trạng thái chuẩn và dẫn tới màn tương ứng', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText('Thống kê hôm nay')).toBeOnTheScreen();
    expect(screen.getByText('Đơn đã đóng gói')).toBeOnTheScreen();
    expect(screen.getByText('Đã tải lên')).toBeOnTheScreen();
    expect(screen.getByText('Lỗi – cần xử lý')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-stat-error'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.sync, { filter: 'error' });
    await fireEvent.press(screen.getByTestId('home-stat-packed'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orders);
    await fireEvent.press(screen.getByTestId('home-today-detail'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.sync);
  });

  it('hàng hướng dẫn mở Trợ giúp; không còn banner trang trí và không còn dữ liệu minh họa', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.queryByTestId('home-banner')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-tip-guide'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.help);
    expect(screen.queryByText(/minh họa của khung/)).toBeNull();
    expect(screen.queryByText(/Dữ liệu minh họa/)).toBeNull();
  });

  it('máy trống: ba ô là 0 thật, có câu rỗng trung thực, không số giả', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByTestId('home-today-empty')).toHaveTextContent(
      'Hôm nay chưa có đơn đóng gói hay tệp tải lên trên máy này.',
    );
    expect(screen.getByLabelText('Đơn đã đóng gói: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Đã tải lên: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lỗi – cần xử lý: 0')).toBeOnTheScreen();
  });

  it('có dữ liệu: số thật từ kho; Đã tải lên chỉ đếm tệp máy chủ đã nhận hôm nay', async () => {
    const stores = withData(
      [
        file('a', 'verified'),
        file('b', 'uploaded'),
        file('c', 'queued'), // chưa được máy chủ nhận
        file('d', 'verified', NOW - 3 * 86_400_000), // hôm trước
        file('e', 'needs_attention', NOW - 3 * 86_400_000), // lỗi cũ vẫn cần xử lý
        file('f', 'hash_mismatch'),
      ],
      5,
    );
    await renderWithProviders(<HomeScreen />, stores);
    expect(await screen.findByLabelText('Đơn đã đóng gói: 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Đã tải lên: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lỗi – cần xử lý: 2')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-today-empty')).toBeNull();
  });

  it('đọc kho lỗi: ô hiện "–" và câu báo không đọc được, không hiện 0', async () => {
    const orderStore: OrderStore = {
      ...createMemoryOrderStore(),
      countPackedOrders: async () => {
        throw new Error('disk');
      },
    };
    await renderWithProviders(<HomeScreen />, { orderStore });
    expect(await screen.findByTestId('home-today-error')).toHaveTextContent(
      'Không đọc được số liệu trên máy.',
    );
    expect(screen.getByLabelText('Đơn đã đóng gói: –')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-today-empty')).toBeNull();
  });

  it('thẻ "Dữ liệu nằm trên máy này" (Q-24a): đóng được, nhớ theo máy, không hiện lại', async () => {
    const deviceSettingsStore = createMemoryDeviceSettingsStore();
    const view = await renderWithProviders(<HomeScreen />, { deviceSettingsStore });
    expect(await screen.findByTestId('home-device-notice')).toBeOnTheScreen();
    expect(screen.getByText('Dữ liệu nằm trên máy này')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Đơn và bằng chứng chỉ xem được trên máy đã tạo. Đổi máy hoặc cài lại ứng dụng sẽ không thấy dữ liệu cũ.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-device-notice-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('home-device-notice')).toBeNull());
    expect(await deviceSettingsStore.read('home.device_data_notice_dismissed')).toBe('true');
    view.unmount();
    // Mở lại app (kho cài đặt cũ): thẻ không hiện lại.
    await renderWithProviders(<HomeScreen />, { deviceSettingsStore });
    await screen.findByLabelText('Đơn đã đóng gói: 0');
    expect(screen.queryByTestId('home-device-notice')).toBeNull();
  });

  it('không có biểu đồ doanh thu và không có lời hứa quá mức hay nhãn mơ hồ của mockup', async () => {
    await renderWithProviders(<HomeScreen />);
    const banned = [
      /doanh thu/i,
      /lợi nhuận/i,
      /Đơn đã xử lý/,
      /Đã đồng bộ/,
      /Lỗi đồng bộ/,
      /uy tín/i,
      /tuyệt đối/i,
      /chống giả mạo/i,
      /quyền lợi/i,
      /pháp lý/i,
    ];
    for (const pattern of banned) {
      expect(screen.queryByText(pattern)).toBeNull();
    }
  });
});
