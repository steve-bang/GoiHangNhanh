import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryOrderStore } from '../data';
import { LOCAL_SHOP_ID } from '../domain';
import type { OrderStore } from '../domain';
import { QuickOrderScreen } from './QuickOrderScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
});

async function allOrders(store: OrderStore, code: string) {
  return store.findOrdersByCodes(LOCAL_SHOP_ID, { orderCodeKey: code.toUpperCase() });
}

async function typeCode(code: string) {
  await fireEvent.changeText(screen.getByTestId('quick-order-code'), code);
}

describe('UI-B04 Tạo đơn nhanh', () => {
  it('có đủ thành phần theo mẫu; số lượng mặc định 1; tên và variant là hai ô riêng', async () => {
    await renderWithProviders(<QuickOrderScreen />);
    expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
    expect(screen.getByText('Tạo đơn nhanh')).toBeOnTheScreen();
    expect(screen.getByText('Mã đơn hàng')).toBeOnTheScreen();
    expect(screen.getByTestId('line-name-0')).toBeOnTheScreen();
    expect(screen.getByTestId('line-variant-0')).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lưu và xác nhận đơn' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bỏ qua, quay ngay' })).toBeOnTheScreen();
    expect(screen.getByText('Thêm sản phẩm khác')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('header-help'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.help);
  });

  it('không còn các câu/hành vi bị loại khỏi mẫu', async () => {
    await renderWithProviders(<QuickOrderScreen />);
    expect(screen.queryByText(/Kiểm tra 30 giây|chống giả mạo/)).toBeNull();
  });

  it('hai nút khóa khi chưa có mã đơn; điền sẵn mã quét được từ tham số', async () => {
    await renderWithProviders(<QuickOrderScreen />);
    expect(screen.getByTestId('quick-save')).toBeDisabled();
    expect(screen.getByTestId('quick-skip')).toBeDisabled();
    await typeCode('DH1');
    expect(screen.getByTestId('quick-save')).toBeEnabled();

    resetMockNavigation();
    mockNavigation.params = { code: 'SPX999' };
    await renderWithProviders(<QuickOrderScreen />);
    expect(screen.getAllByTestId('quick-order-code').at(-1)).toHaveDisplayValue('SPX999');
  });

  it('nguồn bán mặc định "Khác / chưa xác định" và đổi được bằng nút Thay đổi', async () => {
    await renderWithProviders(<QuickOrderScreen />);
    expect(screen.getByText('Khác / chưa xác định')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('source-change'));
    await fireEvent.press(screen.getByRole('button', { name: 'TikTok Shop' }));
    expect(screen.getByText('TikTok Shop')).toBeOnTheScreen();
  });

  it('icon quét ở ô Mã đơn thay màn hiện tại bằng màn quét', async () => {
    await renderWithProviders(<QuickOrderScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.scan);
  });

  it('Lưu và xác nhận đơn: ghi đơn + dòng + kiện 1 rồi sang Xác nhận bằng ID đơn (không bằng mã)', async () => {
    const store = createMemoryOrderStore();
    await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
    await typeCode('  dh-77 ');
    await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo thun cotton');
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen / XL');
    await fireEvent.press(screen.getByRole('button', { name: 'Tăng số lượng' }));
    await fireEvent.press(screen.getByTestId('quick-save'));

    await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
    const [orders, ...rest] = await allOrders(store, 'DH-77');
    expect(rest).toEqual([]);
    if (!orders) throw new Error('đơn phải được lưu');
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orderPreview, { orderId: orders.id });
    const saved = await store.getOrder(orders.id);
    expect(saved?.order).toMatchObject({
      orderCode: 'dh-77',
      source: 'other',
      dataOrigin: 'entered_by_user',
    });
    expect(saved?.lines.map((l) => [l.name, l.variant, l.quantity])).toEqual([
      ['Áo thun cotton', 'Đen / XL', 2],
    ]);
    expect(saved?.packages).toHaveLength(1);
  });

  it('nhiều dòng cùng tên khác variant được giữ riêng, không gộp', async () => {
    const store = createMemoryOrderStore();
    await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
    await typeCode('DH2');
    await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo');
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
    await fireEvent.press(screen.getByTestId('quick-add-line'));
    await fireEvent.changeText(screen.getByTestId('line-name-1'), 'Áo');
    await fireEvent.changeText(screen.getByTestId('line-variant-1'), 'Trắng');
    await fireEvent.press(screen.getByTestId('quick-save'));
    await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
    const [order] = await allOrders(store, 'DH2');
    const saved = order ? await store.getOrder(order.id) : null;
    expect(saved?.lines.map((l) => l.variant)).toEqual(['Đen', 'Trắng']);
  });

  it('variant mà không có tên: báo lỗi ở dòng, không lưu', async () => {
    const store = createMemoryOrderStore();
    await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
    await typeCode('DH3');
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
    await fireEvent.press(screen.getByTestId('quick-save'));
    expect(await screen.findByText('Hãy nhập tên sản phẩm cho phân loại này.')).toBeOnTheScreen();
    expect(await allOrders(store, 'DH3')).toEqual([]);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('nút xóa variant xóa nội dung ô variant', async () => {
    await renderWithProviders(<QuickOrderScreen />);
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa phân loại' }));
    expect(screen.getByTestId('line-variant-0')).toHaveDisplayValue('');
  });

  describe('gợi ý từ lịch sử đã nhập', () => {
    it('hiện TÊN gần đây (mỗi sản phẩm một dòng, không kèm variant); chọn thì điền tên và gợi ý variant của tên đó', async () => {
      const store = createMemoryOrderStore();
      await seedOrder(store, sampleOrder());
      await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
      await fireEvent(screen.getByTestId('line-name-0'), 'focus');
      const box = await screen.findByTestId('line-suggestions-0');
      expect(box).toBeOnTheScreen();
      expect(screen.getByText('Gợi ý gần đây')).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'Áo thun cotton' })).toHaveLength(1);
      expect(screen.queryByText('Đen / XL')).toBeNull();

      await fireEvent.press(screen.getByRole('button', { name: 'Áo thun cotton' }));
      expect(screen.getByTestId('line-name-0')).toHaveDisplayValue('Áo thun cotton');
      expect(screen.getByText('Phân loại đã dùng')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Đen / XL' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Trắng / L' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Trắng / L' }));
      expect(screen.getByTestId('line-variant-0')).toHaveDisplayValue('Trắng / L');
    });

    it('chưa có lịch sử thì không có khối gợi ý', async () => {
      await renderWithProviders(<QuickOrderScreen />);
      await fireEvent(screen.getByTestId('line-name-0'), 'focus');
      expect(screen.queryByTestId('line-suggestions-0')).toBeNull();
    });
  });

  describe('Bỏ qua, quay ngay', () => {
    it('ghi đơn KHÔNG có dòng, tạo phiên gắn đúng kiện rồi vào màn quay bằng sessionId', async () => {
      const store = createMemoryOrderStore();
      await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
      await typeCode('DH-QUICK');
      await fireEvent.press(screen.getByTestId('quick-skip'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());

      const [order] = await allOrders(store, 'DH-QUICK');
      const details = order ? await store.getOrder(order.id) : null;
      expect(details?.lines).toEqual([]);
      const call = mockNavigation.replace.mock.calls[0] as [unknown, { sessionId: string }];
      expect(call[0]).toBe(ROUTES.packRecord);
      const session = await store.getSession(call[1].sessionId as never);
      expect(session).toMatchObject({
        orderId: order?.id,
        packageId: details?.packages[0]?.id,
        sessionStatus: 'created',
      });
      expect(session?.snapshot.lines).toEqual([]);
      expect(mockNavigation.push).not.toHaveBeenCalled();
    });

    it('chưa có quyền camera: hộp thoại xin quyền hiện, chưa mở màn quay; cấp quyền thì tiếp tục', async () => {
      mockScanner.permission = 'askable';
      const store = createMemoryOrderStore();
      await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
      await typeCode('DH-PERM');
      await fireEvent.press(screen.getByTestId('quick-skip'));
      expect(await screen.findByTestId('start-permission-modal')).toBeOnTheScreen();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId('start-permission-allow'));
      expect(mockScanner.request).toHaveBeenCalled();

      // Quyền vừa được cấp (hộp thoại hệ điều hành/Cài đặt): lần vẽ kế tiếp thấy `granted` thì tiếp tục.
      mockScanner.permission = 'granted';
      await typeCode('DH-PERM ');
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(mockNavigation.replace.mock.calls[0]?.[0]).toBe(ROUTES.packRecord);
    });
  });

  describe('trùng mã (A02, ADR-011)', () => {
    async function setup() {
      const store = createMemoryOrderStore();
      const existing = await seedOrder(store, sampleOrder({ withLines: false }));
      await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
      await fireEvent.press(screen.getByTestId('source-change'));
      await fireEvent.press(screen.getByRole('button', { name: 'TikTok Shop' }));
      await typeCode(' dh1234567890 ');
      await fireEvent.press(screen.getByTestId('quick-save'));
      return { store, existing };
    }

    it('cùng mã đơn + nguồn: hiện "Đã có đơn này", KHÔNG tự lưu, KHÔNG tự chọn đơn', async () => {
      const { store, existing } = await setup();
      expect(await screen.findByTestId('duplicate-sheet')).toBeOnTheScreen();
      expect(screen.getByText('Đã có đơn này')).toBeOnTheScreen();
      expect(screen.getByTestId(`duplicate-${existing.order.id}`)).toBeOnTheScreen();
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(1);
      expect(mockNavigation.push).not.toHaveBeenCalled();
    });

    it('"Dùng đơn này" mở Xác nhận với ID của đơn đã có', async () => {
      const { existing } = await setup();
      await fireEvent.press(await screen.findByRole('button', { name: 'Dùng đơn này' }));
      expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orderPreview, {
        orderId: existing.order.id,
      });
    });

    it('"Tạo hồ sơ mới" lưu thêm một đơn riêng (không ghi đè) rồi sang Xác nhận', async () => {
      const { store, existing } = await setup();
      await fireEvent.press(await screen.findByTestId('duplicate-create-new'));
      await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
      const orders = await allOrders(store, 'DH1234567890');
      expect(orders).toHaveLength(2);
      const created = orders.find((o) => o.id !== existing.order.id);
      expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orderPreview, {
        orderId: created?.id,
      });
    });

    it('cùng mã nhưng khác nguồn bán thì không coi là trùng', async () => {
      const store = createMemoryOrderStore();
      await seedOrder(store, sampleOrder({ withLines: false }));
      await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
      await typeCode('DH1234567890'); // nguồn mặc định "Khác": khác TikTok Shop của đơn đã có
      await fireEvent.press(screen.getByTestId('quick-save'));
      await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
      expect(screen.queryByTestId('duplicate-sheet')).toBeNull();
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(2);
    });

    it('cùng mã vận đơn (mã đơn khác) cũng được báo để chọn', async () => {
      const store = createMemoryOrderStore();
      const existing = await seedOrder(store, sampleOrder({ withLines: false }));
      await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
      await typeCode('DH-KHAC');
      await fireEvent.press(screen.getByTestId('quick-add-tracking'));
      await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'spx1234567890');
      await fireEvent.press(screen.getByTestId('quick-save'));
      expect(await screen.findByText('Cùng mã vận đơn')).toBeOnTheScreen();
      expect(screen.getByTestId(`duplicate-${existing.order.id}`)).toBeOnTheScreen();
    });
  });

  it('lưu lỗi: báo LOCAL_SAVE_UNAVAILABLE bằng câu thường, không rời màn, bấm lại được', async () => {
    const store = createMemoryOrderStore();
    const failing: OrderStore = {
      ...store,
      saveNewOrder: jest.fn(async () => {
        throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      }),
    };
    await renderWithProviders(<QuickOrderScreen />, { orderStore: failing });
    await typeCode('DH-ERR');
    await fireEvent.press(screen.getByTestId('quick-save'));
    expect(await screen.findByTestId('save-error')).toBeOnTheScreen();
    expect(screen.getByText(/Không thể chuẩn bị nơi lưu video/)).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('quick-save')).toBeEnabled());
  });

  it('bấm đúp nhanh chỉ tạo một đơn', async () => {
    const store = createMemoryOrderStore();
    await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
    await typeCode('DH-DOUBLE');
    const button = screen.getByTestId('quick-save');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });
    await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
    expect(await allOrders(store, 'DH-DOUBLE')).toHaveLength(1);
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
  });
});
