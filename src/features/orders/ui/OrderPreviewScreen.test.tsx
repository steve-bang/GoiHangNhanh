import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryOrderStore } from '../data';
import { LOCAL_SHOP_ID } from '../domain';
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
  it('nút cuối không có biểu tượng camera; chỉ có nhãn', async () => {
    await open();
    const start = screen.getByTestId('preview-start');
    const texts = within(start).getAllByText(/./, { includeHiddenElements: true });
    expect(texts.map((n) => n.props.children)).toEqual(['Kiểm tra camera và bắt đầu']);
  });

  it('chip Kiện 1 được chọn, + Thêm kiện nằm cùng hàng với các chip; thêm kiện thì chọn kiện mới', async () => {
    await open();
    const one = screen.getByRole('button', { name: 'Kiện 1', selected: true });
    expect(screen.getByTestId('preview-add-package').parent).toBe(one.parent);
    await fireEvent.press(screen.getByTestId('preview-add-package'));
    const two = await screen.findByRole('button', { name: 'Kiện 2', selected: true });
    expect(two.parent).toBe(screen.getByTestId('preview-add-package').parent);
    expect(screen.getByRole('button', { name: 'Kiện 1', selected: false })).toBeOnTheScreen();
  });

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
    const saved = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
    expect(saved?.lines.map((l) => l.quantity)).toEqual([3, 1]); // dòng khác không bị gộp/đổi
  });

  describe('đơn đã có phiên đóng gói (bất biến 7)', () => {
    async function openWithSession() {
      const details = sampleOrder();
      const store = createMemoryOrderStore();
      await seedOrder(store, details);
      await store.saveSession(sampleSession(details));
      mockNavigation.params = { orderId: details.order.id };
      await renderWithProviders(<OrderPreviewScreen />, { orderStore: store });
      await screen.findByTestId('preview-order-code');
      return { store, details };
    }

    it('ẩn bộ chỉnh số lượng, hiện số lượng chỉ-đọc kèm chú thích ngắn', async () => {
      await openWithSession();
      const line = screen.getByTestId('preview-line-line-1');
      expect(within(line).queryByRole('button', { name: 'Tăng số lượng' })).toBeNull();
      expect(within(line).queryByRole('button', { name: 'Giảm số lượng' })).toBeNull();
      expect(screen.getByTestId('preview-quantity-line-1')).toHaveTextContent('Số lượng: 2');
      expect(screen.getByText('Đơn đã bắt đầu quay nên chưa sửa được số lượng.')).toBeOnTheScreen();
    });

    it('đơn chưa có phiên thì không có chú thích khóa', async () => {
      await open();
      expect(screen.queryByTestId('preview-quantity-locked')).toBeNull();
    });

    it('màn mở trước khi có phiên: bấm sửa bị kho từ chối, báo đúng lỗi, số lượng không đổi, rồi khóa lại', async () => {
      const { store, details } = await open();
      await store.saveSession(sampleSession(details)); // phiên được tạo ở nơi khác sau khi màn đã mở
      const line = screen.getByTestId('preview-line-line-1');
      await fireEvent.press(within(line).getByRole('button', { name: 'Tăng số lượng' }));
      expect(
        await screen.findByText('Đơn này đã bắt đầu quay nên chưa sửa được số lượng.'),
      ).toBeOnTheScreen();
      expect((await store.getOrder(LOCAL_SHOP_ID, details.order.id))?.lines[0]?.quantity).toBe(2);
      await waitFor(() => expect(screen.getByTestId('preview-quantity-locked')).toBeOnTheScreen());
    });

    it('vẫn thêm được kiện mới', async () => {
      await openWithSession();
      await fireEvent.press(screen.getByTestId('preview-add-package'));
      expect(
        await screen.findByRole('button', { name: 'Kiện 2', selected: true }),
      ).toBeOnTheScreen();
    });
  });

  describe('quay về sau khi dừng bản thử giao diện', () => {
    it('có thông báo "chưa có video nào được lưu" khi đến từ màn quay chưa ghi', async () => {
      const details = sampleOrder();
      const store = createMemoryOrderStore();
      await seedOrder(store, details);
      mockNavigation.params = { orderId: details.order.id, notice: 'not_recorded' };
      await renderWithProviders(<OrderPreviewScreen />, { orderStore: store });
      await screen.findByTestId('preview-order-code');
      expect(screen.getByText('Bản thử giao diện: chưa có video nào được lưu.')).toBeOnTheScreen();
    });

    it('không có thông báo khi mở bình thường', async () => {
      await open();
      expect(screen.queryByTestId('preview-not-recorded')).toBeNull();
    });
  });

  it('thêm kiện: mỗi kiện có ID riêng, được lưu, và được chọn', async () => {
    const { store, details } = await open();
    await fireEvent.press(screen.getByTestId('preview-add-package'));
    expect(await screen.findByText('Kiện 2')).toBeOnTheScreen();
    const saved = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
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
      const session = await store.getSession(LOCAL_SHOP_ID, call[1].sessionId as never);
      const saved = await store.getOrder(LOCAL_SHOP_ID, details.order.id);
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

    it('đã bắt đầu thì KHÔNG sửa được số lượng nữa: kho từ chối, ảnh chụp và dòng đơn giữ nguyên', async () => {
      const { store } = await open();
      await fireEvent.press(screen.getByTestId('preview-start'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      const call = mockNavigation.replace.mock.calls[0] as [unknown, { sessionId: string }];
      await expect(
        store.updateLineQuantity(LOCAL_SHOP_ID, 'line-1' as never, 9),
      ).rejects.toMatchObject({ code: 'ORDER_HAS_SESSION' });
      const session = await store.getSession(LOCAL_SHOP_ID, call[1].sessionId as never);
      expect(session?.snapshot.lines.map((l) => l.quantity)).toEqual([2, 1]);
      const saved = await store.getOrder(LOCAL_SHOP_ID, sampleOrder().order.id);
      expect(saved?.lines.map((l) => l.quantity)).toEqual([2, 1]);
    });

    it('kiện đã có phiên đang thực hiện: mở lại phiên đó, KHÔNG tạo phiên chồng', async () => {
      const { store, details } = await open();
      await fireEvent.press(screen.getByTestId('preview-start'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalledTimes(1));
      const first = mockNavigation.replace.mock.calls[0] as [unknown, { sessionId: string }];
      await fireEvent.press(screen.getByTestId('preview-start'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalledTimes(2));
      const second = mockNavigation.replace.mock.calls[1] as [unknown, { sessionId: string }];
      expect(second[0]).toBe(ROUTES.packRecord);
      expect(second[1].sessionId).toBe(first[1].sessionId);
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, details.order.id)).toHaveLength(1);
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
      expect(await store.getSession(LOCAL_SHOP_ID, sampleSession().id)).toBeNull();

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
