import { useState } from 'react';
import { Pressable } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import type { ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { CurrentShopProvider, createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import { LOCAL_SHOP_ID, SEARCH_DEBOUNCE_MS, type OrderStore } from '../domain';
import { SearchScreen } from './SearchScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => {
  resetMockNavigation();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 50);
  });

async function open(store: OrderStore = createMemoryOrderStore()) {
  await renderWithProviders(<SearchScreen />, { orderStore: store });
  return store;
}
const type = (value: string) => fireEvent.changeText(screen.getByTestId('search-input'), value);

describe('UI-B03 Tìm đơn hàng', () => {
  it('chuỗi rỗng hoặc dưới 2 ký tự: KHÔNG truy vấn; hiện khối tìm gần đây', async () => {
    const store = createMemoryOrderStore();
    const spy = jest.spyOn(store, 'listOrders');
    await open(store);
    expect(screen.getByTestId('search-recent')).toBeOnTheScreen();
    await type('a');
    await type('   ');
    await settle();
    expect(spy).not.toHaveBeenCalled();
  });

  it('debounce: nhiều lần gõ liền nhau chỉ một truy vấn, với chuỗi cuối đã trim', async () => {
    const store = createMemoryOrderStore();
    await store.saveNewOrder(makeOrder('DH-100', { at: 1 }));
    const spy = jest.spyOn(store, 'listOrders');
    await open(store);
    await type('dh');
    await type('dh-');
    await type('  dh-1  ');
    expect(spy).not.toHaveBeenCalled();
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1]).toEqual({ searchKey: 'DH-1' });
    expect(await screen.findByText('DH-100')).toBeOnTheScreen();
  });

  it('truy vấn nhanh nhiều mã liên tiếp: chỉ hiện kết quả của chuỗi MỚI NHẤT dù kết quả cũ về muộn', async () => {
    const store = createMemoryOrderStore();
    await store.saveNewOrder(makeOrder('AAA-1', { at: 1 }));
    await store.saveNewOrder(makeOrder('BBB-1', { at: 2 }));
    const real = store.listOrders.bind(store);
    const slow: OrderStore = {
      ...store,
      listOrders: (shop, query, page) =>
        query.searchKey === 'AAA'
          ? new Promise((resolve) =>
              setTimeout(() => resolve(real(shop, query, page)), SEARCH_DEBOUNCE_MS * 5),
            )
          : real(shop, query, page),
    };
    await open(slow);
    await type('AAA');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10); // AAA đã gửi, chưa về
    });
    await type('BBB');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 10);
    });
    expect(await screen.findByText('BBB-1')).toBeOnTheScreen();
    expect(screen.queryByText('AAA-1')).toBeNull();
  });

  it('không có kết quả: lối Tạo đơn với mã này sang Tạo đơn nhanh có mã điền sẵn, KHÔNG tự tạo đơn', async () => {
    const store = await open();
    await type('khong-co');
    await settle();
    expect(await screen.findByText('Không tìm thấy đơn này')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo đơn với mã này' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.quickOrder, { code: 'khong-co' });
    expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
  });

  it('lỗi truy vấn: giữ chữ đã gõ, báo lỗi, Thử lại tìm lại', async () => {
    const store = createMemoryOrderStore();
    await store.saveNewOrder(makeOrder('OK-1', { at: 1 }));
    let broken = true;
    const real = store.listOrders.bind(store);
    await open({
      ...store,
      listOrders: async (...args) => {
        if (broken) throw new AppError('ORDER_SAVE_FAILED');
        return real(...args);
      },
    });
    await type('OK-1');
    await settle();
    expect(await screen.findByTestId('search-error')).toBeOnTheScreen();
    expect(screen.getByTestId('search-input')).toHaveDisplayValue('OK-1');
    broken = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    await settle();
    expect(await screen.findByText('OK-1')).toBeOnTheScreen();
  });

  it('kết quả: không có nhãn "Đúng đơn"/"Đã đồng bộ"; chạm hàng mở chi tiết bằng ID đơn và ghi lịch sử', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-5', { tracking: 'SPX-5', lines: [{ name: 'Áo', quantity: 3 }] });
    await store.saveNewOrder(d);
    await open(store);
    await type('dh-5');
    await settle();
    const row = await screen.findByTestId(`search-result-${d.order.id}`);
    expect(screen.queryByText(/Đúng đơn|Đã đồng bộ/)).toBeNull();
    expect(screen.getByText('Chưa có video')).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderDetail, {
      orderId: d.order.id,
    });
    await waitFor(async () =>
      expect(await store.listRecentSearches(LOCAL_SHOP_ID, 10)).toEqual([
        expect.objectContaining({ text: 'dh-5' }),
      ]),
    );
  });

  it('Enter khi đúng MỘT đơn khớp chính xác: mở thẳng chi tiết; gõ dở thì không tự mở', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-77', { at: 1 });
    await store.saveNewOrder(d);
    await open(store);
    await type('DH-7');
    await settle();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await type('dh-77');
    await act(async () => fireEvent(screen.getByTestId('search-input'), 'submitEditing'));
    await waitFor(() =>
      expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderDetail, {
        orderId: d.order.id,
      }),
    );
  });

  it('Enter hai lần nhanh với mã khớp đúng một đơn: chỉ MỘT lần điều hướng', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-88', { at: 1 });
    await store.saveNewOrder(d);
    await open(store);
    await type('dh-88');
    await act(async () => {
      fireEvent(screen.getByTestId('search-input'), 'submitEditing');
      fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    });
    await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
  });

  it('Thử lại sau lỗi: khung lỗi cũ biến mất ngay khi bắt đầu truy vấn', async () => {
    const store = createMemoryOrderStore();
    let release: (() => void) | null = null;
    let broken = true;
    const real = store.listOrders.bind(store);
    await open({
      ...store,
      listOrders: (...args) =>
        broken
          ? Promise.reject(new AppError('ORDER_SAVE_FAILED'))
          : new Promise((resolve) => {
              release = () => resolve(real(...args));
            }),
    });
    await type('LOI-1');
    await settle();
    expect(await screen.findByTestId('search-error')).toBeOnTheScreen();
    broken = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(screen.queryByTestId('search-error')).toBeNull();
    expect(screen.getByTestId('search-loading')).toBeOnTheScreen();
    await settle();
    await act(async () => release?.());
  });

  it('Enter khi nhiều đơn khớp chính xác: bắt chọn, không mở đơn đầu', async () => {
    const store = createMemoryOrderStore();
    const a = makeOrder('DUP-1', { source: 'shopee', at: 1 });
    const b = makeOrder('DUP-1', { source: 'lazada', at: 2 });
    await store.saveNewOrder(a);
    await store.saveNewOrder(b);
    await open(store);
    await type('DUP-1');
    await act(async () => fireEvent(screen.getByTestId('search-input'), 'submitEditing'));
    expect(await screen.findByText('Có nhiều đơn trùng mã')).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('có nút quét mã sang màn quét', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('search-scan'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.scan);
  });

  describe('lịch sử tìm gần đây', () => {
    it('chỉ ghi khi xác nhận (không ghi mỗi lần gõ); chạm mục điền ô; xóa từng mục; xóa tất cả có xác nhận', async () => {
      const store = createMemoryOrderStore();
      await open(store);
      await type('abc-1');
      await settle();
      expect(await store.listRecentSearches(LOCAL_SHOP_ID, 10)).toEqual([]);
      await act(async () => fireEvent(screen.getByTestId('search-input'), 'submitEditing'));
      await act(async () => {
        await store.recordSearch(LOCAL_SHOP_ID, 'xyz-9', Date.now() + 1);
      });
      await type('');
      expect(await screen.findByTestId('search-recent-abc-1')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('search-recent-abc-1'));
      expect(screen.getByTestId('search-input')).toHaveDisplayValue('abc-1');
      await type('');
      await fireEvent.press(await screen.findByRole('button', { name: 'Xóa abc-1 khỏi lịch sử' }));
      await waitFor(async () =>
        expect((await store.listRecentSearches(LOCAL_SHOP_ID, 10)).map((r) => r.text)).toEqual([
          'xyz-9',
        ]),
      );
      await fireEvent.press(screen.getByTestId('search-recent-clear'));
      await fireEvent.press(screen.getByTestId('search-recent-clear-confirm'));
      await waitFor(async () =>
        expect(await store.listRecentSearches(LOCAL_SHOP_ID, 10)).toEqual([]),
      );
    });

    it('đổi shop khi đang xem: lịch sử và kết quả của shop cũ biến mất', async () => {
      const store = createMemoryOrderStore();
      await store.recordSearch('shop-a' as ShopId, 'CHI-A', 1);
      const d = makeOrder('SHOP-A-1', { shopId: 'shop-a' as ShopId });
      await store.saveNewOrder(d);
      function Harness() {
        const [shop, setShop] = useState('shop-a');
        return (
          <>
            <Pressable testID="switch" onPress={() => setShop('shop-b')} />
            <CurrentShopProvider shopId={shop}>
              <SearchScreen />
            </CurrentShopProvider>
          </>
        );
      }
      await renderWithProviders(<Harness />, { orderStore: store });
      expect(await screen.findByTestId('search-recent-CHI-A')).toBeOnTheScreen();
      await type('SHOP-A');
      await settle();
      expect(await screen.findByText('SHOP-A-1')).toBeOnTheScreen();
      await act(async () => fireEvent.press(screen.getByTestId('switch')));
      expect(screen.queryByText('SHOP-A-1')).toBeNull();
      await settle();
      expect(screen.queryByText('SHOP-A-1')).toBeNull();
      await type('');
      expect(screen.queryByTestId('search-recent-CHI-A')).toBeNull();
    });
  });
});
