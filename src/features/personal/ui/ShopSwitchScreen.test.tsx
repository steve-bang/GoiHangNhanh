import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { OrderId, PackageId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import {
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
  OrdersListScreen,
  type OrderDetails,
  type OrderStore,
} from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import type { ShopSummary } from '../domain/types';
import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { ShopSwitchScreen } from './ShopSwitchScreen';
import { beginProbeSession, SessionProbe, SHOP_A, SHOP_B, SHOP_C } from './shop-test-kit';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);

beforeEach(() => resetMockNavigation());

const withStore = (overrides: Partial<OrderStore>): OrderStore => ({
  ...createMemoryOrderStore(),
  ...overrides,
});

async function setup(
  options: {
    store?: OrderStore;
    gateways?: ReturnType<typeof createFakePersonalGateways>;
    withList?: boolean;
  } = {},
) {
  const gateways =
    options.gateways ?? createFakePersonalGateways({ shops: [SHOP_A, SHOP_B, SHOP_C] });
  await renderWithProviders(
    <>
      <SessionProbe />
      <ShopSwitchScreen />
      {options.withList ? <OrdersListScreen /> : null}
    </>,
    { personalGateways: gateways, orderStore: options.store ?? createMemoryOrderStore() },
  );
  await beginProbeSession();
  await waitFor(() => expect(screen.getByTestId('switch-shop-list')).toBeOnTheScreen());
  return gateways;
}

const pick = (id: string) => fireEvent.press(screen.getByTestId(`switch-shop-item-${id}`));

/** Nút xác nhận trong hộp thoại (tiêu đề màn cũng là "Chuyển cửa hàng"): lấy phần tử cuối. */
async function confirmDialog() {
  const buttons = screen.getAllByText('Chuyển cửa hàng');
  const last = buttons.at(-1);
  if (!last) throw new Error('Không thấy nút xác nhận');
  await fireEvent.press(last);
}

describe('ShopSwitchScreen (UI-I02 route con, PER-07)', () => {
  it('liệt kê shop có quyền: tên, vai trò; shop đang dùng có nhãn; shop tạm khóa không chọn được', async () => {
    const gateways = await setup();
    expect(screen.getByTestId('switch-shop-item-shop-a')).toHaveTextContent(
      /Shop A.*Chủ cửa hàng.*Đang dùng/,
    );
    expect(screen.getByTestId('switch-shop-item-shop-b')).toHaveTextContent(/Shop B.*Thành viên/);
    expect(screen.getByTestId('switch-shop-item-shop-c')).toHaveTextContent(/Tạm khóa/);
    await pick('shop-c');
    await pick('shop-a');
    expect(screen.queryByText('Chuyển cửa hàng?')).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
  });

  it('chọn shop: hỏi xác nhận; "Ở lại" không gọi cổng và không đổi phiên', async () => {
    const gateways = await setup();
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
    expect(screen.getByText(/Bạn sẽ xem đơn và video của Shop B/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ở lại'));
    expect(screen.queryByText('Chuyển cửa hàng?')).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-a');
  });

  it('xác nhận: gọi cổng, đổi phiên sang shop mới, về Tổng quan, báo thành công SAU khi xong', async () => {
    const gateways = await setup();
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
    await confirmDialog();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home));
    expect(gateways.account.switchShopCalls).toEqual(['shop-b']);
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-b');
    expect(screen.getByText('Đã chuyển sang Shop B.')).toBeOnTheScreen();
  });

  it('cổng lỗi: giữ shop hiện tại, không điều hướng, không báo thành công, báo lỗi', async () => {
    const gateways = await setup();
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
    gateways.account.failNext('SHOP_SWITCH_FAILED');
    await confirmDialog();
    expect(await screen.findByText(/Chưa chuyển được cửa hàng/)).toBeOnTheScreen();
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-a');
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.queryByText(/Đã chuyển sang/)).toBeNull();
  });

  it('chống bấm lặp: bấm xác nhận nhiều lần chỉ gọi cổng một lần', async () => {
    const gateways = createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] });
    let release: () => void = () => undefined;
    const original = gateways.account.switchShop.bind(gateways.account);
    gateways.account.switchShop = (id) =>
      new Promise((resolve) => {
        release = () => resolve(original(id));
      });
    await setup({ gateways });
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
    const button = screen.getAllByText('Chuyển cửa hàng').at(-1);
    if (!button) throw new Error('fixture');
    await fireEvent.press(button);
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-a');
    await act(async () => release());
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledTimes(1));
    expect(gateways.account.switchShopCalls).toEqual(['shop-b']);
  });

  it('đang quay: chặn, hỏi kho bằng shop ĐANG DÙNG, không gọi cổng, không đổi phiên', async () => {
    const hasRecording = jest.fn().mockResolvedValue(true);
    const gateways = await setup({ store: withStore({ hasRecordingInProgress: hasRecording }) });
    await pick('shop-b');
    await waitFor(() => expect(screen.getByTestId('switch-shop-recording')).toBeOnTheScreen());
    expect(screen.getByText(/kết thúc phiên quay trước khi chuyển cửa hàng/)).toBeOnTheScreen();
    expect(hasRecording).toHaveBeenCalledWith('shop-a');
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.queryByText('Chuyển cửa hàng?')).toBeNull();
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-a');
  });

  it('còn tệp chưa đồng bộ: cảnh báo kèm số lượng, có lối tới trung tâm đồng bộ; không tự chuyển', async () => {
    const gateways = await setup({
      store: withStore({ countUnsynced: jest.fn().mockResolvedValue(3) }),
    });
    await pick('shop-b');
    await waitFor(() => expect(screen.getByTestId('switch-shop-unsynced')).toBeOnTheScreen());
    expect(screen.getByTestId('switch-shop-unsynced')).toHaveTextContent(/còn 3 tệp/i);
    expect(gateways.account.switchShopCalls).toEqual([]);
    await fireEvent.press(screen.getByTestId('switch-shop-open-sync'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
    expect(gateways.account.switchShopCalls).toEqual([]);
  });

  it('còn tệp chưa đồng bộ: "Vẫn chuyển cửa hàng" thì chuyển (dữ liệu cục bộ giữ nguyên, Q-20o)', async () => {
    const gateways = await setup({
      store: withStore({ countUnsynced: jest.fn().mockResolvedValue(2) }),
    });
    await pick('shop-b');
    await waitFor(() => expect(screen.getByTestId('switch-shop-continue')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('switch-shop-continue'));
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home));
    expect(gateways.account.switchShopCalls).toEqual(['shop-b']);
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-b');
  });

  it('không đọc được kho cục bộ: chặn bảo thủ, báo lỗi, không gọi cổng', async () => {
    const gateways = await setup({
      store: withStore({
        hasRecordingInProgress: jest.fn().mockRejectedValue(new Error('db')),
      }),
    });
    await pick('shop-b');
    expect(await screen.findByText(/Chưa chuyển được cửa hàng/)).toBeOnTheScreen();
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.queryByText('Chuyển cửa hàng?')).toBeNull();
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-a');
  });

  it('phiên chưa biết shop (shopId null): shop hiệu lực là LOCAL_SHOP_ID, "Đang dùng" đúng và không cho chuyển sang chính nó', async () => {
    const local: ShopSummary = { ...SHOP_A, id: LOCAL_SHOP_ID, name: 'Shop local' };
    const gateways = createFakePersonalGateways({ shops: [local, SHOP_B] });
    await renderWithProviders(
      <>
        <SessionProbe shopId={null} />
        <ShopSwitchScreen />
      </>,
      { personalGateways: gateways },
    );
    await beginProbeSession();
    await waitFor(() => expect(screen.getByTestId('switch-shop-list')).toBeOnTheScreen());
    expect(screen.getByTestId('switch-shop-item-local-shop')).toHaveTextContent(/Đang dùng/);
    expect(screen.getByTestId('switch-shop-item-shop-b')).not.toHaveTextContent(/Đang dùng/);
    await pick('local-shop');
    expect(screen.queryByText('Chuyển cửa hàng?')).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
    // Shop khác vẫn chuyển được.
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
  });

  it('không tải được danh sách: lỗi cục bộ có Thử lại', async () => {
    const gateways = createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] });
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderWithProviders(<ShopSwitchScreen />, { personalGateways: gateways });
    expect(await screen.findByTestId('switch-shop-error')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('switch-shop-list')).toBeOnTheScreen());
  });
});

