import { useState } from 'react';
import { Pressable } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import type { ShopId } from '@/core/ids';

import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { CurrentShopProvider, createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import { LOCAL_SHOP_ID, type OrderStore } from '../domain';
import { ScanScreen } from './ScanScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
const mockOpenAppSettings = jest.fn();
jest.mock('@/platform/external-link', () => ({
  openExternalLink: jest.fn(),
  openAppSettings: (...args: unknown[]) => mockOpenAppSettings(...args),
}));

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  mockOpenAppSettings.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('UI-B02 Quét mã đơn hàng', () => {
  it('có đủ thành phần theo mẫu: hướng dẫn, nhập tay, mẹo, trợ giúp', async () => {
    await renderWithProviders(<ScanScreen />);
    expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
    expect(screen.getByText('Quét mã đơn hàng')).toBeOnTheScreen();
    expect(
      screen.getByText('Đưa mã QR / mã vạch vào khung hình để quét tự động'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nhập mã thủ công')).toBeOnTheScreen();
    expect(screen.getByText('Mẹo nhỏ cho bạn')).toBeOnTheScreen();
    expect(screen.getByText('Nếu không quét được, hãy nhập tay nhé!')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Trợ giúp quét mã' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.help);
  });

  async function open(store: OrderStore = createMemoryOrderStore()) {
    await renderWithProviders(<ScanScreen />, { orderStore: store });
    return store;
  }

  it('quét được mã thì TRA CỨU trước (không sang tạo đơn ngay) và hiện mã vừa quét', async () => {
    await open();
    await act(async () => mockScanner.emit('SPX123456'));
    expect(await screen.findByTestId('order-match-sheet')).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(screen.getByText('Vừa quét: SPX123456')).toBeOnTheScreen();
  });

  it('mã không thấy: lối Tạo đơn với mã này sang Tạo đơn nhanh có mã điền sẵn, KHÔNG tự tạo đơn', async () => {
    const store = await open();
    await act(async () => mockScanner.emit('SPX123456'));
    expect(await screen.findByText('Không tìm thấy đơn')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('order-match-create'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.quickOrder, { code: 'SPX123456' });
    expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
  });

  it('đúng một đơn: tóm tắt và Xem chi tiết đơn bằng ID đơn (không tự quay, không tạo)', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-1', { tracking: 'SPX-9', lines: [{ name: 'Áo', quantity: 2 }] });
    await store.saveNewOrder(d);
    await open(store);
    await act(async () => mockScanner.emit('dh-1'));
    expect(await screen.findByText('Đã tìm thấy đơn')).toBeOnTheScreen();
    expect(screen.getByText('DH-1')).toBeOnTheScreen();
    expect(screen.getByText('Chưa có video')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('order-match-open'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderDetail, {
      orderId: d.order.id,
    });
  });

  it('mã vận đơn cũng tra được', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-2', { tracking: 'SPX-77' });
    await store.saveNewOrder(d);
    await open(store);
    await act(async () => mockScanner.emit('SPX-77'));
    expect(await screen.findByTestId('order-match-one')).toBeOnTheScreen();
  });

  it('trùng mã (nhiều đơn): bắt chọn, kèm nguồn bán và lý do khớp, không hàng nào chọn sẵn, không tự mở đơn đầu', async () => {
    const store = createMemoryOrderStore();
    const a = makeOrder('SAME-1', { source: 'shopee', at: 10 });
    const b = makeOrder('SAME-1', { source: 'lazada', at: 20 });
    const c = makeOrder('OTHER', { source: 'tiktok_shop', tracking: 'same-1', at: 30 });
    for (const d of [a, b, c]) await store.saveNewOrder(d);
    await open(store);
    await act(async () => mockScanner.emit('SAME-1'));
    expect(await screen.findByText('Có nhiều đơn trùng mã')).toBeOnTheScreen();
    for (const d of [a, b, c]) {
      expect(screen.getByTestId(`order-match-${d.order.id}`)).toBeOnTheScreen();
    }
    expect(screen.getAllByText('Trùng mã đơn')).toHaveLength(2);
    expect(screen.getByText('Trùng mã vận đơn')).toBeOnTheScreen();
    expect(screen.getByText(/Shopee/)).toBeOnTheScreen();
    expect(screen.getByText(/Lazada/)).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`order-match-${b.order.id}`));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderDetail, {
      orderId: b.order.id,
    });
  });

  it('quét lặp một mã (camera đọc liên tục) chỉ MỘT truy vấn', async () => {
    const store = createMemoryOrderStore();
    const spy = jest.spyOn(store, 'findOrdersByCodes');
    await open(store);
    await act(async () => {
      mockScanner.emit('SPX123456');
      mockScanner.emit('SPX123456');
      mockScanner.emit('SPX123456');
    });
    await screen.findByTestId('order-match-sheet');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('hộp kết quả đang mở: mã khác bị bỏ qua; đóng hộp thì quét được mã mới', async () => {
    const store = createMemoryOrderStore();
    const spy = jest.spyOn(store, 'findOrdersByCodes');
    await open(store);
    await act(async () => mockScanner.emit('A-1'));
    await screen.findByTestId('order-match-sheet');
    await act(async () => mockScanner.emit('B-2'));
    expect(spy).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('order-match-again'));
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    await act(async () => mockScanner.emit('B-2'));
    expect(await screen.findByText('Mã: B-2')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('lỗi đọc kho: giữ mã, báo lỗi và Thử lại tra đúng mã đó (một truy vấn)', async () => {
    const store = createMemoryOrderStore();
    let broken = true;
    const real = store.findOrdersByCodes.bind(store);
    const spy = jest.fn(async (...args: Parameters<OrderStore['findOrdersByCodes']>) => {
      if (broken) throw new AppError('ORDER_SAVE_FAILED');
      return real(...args);
    });
    await open({ ...store, findOrdersByCodes: spy });
    await act(async () => mockScanner.emit('KEEP-1'));
    expect(await screen.findByTestId('order-match-error')).toBeOnTheScreen();
    expect(screen.getByText('Mã: KEEP-1')).toBeOnTheScreen();
    expect(screen.getByText('Chưa tìm được lúc này. Bạn thử lại nhé.')).toBeOnTheScreen();
    broken = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Không tìm thấy đơn')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('nhập tay: nút Tra cứu bị khóa khi trống; nhập mã rồi tra cứu (không đi thẳng tạo đơn)', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('scan-manual-open'));
    expect(screen.getByTestId('scan-manual-lookup')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('scan-manual-code'), '  ab-12 ');
    await fireEvent.press(screen.getByTestId('scan-manual-lookup'));
    expect(await screen.findByText('Mã: ab-12')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('order-match-create'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.quickOrder, { code: 'ab-12' });
  });

  it('nhập tay mã quá dài: báo INVALID_CODE, không tra cứu', async () => {
    const store = createMemoryOrderStore();
    const spy = jest.spyOn(store, 'findOrdersByCodes');
    await open(store);
    await fireEvent.press(screen.getByTestId('scan-manual-open'));
    await fireEvent.changeText(screen.getByTestId('scan-manual-code'), 'X'.repeat(65));
    await fireEvent.press(screen.getByTestId('scan-manual-lookup'));
    expect(
      screen.getByText('Mã nhập chưa hợp lệ hoặc chỉ chứa ký tự không được hỗ trợ.'),
    ).toBeOnTheScreen();
    expect(spy).not.toHaveBeenCalled();
  });

  it('mã camera không hợp lệ (quá dài): báo lỗi, không "Vừa quét", không truy vấn, quét tiếp được', async () => {
    const store = createMemoryOrderStore();
    const spy = jest.spyOn(store, 'findOrdersByCodes');
    await open(store);
    await act(async () => mockScanner.emit('X'.repeat(65)));
    expect(screen.getByTestId('scan-invalid')).toBeOnTheScreen();
    expect(screen.queryByText(/Vừa quét/)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    await act(async () => mockScanner.emit('OK-1'));
    expect(await screen.findByTestId('order-match-sheet')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-invalid')).toBeNull();
  });

  it('đổi shop trong lúc hộp kết quả mở: không còn hiện đơn của shop cũ', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('SHOP-A', { shopId: 'shop-a' as ShopId });
    await store.saveNewOrder(d);
    mockScanner.permission = 'granted';
    function Harness() {
      const [shop, setShop] = useState('shop-a');
      return (
        <>
          <Pressable testID="switch" onPress={() => setShop('shop-b')} />
          <CurrentShopProvider shopId={shop}>
            <ScanScreen />
          </CurrentShopProvider>
        </>
      );
    }
    await renderWithProviders(<Harness />, { orderStore: store });
    await act(async () => mockScanner.emit('SHOP-A'));
    expect(await screen.findByTestId('order-match-one')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId('switch')));
    expect(screen.queryByTestId('order-match-one')).toBeNull();
    // hộp tự ẩn vì đổi shop: camera phải quét tiếp được (không kẹt cờ "đang xử lý")
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    await act(async () => mockScanner.emit('LAI-QUET'));
    expect(await screen.findByText('Mã: LAI-QUET')).toBeOnTheScreen();
  });

  it('nhập tay có lối tìm đơn đã lưu', async () => {
    await renderWithProviders(<ScanScreen />);
    await fireEvent.press(screen.getByTestId('scan-manual-open'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tìm đơn đã lưu' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.search);
  });

  it('đèn pin bật/tắt được khi camera sẵn sàng', async () => {
    await renderWithProviders(<ScanScreen />);
    expect(mockScanner.torch).toBe(false);
    await fireEvent.press(screen.getByTestId('scan-torch'));
    expect(mockScanner.torch).toBe(true);
    await fireEvent.press(screen.getByTestId('scan-torch'));
    expect(mockScanner.torch).toBe(false);
  });

  it('chưa cấp quyền: tự hiện hộp thoại xin quyền; bấm Cho phép thì gọi xin quyền', async () => {
    mockScanner.permission = 'askable';
    await renderWithProviders(<ScanScreen />);
    expect(screen.queryByTestId('scan-camera')).toBeNull();
    expect(screen.getByTestId('scan-permission-modal')).toBeOnTheScreen();
    expect(screen.getAllByText('Cần dùng camera để quét mã').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('scan-permission-allow'));
    expect(mockScanner.request).toHaveBeenCalledTimes(1);
  });

  it('đóng hộp thoại thì còn khung hướng dẫn trên màn quét, vẫn xin quyền và nhập tay được', async () => {
    mockScanner.permission = 'askable';
    await renderWithProviders(<ScanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByTestId('scan-permission-modal')).toBeNull();
    expect(screen.getByTestId('scan-unavailable')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cho phép camera' }));
    expect(mockScanner.request).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Nhập mã thủ công')).toBeOnTheScreen();
  });

  it('đã cấp quyền thì không hiện hộp thoại', async () => {
    await renderWithProviders(<ScanScreen />);
    expect(screen.queryByTestId('scan-permission-modal')).toBeNull();
  });

  it('bị từ chối hẳn: hộp thoại có nút mở Cài đặt của hệ điều hành', async () => {
    mockScanner.permission = 'blocked';
    await renderWithProviders(<ScanScreen />);
    expect(screen.getByTestId('scan-permission-modal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('scan-permission-allow'));
    expect(mockOpenAppSettings).toHaveBeenCalledTimes(1);
  });

  it('camera không mở được: báo ngắn gọn và vẫn nhập tay được', async () => {
    await renderWithProviders(<ScanScreen />);
    await act(async () => mockScanner.onError?.());
    expect(screen.getByText('Không mở được camera')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-camera')).toBeNull();
    expect(screen.getByText('Nhập mã thủ công')).toBeOnTheScreen();
  });

  it('màn khác phủ lên (mất focus) thì tắt camera, không quét ngầm', async () => {
    mockNavigation.screenActive = false;
    await renderWithProviders(<ScanScreen />);
    expect(screen.queryByTestId('scan-camera')).toBeNull();
  });

  it('nút quay lại gọi back', async () => {
    await renderWithProviders(<ScanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });
});
