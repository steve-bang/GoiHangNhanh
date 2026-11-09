import { StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { createMemoryOrderStore, LOCAL_SHOP_ID } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import { ReturnFindOrderScreen } from './ReturnFindOrderScreen';

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

const openScanner = async () => {
  await fireEvent.press(screen.getByTestId('return-scan'));
  expect(await screen.findByTestId('return-scan-camera')).toBeOnTheScreen();
};

describe('UI-D02 Quét mã trên kiện hoàn (B02)', () => {
  it('mã quét khớp đúng một đơn: điền vào ô nhập, tra cứu, chờ người dùng xác nhận (không tự tạo hồ sơ)', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders);
    const store = createMemoryReturnStore();
    const create = jest.spyOn(store, 'createReturn');
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: store,
      orderStore: orders,
    });
    await openScanner();
    await act(async () => mockScanner.emit('SPX1234567890'));
    expect(await screen.findByText('Tìm thấy 1 đơn')).toBeOnTheScreen();
    expect(screen.getByTestId('return-code').props.value).toBe('SPX1234567890');
    expect(screen.queryByTestId('return-scan-panel')).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('return-use-order'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
  });

  it('mã quét không có đơn: báo chưa tìm thấy, vẫn tạo hồ sơ chưa liên kết kèm mã quan sát', async () => {
    const store = createMemoryReturnStore();
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: store,
      orderStore: createMemoryOrderStore(),
    });
    await openScanner();
    await act(async () => mockScanner.emit('KHONG-CO-DON'));
    expect(await screen.findByTestId('return-lookup-none')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-unlinked'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [, params] = mockNavigation.replace.mock.calls[0] as [unknown, { returnId: string }];
    const saved = await store.getReturn(LOCAL_SHOP_ID, params.returnId as ReturnCaseId);
    expect(saved?.returnCase.sourceOrderId).toBeNull();
    expect(saved?.returnCase.observedCode).toBe('KHONG-CO-DON');
  });

  it('camera đọc liên tục cùng một mã: chỉ tra một lần', async () => {
    const orders = createMemoryOrderStore();
    const lookup = jest.spyOn(orders, 'findOrdersByCodes');
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: orders,
    });
    await openScanner();
    await act(async () => {
      mockScanner.emit('ABC123');
      mockScanner.emit('ABC123');
      mockScanner.emit('ABC123');
    });
    await screen.findByTestId('return-lookup-none');
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('chưa cấp quyền camera: báo rõ, có nút cấp quyền, vẫn nhập tay được', async () => {
    mockScanner.permission = 'askable';
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: createMemoryOrderStore(),
    });
    await fireEvent.press(screen.getByTestId('return-scan'));
    expect(await screen.findByTestId('return-scan-unavailable')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-scan-allow'));
    expect(mockScanner.request).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('return-scan-manual'));
    expect(screen.queryByTestId('return-scan-panel')).toBeNull();
    expect(screen.getByTestId('return-code')).toBeOnTheScreen();
  });

  it('camera bị chặn hẳn: có lối mở Cài đặt; camera không mở được: báo lỗi và nhập tay', async () => {
    mockScanner.permission = 'blocked';
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: createMemoryOrderStore(),
    });
    await fireEvent.press(screen.getByTestId('return-scan'));
    expect(await screen.findByTestId('return-scan-settings')).toBeOnTheScreen();
  });

  it('camera không mở được: báo lỗi, không còn khung quét, nhập tay được', async () => {
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: createMemoryOrderStore(),
    });
    await openScanner();
    await act(async () => mockScanner.onError?.());
    expect(await screen.findByTestId('return-scan-unavailable')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-scan-camera')).toBeNull();
    await fireEvent.press(screen.getByTestId('return-scan-manual'));
    expect(screen.getByTestId('return-code')).toBeOnTheScreen();
  });

  const bg = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style).backgroundColor;

  it('không tự mở camera khi vào màn; Quét là nút chính đầu màn, ô nhập và Tìm nằm dưới', async () => {
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: createMemoryOrderStore(),
    });
    expect(screen.queryByTestId('return-scan-panel')).toBeNull();
    expect(screen.queryByTestId('return-scan-camera')).toBeNull();
    expect(mockScanner.request).not.toHaveBeenCalled();
    const order = ['return-scan', 'return-or-enter', 'return-code', 'return-search'];
    const json = JSON.stringify(screen.toJSON());
    const at = order.map((id) => json.indexOf(`"testID":"${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(bg('return-scan')).not.toEqual(bg('return-search'));
    expect(screen.getByTestId('return-unlinked')).toBeOnTheScreen();
  });

  it('gõ mã thì Tìm thành nút chính và Quét thành nút phụ (luôn một nút chính)', async () => {
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: createMemoryOrderStore(),
    });
    const scanWhenEmpty = bg('return-scan');
    const searchWhenEmpty = bg('return-search');
    await fireEvent.changeText(screen.getByTestId('return-code'), 'ABC');
    expect(bg('return-search')).toEqual(scanWhenEmpty);
    expect(bg('return-scan')).toEqual(searchWhenEmpty);
  });

  it('panel quét mở: ô nhập vẫn còn, không quyền camera vẫn nhập tay và tìm được', async () => {
    mockScanner.permission = 'blocked';
    const orders = createMemoryOrderStore();
    await seedOrder(orders);
    await renderWithProviders(<ReturnFindOrderScreen />, {
      returnStore: createMemoryReturnStore(),
      orderStore: orders,
    });
    await fireEvent.press(screen.getByTestId('return-scan'));
    expect(await screen.findByTestId('return-scan-unavailable')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('return-code'), 'SPX1234567890');
    await fireEvent.press(screen.getByTestId('return-search'));
    expect(await screen.findByText('Tìm thấy 1 đơn')).toBeOnTheScreen();
  });
});