/** Đơn của một shop: dựa trên đơn mẫu nhưng đổi ID/mã/shop (đơn mẫu mang `LOCAL_SHOP_ID`). */
function orderOf(shopId: string, code: string): OrderDetails {
  const base = sampleOrder({ withLines: false });
  const id = `order-${code}` as OrderId;
  return {
    ...base,
    order: { ...base.order, id, shopId: shopId as never, orderCode: code },
    packages: base.packages.map((p) => ({ ...p, id: `pkg-${code}` as PackageId, orderId: id })),
  };
}

describe('cô lập dữ liệu theo shop khi chuyển (bất biến 8)', () => {
  it('A -> B: danh sách đơn không còn đơn của A; quay lại A thấy đúng đơn của A', async () => {
    const store = createMemoryOrderStore();
    await store.saveNewOrder(orderOf('shop-a', 'DON-CUA-A'));
    await store.saveNewOrder(orderOf('shop-b', 'DON-CUA-B'));
    await setup({ store, withList: true });
    await waitFor(() => expect(screen.getByText(/DON-CUA-A/)).toBeOnTheScreen());
    expect(screen.queryByText(/DON-CUA-B/)).toBeNull();

    await pick('shop-b');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
    await confirmDialog();
    await waitFor(() => expect(screen.getByText(/DON-CUA-B/)).toBeOnTheScreen());
    expect(screen.queryByText(/DON-CUA-A/)).toBeNull();

    await pick('shop-a');
    await waitFor(() => expect(screen.getByText('Chuyển cửa hàng?')).toBeOnTheScreen());
    await confirmDialog();
    await waitFor(() => expect(screen.getByText(/DON-CUA-A/)).toBeOnTheScreen());
    expect(screen.queryByText(/DON-CUA-B/)).toBeNull();
  });

  it('kho cũng không trả đơn của shop khác khi hỏi bằng shop của phiên', async () => {
    const store = createMemoryOrderStore();
    const a = orderOf('shop-a', 'DON-CUA-A');
    await store.saveNewOrder(a);
    expect(await store.getOrder('shop-b' as never, a.order.id)).toBeNull();
    expect(await store.getOrder('shop-a' as never, a.order.id)).not.toBeNull();
  });
});
