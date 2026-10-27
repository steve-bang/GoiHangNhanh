import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryOrderStore } from '../data';
import { OrderPreviewScreen } from './OrderPreviewScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
const mockCopy = jest.fn<Promise<boolean>, [string]>();
jest.mock('@/platform/clipboard', () => ({ copyText: (text: string) => mockCopy(text) }));
const mockOpenAppSettings = jest.fn();
jest.mock('@/platform/external-link', () => ({
  openExternalLink: jest.fn(),
  openAppSettings: (...args: unknown[]) => mockOpenAppSettings(...args),
}));

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  mockCopy.mockReset();
  mockCopy.mockResolvedValue(true);
  mockOpenAppSettings.mockReset();
});

async function open(details = sampleOrder()) {
  const store = createMemoryOrderStore();
  await seedOrder(store, details);
  mockNavigation.params = { orderId: details.order.id };
  await renderWithProviders(<OrderPreviewScreen />, { orderStore: store });
  await screen.findByTestId('preview-order-code');
  return { store, details };
}

describe('UI-C01 Xác nhận đơn trước khi quay', () => {
  it('hiện banner, mã đơn, nguồn bán, mã vận đơn, sản phẩm (tên và variant tách riêng), kiện, ô nhắc', async () => {
    await open();
    expect(screen.getByTestId('screen-UI-C01')).toBeOnTheScreen();
    expect(screen.getByText('Xác nhận đơn trước khi quay')).toBeOnTheScreen();
    expect(screen.getByText('Đơn đã sẵn sàng!')).toBeOnTheScreen();
    expect(screen.getByText('DH1234567890')).toBeOnTheScreen();
    expect(screen.getByText('TikTok Shop')).toBeOnTheScreen();
    expect(screen.getByText('SPX1234567890')).toBeOnTheScreen();
    expect(screen.getAllByText('Áo thun cotton')).toHaveLength(2);
    expect(screen.getByText('Đen / XL')).toBeOnTheScreen();
    expect(screen.getByText('Trắng / L')).toBeOnTheScreen();
    expect(screen.getByText('Kiện 1')).toBeOnTheScreen();
    expect(screen.getByText(/tránh quay nhầm đơn/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kiểm tra camera và bắt đầu' })).toBeOnTheScreen();
    expect(screen.queryByText(/Kiểm tra 30 giây/)).toBeNull();
  });

  it('nhãn Chưa khai báo sản phẩm CHỈ khi chưa có dòng nào', async () => {
    await open(sampleOrder({ withLines: true }));
    expect(screen.queryByText('Chưa khai báo sản phẩm')).toBeNull();
  });

  it('đơn không có dòng: hiện nhãn Chưa khai báo sản phẩm và vẫn bắt đầu quay được', async () => {
    await open(sampleOrder({ withLines: false, tracking: null }));
    expect(screen.getByText('Chưa khai báo sản phẩm')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kiểm tra camera và bắt đầu' })).toBeEnabled();
    expect(screen.queryByTestId('copy-tracking-code')).toBeNull();
  });

  describe('Sao chép', () => {
    it('chép mã đơn và mã vận đơn, báo "Đã sao chép"', async () => {
      await open();
      await fireEvent.press(screen.getByTestId('copy-order-code'));
      expect(mockCopy).toHaveBeenLastCalledWith('DH1234567890');
      expect(await screen.findByText('Đã sao chép')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('copy-tracking-code'));
      expect(mockCopy).toHaveBeenLastCalledWith('SPX1234567890');
    });

    it('chép lỗi thì báo rõ, không nói đã chép', async () => {
      mockCopy.mockResolvedValue(false);
      await open();
      await fireEvent.press(screen.getByTestId('copy-order-code'));
      expect(await screen.findByText('Chưa sao chép được.')).toBeOnTheScreen();
      expect(screen.queryByText('Đã sao chép')).toBeNull();
    });
  });

  it('sửa số lượng ngay trên dòng và lưu vào máy', async () => {
    const { store, details } = await open();
    const line = screen.getByTestId('preview-line-line-1');
    expect(within(line).getByText('2')).toBeOnTheScreen();
    await fireEvent.press(within(line).getByRole('button', { name: 'Tăng số lượng' }));
    await waitFor(() =>
      expect(within(screen.getByTestId('preview-line-line-1')).getByText('3')).toBeOnTheScreen(),
    );
    const saved = await store.getOrder(details.order.id);
    expect(saved?.lines.map((l) => l.quantity)).toEqual([3, 1]); // dòng khác không bị gộp/đổi
  });

  it('thêm kiện: mỗi kiện có ID riêng, được lưu, và được chọn', async () => {
    const { store, details } = await open();
    await fireEvent.press(screen.getByTestId('preview-add-package'));
    expect(await screen.findByText('Kiện 2')).toBeOnTheScreen();
    const saved = await store.getOrder(details.order.id);
    expect(saved?.packages.map((p) => p.index)).toEqual([1, 2]);
    expect(new Set(saved?.packages.map((p) => p.id)).size).toBe(2);
    expect(screen.getByRole('button', { name: 'Kiện 2', selected: true })).toBeOnTheScreen();
  });

  describe('bắt đầu quay', () => {
    it('có quyền camera: tạo phiên gắn đúng đơn + kiện đã chọn, lưu ảnh chụp, RỒI mới sang màn quay bằng sessionId', async () => {
      const { store, details } = await open();
      await fireEvent.press(screen.getByTestId('preview-add-package'));
      await screen.findByText('Kiện 2');
      await fireEvent.press(screen.getByTestId('preview-start'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());

      const call = mockNavigation.replace.mock.calls[0] as [unknown, { sessionId: string }];
      expect(call[0]).toBe(ROUTES.packRecord);
      expect(Object.keys(call[1])).toEqual(['sessionId']); // không truyền mã đơn
      const session = await store.getSession(call[1].sessionId as never);
      const saved = await store.getOrder(details.order.id);
      expect(session).toMatchObject({
        orderId: details.order.id,
        packageId: saved?.packages[1]?.id,
        sessionStatus: 'created',
      });
      expect(session?.snapshot).toMatchObject({
        orderCode: 'DH1234567890',
        packageIndex: 2,
        packageCount: 2,
      });
    });

    it('sửa đơn sau khi bắt đầu không đổi ảnh chụp của phiên', async () => {
      const { store } = await open();
      await fireEvent.press(screen.getByTestId('preview-start'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      const call = mockNavigation.replace.mock.calls[0] as [unknown, { sessionId: string }];
      await store.updateLineQuantity('line-1' as never, 9);
      const session = await store.getSession(call[1].sessionId as never);
      expect(session?.snapshot.lines.map((l) => l.quantity)).toEqual([2, 1]);
    });

    it('bấm đúp chỉ tạo một phiên', async () => {
      await open();
      const button = screen.getByTestId('preview-start');
      await act(async () => {
        void fireEvent.press(button);
        void fireEvent.press(button);
      });
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
    });

    it('chưa cấp quyền camera: hộp thoại xin quyền, KHÔNG tạo phiên; cấp quyền rồi mới tạo', async () => {
      mockScanner.permission = 'askable';
      const { store } = await open();
      await fireEvent.press(screen.getByTestId('preview-start'));
      expect(await screen.findByTestId('start-permission-modal')).toBeOnTheScreen();
      expect(screen.getByText(/chưa ghi video/)).toBeOnTheScreen();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId('start-permission-allow'));
      expect(mockScanner.request).toHaveBeenCalled();
      expect(await store.getSession(sampleSession().id)).toBeNull();

      mockScanner.permission = 'granted';
      await fireEvent.press(screen.getByTestId('copy-order-code')); // làm màn vẽ lại với quyền mới
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    });

    it('bị chặn hẳn: hộp thoại dẫn tới Cài đặt', async () => {
      mockScanner.permission = 'blocked';
      await open();
      await fireEvent.press(screen.getByTestId('preview-start'));
      await fireEvent.press(await screen.findByTestId('start-permission-allow'));
      expect(mockOpenAppSettings).toHaveBeenCalled();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
    });

    it('đóng hộp thoại thì bỏ việc bắt đầu, không tạo phiên khi quyền đến muộn', async () => {
      mockScanner.permission = 'askable';
      await open();
      await fireEvent.press(screen.getByTestId('preview-start'));
      await screen.findByTestId('start-permission-modal');
      await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
      mockScanner.permission = 'granted';
      await fireEvent.press(screen.getByTestId('copy-order-code'));
      expect(mockNavigation.replace).not.toHaveBeenCalled();
    });
  });

  it('mở bằng mã đơn qua tham số cũ (không có orderId) thì báo không tìm thấy, không dùng mã làm ID', async () => {
    mockNavigation.params = { code: 'DH1234567890' };
    await renderWithProviders(<OrderPreviewScreen />);
    expect(await screen.findByText('Không tìm thấy đơn này trong máy.')).toBeOnTheScreen();
  });

  it('orderId không có trong máy: báo không tìm thấy', async () => {
    mockNavigation.params = { orderId: 'khong-co' };
    await renderWithProviders(<OrderPreviewScreen />);
    expect(await screen.findByText('Không tìm thấy đơn này trong máy.')).toBeOnTheScreen();
    expect(screen.queryByTestId('preview-start')).toBeNull();
  });

  it('có nút ? mở Trợ giúp', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('header-help'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.help);
  });
});
