import { useState } from 'react';
import { Pressable } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import { ROUTES } from '@/core/navigation';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import type { ShopId } from '@/core/ids';

import { CurrentShopProvider, createMemoryOrderStore } from '../data';
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

describe('UI-B04 Tạo đơn nhanh (ORD-05) và Xác nhận (ORD-06)', () => {
  async function open(store: OrderStore = createMemoryOrderStore()) {
    await renderWithProviders(<QuickOrderScreen />, { orderStore: store });
    return store;
  }
  const next = () => fireEvent.press(screen.getByTestId('quick-continue'));
  const create = () => fireEvent.press(screen.getByTestId('quick-create'));

  it('có đủ thành phần: mã đơn, nguồn bán, sản phẩm (tên và variant riêng, SL mặc định 1), Tiếp tục, Hủy, trợ giúp; không còn nút quay ngay', async () => {
    await open();
    expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
    expect(screen.getByText('Tạo đơn nhanh')).toBeOnTheScreen();
    expect(screen.getByText('Mã đơn hàng')).toBeOnTheScreen();
    expect(screen.getByText('Nguồn bán hàng')).toBeOnTheScreen();
    expect(screen.getByTestId('line-name-0')).toBeOnTheScreen();
    expect(screen.getByTestId('line-variant-0')).toBeOnTheScreen();
    expect(screen.getByTestId('quantity-stepper')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeOnTheScreen();
    expect(screen.getByText('Thêm sản phẩm khác')).toBeOnTheScreen();
    expect(screen.queryByText(/Bỏ qua, quay ngay|Lưu và xác nhận/)).toBeNull();
    await fireEvent.press(screen.getByTestId('header-help'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.help);
  });

  it('mã quét/tìm điền sẵn từ tham số được giữ nguyên', async () => {
    mockNavigation.params = { code: 'SPX999' };
    await open();
    expect(screen.getByTestId('quick-order-code')).toHaveDisplayValue('SPX999');
  });

  it('nguồn bán mặc định "Khác / chưa xác định"; đổi bằng OrderSourcePicker (một lựa chọn, có dấu chọn)', async () => {
    await open();
    expect(screen.getByLabelText('Nguồn bán: Khác / chưa xác định')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('source-change'));
    expect(screen.getByTestId('source-option-other').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('source-option-shopee').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(screen.getByText('Nguồn bán chỉ để bạn phân loại đơn.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('source-option-tiktok_shop'));
    expect(screen.getByLabelText('Nguồn bán: TikTok Shop')).toBeOnTheScreen();
    expect(screen.queryByTestId('source-option-shopee')).toBeNull(); // sheet đã đóng
  });

  it('icon quét ở ô Mã đơn thay màn hiện tại bằng màn quét', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.scan);
  });

  it('nút xóa variant xóa nội dung ô variant', async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa phân loại' }));
    expect(screen.getByTestId('line-variant-0')).toHaveDisplayValue('');
  });

  describe('Tiếp tục: chỉ kiểm tra, chưa lưu', () => {
    it('mã trống: "Nhập mã đơn hàng nhé.", không sang xác nhận, không lưu', async () => {
      const store = await open();
      await next();
      expect(screen.getByText('Nhập mã đơn hàng nhé.')).toBeOnTheScreen();
      expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
      expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
    });

    it('mã quá dài: báo mã chưa hợp lệ', async () => {
      await open();
      await typeCode('X'.repeat(65));
      await next();
      expect(screen.getByText('Mã đơn chưa hợp lệ. Hãy kiểm tra lại.')).toBeOnTheScreen();
    });

    it('ô nhập cho quá trần một ký tự (không cắt âm thầm); tên/variant/mã vận đơn quá dài báo đúng ô (V1-04)', async () => {
      const store = await open();
      expect(screen.getByTestId('quick-order-code').props.maxLength).toBe(65);
      expect(screen.getByTestId('line-name-0').props.maxLength).toBe(201);
      expect(screen.getByTestId('line-variant-0').props.maxLength).toBe(201);
      await typeCode('DH-LONG');
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'a'.repeat(201));
      await next();
      expect(
        await screen.findByText('Tên sản phẩm dài quá 200 ký tự. Hãy rút gọn.'),
      ).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo');
      await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'v'.repeat(201));
      await next();
      expect(
        await screen.findByText('Phân loại dài quá 200 ký tự. Hãy rút gọn.'),
      ).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
      await fireEvent.press(screen.getByTestId('quick-add-tracking'));
      expect(screen.getByTestId('quick-tracking').props.maxLength).toBe(65);
      await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'T'.repeat(65));
      await next();
      expect(
        await screen.findByText('Mã vận đơn dài quá 64 ký tự hoặc có ký tự lạ. Hãy kiểm tra lại.'),
      ).toBeOnTheScreen();
      expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
      expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
    });

    it('variant mà không có tên: báo lỗi ở dòng (tên sản phẩm KHÔNG bắt buộc nếu không có variant)', async () => {
      await open();
      await typeCode('DH3');
      await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
      await next();
      expect(await screen.findByText('Hãy nhập tên sản phẩm cho phân loại này.')).toBeOnTheScreen();
      expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
    });

    it('không nhập sản phẩm vẫn sang xác nhận, hiện nhãn Chưa khai báo sản phẩm (bất biến 10)', async () => {
      const store = await open();
      await typeCode('DH-NOPRODUCT');
      await next();
      expect(screen.getByTestId('screen-UI-B04-confirm')).toBeOnTheScreen();
      expect(screen.getByText('Chưa khai báo sản phẩm')).toBeOnTheScreen();
      expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
    });
  });

  describe('Xác nhận (ORD-06)', () => {
    async function toConfirm(store: OrderStore = createMemoryOrderStore()) {
      await open(store);
      await typeCode('  dh-77 ');
      await fireEvent.press(screen.getByTestId('source-change'));
      await fireEvent.press(screen.getByTestId('source-option-lazada'));
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo thun cotton');
      await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen / XL');
      await fireEvent.press(screen.getByRole('button', { name: 'Tăng số lượng' }));
      await fireEvent.press(screen.getByTestId('quick-add-tracking'));
      await fireEvent.changeText(screen.getByTestId('quick-tracking'), ' spx-1 ');
      await next();
      return store;
    }

    it('tóm tắt: mã, nguồn, sản phẩm/variant/SL, mã vận đơn, ghi chú "do bạn nhập"; chưa lưu gì', async () => {
      const store = await toConfirm();
      expect(screen.getByText('Xác nhận đơn hàng')).toBeOnTheScreen();
      expect(screen.getByTestId('confirm-order-code')).toHaveTextContent('dh-77');
      expect(screen.getByTestId('confirm-source')).toHaveTextContent('Lazada');
      expect(screen.getByTestId('confirm-tracking')).toHaveTextContent('spx-1');
      expect(screen.getByText('Áo thun cotton')).toBeOnTheScreen();
      expect(screen.getByText('Đen / XL')).toBeOnTheScreen();
      expect(screen.getByText('Thông tin do bạn nhập, không lấy từ sàn.')).toBeOnTheScreen();
      expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
    });

    it('Quay lại chỉnh sửa giữ nguyên toàn bộ dữ liệu', async () => {
      await toConfirm();
      await fireEvent.press(screen.getByTestId('quick-back-edit'));
      expect(screen.getByTestId('quick-order-code')).toHaveDisplayValue('  dh-77 ');
      expect(screen.getByLabelText('Nguồn bán: Lazada')).toBeOnTheScreen();
      expect(screen.getByTestId('line-name-0')).toHaveDisplayValue('Áo thun cotton');
      expect(screen.getByTestId('line-variant-0')).toHaveDisplayValue('Đen / XL');
      expect(screen.getByTestId('quick-tracking')).toHaveDisplayValue(' spx-1 ');
    });

    it('Tạo đơn hàng: ghi ĐÚNG MỘT đơn (+ dòng + kiện 1, không phiên) rồi mở chi tiết bằng ID đơn', async () => {
      const store = await toConfirm();
      await create();
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      const [order, ...rest] = await allOrders(store, 'DH-77');
      expect(rest).toEqual([]);
      if (!order) throw new Error('đơn phải được lưu');
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderDetail, {
        orderId: order.id,
      });
      const saved = await store.getOrder(LOCAL_SHOP_ID, order.id);
      expect(saved?.order).toMatchObject({
        orderCode: 'dh-77',
        source: 'lazada',
        trackingCode: 'spx-1',
        dataOrigin: 'entered_by_user',
      });
      expect(saved?.lines.map((l) => [l.name, l.variant, l.quantity])).toEqual([
        ['Áo thun cotton', 'Đen / XL', 2],
      ]);
      expect(saved?.packages).toHaveLength(1);
      // đơn mới không có phiên (không "bằng chứng", không quay)
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, order.id)).toEqual([]);
      expect(mockNavigation.push).not.toHaveBeenCalledWith(ROUTES.packRecord, expect.anything());
    });

    it('nhiều dòng cùng tên khác variant được giữ riêng, không gộp', async () => {
      const store = await open();
      await typeCode('DH2');
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo');
      await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Đen');
      await fireEvent.press(screen.getByTestId('quick-add-line'));
      await fireEvent.changeText(screen.getByTestId('line-name-1'), 'Áo');
      await fireEvent.changeText(screen.getByTestId('line-variant-1'), 'Trắng');
      await next();
      await create();
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      const [order] = await allOrders(store, 'DH2');
      const saved = order ? await store.getOrder(LOCAL_SHOP_ID, order.id) : null;
      expect(saved?.lines.map((l) => l.variant)).toEqual(['Đen', 'Trắng']);
    });

    it('bấm Tạo liên tục chỉ tạo một đơn và điều hướng một lần', async () => {
      const store = await toConfirm();
      const button = screen.getByTestId('quick-create');
      await act(async () => {
        void fireEvent.press(button);
        void fireEvent.press(button);
        void fireEvent.press(button);
      });
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await allOrders(store, 'DH-77')).toHaveLength(1);
      expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
    });

    it('lỗi lưu: giữ form, câu "Chưa tạo được đơn…", Thử lại dùng đúng ID cũ và không tạo hai bản ghi', async () => {
      const store = createMemoryOrderStore();
      const seen: string[] = [];
      let fail = true;
      const flaky: OrderStore = {
        ...store,
        saveNewOrder: async (details) => {
          seen.push(
            details.order.id,
            ...details.lines.map((l) => l.id),
            ...details.packages.map((p) => p.id),
          );
          if (fail) throw new AppError('ORDER_SAVE_FAILED');
          return store.saveNewOrder(details);
        },
      };
      await toConfirm(flaky);
      await create();
      expect(await screen.findByTestId('save-error')).toBeOnTheScreen();
      expect(
        screen.getByText('Chưa tạo được đơn. Thông tin bạn nhập vẫn được giữ lại.'),
      ).toBeOnTheScreen();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
      expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
      fail = false;
      await waitFor(() => expect(screen.getByTestId('quick-create')).toBeEnabled());
      await create();
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await allOrders(store, 'DH-77')).toHaveLength(1);
      const half = seen.length / 2;
      expect(seen.slice(0, half)).toEqual(seen.slice(half)); // cùng ID đơn/dòng/kiện ở lần thử lại
    });

    it('đã lưu xong nhưng kết quả bị mất (lỗi sau khi ghi): Thử lại KHÔNG tạo bản thứ hai, chỉ mở đơn đó', async () => {
      const store = createMemoryOrderStore();
      let first = true;
      const lossy: OrderStore = {
        ...store,
        saveNewOrder: async (details) => {
          await store.saveNewOrder(details);
          if (first) {
            first = false;
            throw new AppError('ORDER_SAVE_FAILED');
          }
        },
      };
      await toConfirm(lossy);
      await create();
      expect(await screen.findByTestId('save-error')).toBeOnTheScreen();
      await waitFor(() => expect(screen.getByTestId('quick-create')).toBeEnabled());
      await create();
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await allOrders(store, 'DH-77')).toHaveLength(1);
    });

    it('lưu xong nhưng kết quả mất, rồi người dùng SỬA form: không mở bản cũ làm mất phần sửa, không ghi đè; đơn đã lưu hiện ở hộp trùng, Vẫn tạo thì tạo đơn mới với nội dung đã sửa', async () => {
      const store = createMemoryOrderStore();
      let first = true;
      const lossy: OrderStore = {
        ...store,
        saveNewOrder: async (details) => {
          await store.saveNewOrder(details);
          if (first) {
            first = false;
            throw new AppError('ORDER_SAVE_FAILED');
          }
        },
      };
      await toConfirm(lossy);
      await create();
      expect(await screen.findByTestId('save-error')).toBeOnTheScreen();
      await waitFor(() => expect(screen.getByTestId('quick-create')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('quick-back-edit'));
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo đã sửa');
      await next();
      await create();
      expect(await screen.findByText('Đơn này đã có')).toBeOnTheScreen();
      expect(mockNavigation.replace).not.toHaveBeenCalled();
      const [old] = await allOrders(store, 'DH-77');
      expect((await store.getOrder(LOCAL_SHOP_ID, old?.id as never))?.lines[0]?.name).toBe(
        'Áo thun cotton',
      ); // bản đã lưu không bị ghi đè
      await fireEvent.press(screen.getByTestId('order-match-create-anyway'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      const orders = await allOrders(store, 'DH-77');
      expect(orders).toHaveLength(2);
      const created = orders.find((o) => o.id !== old?.id);
      expect((await store.getOrder(LOCAL_SHOP_ID, created?.id as never))?.lines[0]?.name).toBe(
        'Áo đã sửa',
      );
    });

    it('shop lấy LÚC BẤM Tạo: đổi shop giữa Tiếp tục và Tạo thì ghi vào shop mới', async () => {
      const store = createMemoryOrderStore();
      function Harness() {
        const [shop, setShop] = useState('shop-a');
        return (
          <>
            <Pressable testID="switch" onPress={() => setShop('shop-b')} />
            <CurrentShopProvider shopId={shop}>
              <QuickOrderScreen />
            </CurrentShopProvider>
          </>
        );
      }
      await renderWithProviders(<Harness />, { orderStore: store });
      await typeCode('DH-SHOP');
      await next();
      await act(async () => fireEvent.press(screen.getByTestId('switch')));
      await create();
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await store.countOrders('shop-a' as ShopId, {})).toBe(0);
      expect(await store.countOrders('shop-b' as ShopId, {})).toBe(1);
    });
  });

  describe('trùng mã (ORD-14, ADR-011): kiểm ở bước Tạo đơn hàng', () => {
    async function setup(
      options: { tracking?: string; code?: string; source?: 'tiktok_shop' | 'other' } = {},
    ) {
      const store = createMemoryOrderStore();
      const existing = await seedOrder(store, sampleOrder({ withLines: false }));
      await open(store);
      if ((options.source ?? 'tiktok_shop') === 'tiktok_shop') {
        await fireEvent.press(screen.getByTestId('source-change'));
        await fireEvent.press(screen.getByTestId('source-option-tiktok_shop'));
      }
      await typeCode(options.code ?? ' dh1234567890 ');
      if (options.tracking) {
        await fireEvent.press(screen.getByTestId('quick-add-tracking'));
        await fireEvent.changeText(screen.getByTestId('quick-tracking'), options.tracking);
      }
      await next();
      await create();
      return { store, existing };
    }

    it('cùng mã đơn + nguồn: hiện đơn đã có, KHÔNG tạo, KHÔNG gắn gì vào đơn cũ, không điều hướng', async () => {
      const { store, existing } = await setup();
      expect(await screen.findByText('Đơn này đã có')).toBeOnTheScreen();
      expect(screen.getByTestId(`order-match-${existing.order.id}`)).toBeOnTheScreen();
      expect(screen.getByText('Trùng mã đơn')).toBeOnTheScreen();
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(1);
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, existing.order.id)).toEqual([]);
      expect(mockNavigation.replace).not.toHaveBeenCalled();
    });

    it('Xem đơn hiện có mở chi tiết bằng ID của đơn đã có', async () => {
      const { existing } = await setup();
      await fireEvent.press(await screen.findByTestId(`order-match-${existing.order.id}`));
      expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orderDetail, {
        orderId: existing.order.id,
      });
    });

    it('Quay lại chỉnh sửa đóng hộp và giữ nguyên form', async () => {
      await setup();
      await fireEvent.press(await screen.findByTestId('order-match-back-edit'));
      expect(screen.queryByTestId('order-match-sheet')).toBeNull();
      expect(screen.getByTestId('quick-create')).toBeEnabled();
    });

    it('trùng mã đơn + nguồn vẫn có nút phụ Vẫn tạo đơn mới (khôi phục hành vi cũ); nút chính là xem đơn hiện có', async () => {
      const { store, existing } = await setup();
      expect(await screen.findByTestId('order-match-create-anyway')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('order-match-create-anyway'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      const orders = await allOrders(store, 'DH1234567890');
      expect(orders).toHaveLength(2);
      const created = orders.find((o) => o.id !== existing.order.id);
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderDetail, {
        orderId: created?.id,
      });
      // đơn cũ không bị đổi, không gắn phiên/dòng nào vào nó
      expect((await store.getOrder(LOCAL_SHOP_ID, existing.order.id))?.lines).toEqual([]);
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, existing.order.id)).toEqual([]);
    });

    it('bấm Vẫn tạo đơn mới hai lần liên tiếp: chỉ thêm MỘT đơn (cùng ID)', async () => {
      const { store } = await setup();
      const button = await screen.findByTestId('order-match-create-anyway');
      await act(async () => {
        void fireEvent.press(button);
        void fireEvent.press(button);
      });
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(2);
      expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
    });

    it('trùng mã vận đơn (kiện gộp hai đơn chung mã vận đơn): vẫn tạo được đơn mới', async () => {
      const { store, existing } = await setup({
        source: 'other',
        code: 'DH-GOP-2',
        tracking: 'spx1234567890',
      });
      expect(await screen.findByText('Trùng mã vận đơn')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('order-match-create-anyway'));
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await allOrders(store, 'DH-GOP-2')).toHaveLength(1);
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(1);
      expect((await store.getOrder(LOCAL_SHOP_ID, existing.order.id))?.order.trackingCode).toBe(
        'SPX1234567890',
      );
    });

    it('cùng mã nhưng khác nguồn bán thì không coi là trùng', async () => {
      const { store } = await setup({ source: 'other' });
      await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(2);
    });

    it('cùng mã đơn khác nguồn NHƯNG trùng mã vận đơn: vẫn báo, không tự gộp', async () => {
      const { store, existing } = await setup({ source: 'other', tracking: 'spx1234567890' });
      expect(await screen.findByText('Trùng mã vận đơn')).toBeOnTheScreen();
      expect(screen.getByTestId(`order-match-${existing.order.id}`)).toBeOnTheScreen();
      expect(await allOrders(store, 'DH1234567890')).toHaveLength(1);
    });
  });

  describe('đóng form có dữ liệu chưa lưu', () => {
    it('chưa nhập gì: Hủy thoát ngay; mã điền sẵn từ quét không tính là thay đổi', async () => {
      mockNavigation.params = { code: 'SPX1' };
      await open();
      expect(mockNavigation.leaveGuardEnabled).toBe(false);
      await fireEvent.press(screen.getByTestId('quick-cancel'));
      expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    });

    it('có dữ liệu: hỏi Bỏ thay đổi?; Tiếp tục nhập ở lại, Bỏ thay đổi mới thoát (không lưu gì)', async () => {
      const store = await open();
      await typeCode('DH-DIRTY');
      expect(mockNavigation.leaveGuardEnabled).toBe(true);
      await fireEvent.press(screen.getByTestId('quick-cancel'));
      expect(screen.getByText('Bỏ thay đổi?')).toBeOnTheScreen();
      expect(mockNavigation.back).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục nhập' }));
      expect(screen.queryByText('Bỏ thay đổi?')).toBeNull();
      expect(screen.getByTestId('quick-order-code')).toHaveDisplayValue('DH-DIRTY');
      await fireEvent.press(screen.getByTestId('quick-cancel'));
      await fireEvent.press(screen.getByTestId('quick-leave-confirm'));
      expect(mockNavigation.back).toHaveBeenCalledTimes(1);
      expect(await store.countOrders(LOCAL_SHOP_ID, {})).toBe(0);
    });

    it('cố rời màn bằng Back/cử chỉ khi có dữ liệu: hiện hộp xác nhận', async () => {
      await open();
      await typeCode('DH-DIRTY');
      await act(async () => mockNavigation.attemptLeave?.());
      expect(screen.getByText('Bỏ thay đổi?')).toBeOnTheScreen();
    });
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
});
