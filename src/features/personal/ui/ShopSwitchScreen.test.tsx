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

/** Chọn hàng rồi bấm "Xác nhận" ở chân màn (board 07 khung 7a). */
async function pick(id: string) {
  await fireEvent.press(screen.getByTestId(`switch-shop-item-${id}`));
  await fireEvent.press(screen.getByTestId('switch-shop-submit'));
}

/**
 * Nút xác nhận TRONG hộp thoại 7b. `Modal` trong test vẫn hiện màn nền (có nút "Xác nhận" ở chân màn),
 * nên luôn lấy theo testID.
 */
const confirmDialog = () => fireEvent.press(screen.getByTestId('switch-shop-dialog-confirm'));
const DIALOG_TITLE = 'Xác nhận chuyển cửa hàng';

describe('ShopSwitchScreen (UI-I02 route con, PER-07)', () => {
  it('liệt kê shop có quyền: tên, trạng thái, vai trò; đang dùng có nhãn; shop bị khóa không chọn được', async () => {
    const gateways = await setup();
    expect(screen.getByTestId('switch-shop-item-shop-a')).toHaveTextContent(
      /Shop A.*Đang dùng.*Chủ cửa hàng/,
    );
    expect(screen.getByTestId('switch-shop-item-shop-b')).toHaveTextContent(
      /Shop B.*Đang hoạt động.*Thành viên/,
    );
    expect(screen.getByTestId('switch-shop-item-shop-c')).toHaveTextContent(/Bị khóa/);
    expect(screen.queryByText(/Tạm khóa/)).toBeNull();
    // Không chọn được: bấm hàng không làm nút "Xác nhận" bật, bấm nút cũng không mở hộp thoại.
    await fireEvent.press(screen.getByTestId('switch-shop-item-shop-c'));
    await fireEvent.press(screen.getByTestId('switch-shop-item-shop-a'));
    expect(screen.getByTestId('switch-shop-submit').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('switch-shop-submit'));
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.getByTestId('switch-shop-item-shop-c').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('switch-shop-item-shop-c').props.accessibilityLabel).toMatch(
      /Cửa hàng đang bị khóa nên chưa chuyển vào được/,
    );
  });

  it('chọn hàng: dấu tích bên phải và nút "Xác nhận" bật; chọn hàng khác thì dấu tích chuyển theo; chưa gọi cổng', async () => {
    const gateways = await setup({
      gateways: createFakePersonalGateways({
        shops: [SHOP_A, SHOP_B, { ...SHOP_B, id: 'shop-d', name: 'Shop D' }],
      }),
    });
    const submit = () => screen.getByTestId('switch-shop-submit').props.accessibilityState.disabled;
    const selectedOf = (id: string) =>
      screen.getByTestId(`switch-shop-item-${id}`).props.accessibilityState.selected;
    expect(submit()).toBe(true);
    await fireEvent.press(screen.getByTestId('switch-shop-item-shop-b'));
    expect(submit()).toBe(false);
    expect(selectedOf('shop-b')).toBe(true);
    expect(screen.getByTestId('switch-shop-item-shop-b').props.accessibilityLabel).toMatch(
      /Đã chọn/,
    );
    await fireEvent.press(screen.getByTestId('switch-shop-item-shop-d'));
    expect(selectedOf('shop-b')).toBe(false);
    expect(selectedOf('shop-d')).toBe(true);
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
  });

  it('ít cửa hàng (dưới ngưỡng): không có ô tìm', async () => {
    await setup();
    expect(screen.queryByTestId('switch-shop-search')).toBeNull();
  });

  describe('ô tìm (từ 6 cửa hàng)', () => {
    const many: ShopSummary[] = [
      SHOP_A,
      { ...SHOP_B, id: 'shop-my-pham', name: 'Shop Mỹ Phẩm' },
      { ...SHOP_B, id: 'shop-gia-dung', name: 'Shop Gia Dụng' },
      { ...SHOP_B, id: 'shop-phu-kien', name: 'Shop Phụ Kiện' },
      { ...SHOP_B, id: 'shop-do-choi', name: 'Đồ Chơi Bé' },
      SHOP_C,
    ];

    it('hiện ô tìm; gõ không dấu vẫn lọc đúng; xóa chữ thì hiện lại đủ', async () => {
      await setup({ gateways: createFakePersonalGateways({ shops: many }) });
      const search = screen.getByTestId('switch-shop-search');
      await fireEvent.changeText(search, 'my pham');
      expect(screen.getByTestId('switch-shop-item-shop-my-pham')).toBeOnTheScreen();
      expect(screen.queryByTestId('switch-shop-item-shop-gia-dung')).toBeNull();
      expect(screen.queryByTestId('switch-shop-item-shop-a')).toBeNull();
      await fireEvent.changeText(search, 'do choi');
      expect(screen.getByTestId('switch-shop-item-shop-do-choi')).toBeOnTheScreen();
      await fireEvent.changeText(search, '');
      expect(screen.getAllByTestId(/^switch-shop-item-/)).toHaveLength(6);
    });

    it('không khớp: báo rõ, không còn hàng nào; chọn rồi tìm vẫn chuyển đúng cửa hàng đã chọn', async () => {
      const gateways = await setup({ gateways: createFakePersonalGateways({ shops: many }) });
      await fireEvent.press(screen.getByTestId('switch-shop-item-shop-gia-dung'));
      await fireEvent.changeText(screen.getByTestId('switch-shop-search'), 'khong co');
      expect(screen.getByTestId('switch-shop-no-match')).toHaveTextContent(
        'Không có cửa hàng nào khớp.',
      );
      expect(screen.queryByTestId('switch-shop-list')).toBeNull();
      await fireEvent.press(screen.getByTestId('switch-shop-submit'));
      await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
      // Hộp thoại nêu đúng tên cửa hàng đã chọn, không phải kết quả tìm.
      expect(screen.getByTestId('switch-shop-dialog-message')).toHaveTextContent(/Shop Gia Dụng/);
      await confirmDialog();
      await waitFor(() => expect(gateways.account.switchShopCalls).toEqual(['shop-gia-dung']));
    });
  });

  it('7b: hỏi xác nhận nêu đúng tên shop đích và lời trấn an dữ liệu; "Hủy" không gọi cổng, không đổi phiên', async () => {
    const gateways = await setup();
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
    expect(screen.getByTestId('switch-shop-dialog-message')).toHaveTextContent(
      'Bạn có chắc chắn muốn chuyển sang Shop B?',
    );
    expect(
      screen.getByText('Dữ liệu của cửa hàng hiện tại vẫn được giữ trên máy.'),
    ).toBeOnTheScreen();
    // Hai nút cạnh nhau: Hủy (trái), Xác nhận (phải).
    expect(screen.getByTestId('switch-shop-dialog-confirm')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Hủy'));
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-a');
  });

  it('xác nhận: gọi cổng, đổi phiên sang shop mới, về Tổng quan, báo thành công SAU khi xong', async () => {
    const gateways = await setup();
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
    await confirmDialog();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.home));
    expect(gateways.account.switchShopCalls).toEqual(['shop-b']);
    expect(screen.getByTestId('probe-key')).toHaveTextContent('fake-user-1:shop-b');
    expect(screen.getByText('Đã chuyển sang Shop B.')).toBeOnTheScreen();
  });

  it('cổng lỗi: giữ shop hiện tại, không điều hướng, không báo thành công, báo lỗi', async () => {
    const gateways = await setup();
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
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
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
    const button = screen.getByTestId('switch-shop-dialog-confirm');
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
    expect(screen.getByTestId('switch-shop-recording')).toHaveTextContent(
      'Bạn đang quay video đóng gói. Hãy dừng quay trước khi chuyển.',
    );
    expect(screen.getByText('Không thể chuyển cửa hàng')).toBeOnTheScreen();
    expect(hasRecording).toHaveBeenCalledWith('shop-a');
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    // 7c: nút "Chuyển cửa hàng" hiện nhưng vô hiệu: bấm không làm gì; "Ở lại" đóng hộp thoại.
    const blocked = screen.getByTestId('switch-shop-recording-switch');
    expect(blocked.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(blocked);
    expect(gateways.account.switchShopCalls).toEqual([]);
    expect(screen.getByTestId('switch-shop-recording')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ở lại'));
    await waitFor(() => expect(screen.queryByTestId('switch-shop-recording')).toBeNull());
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
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
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
    await fireEvent.press(screen.getByTestId('switch-shop-item-local-shop'));
    expect(screen.getByTestId('switch-shop-submit').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(gateways.account.switchShopCalls).toEqual([]);
    // Shop khác vẫn chuyển được.
    await pick('shop-b');
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
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
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
    await confirmDialog();
    await waitFor(() => expect(screen.getByText(/DON-CUA-B/)).toBeOnTheScreen());
    expect(screen.queryByText(/DON-CUA-A/)).toBeNull();

    await pick('shop-a');
    await waitFor(() => expect(screen.getByText(DIALOG_TITLE)).toBeOnTheScreen());
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
