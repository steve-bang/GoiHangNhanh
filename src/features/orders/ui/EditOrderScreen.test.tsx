import { useState } from 'react';
import { Pressable } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import type { SessionId, ShopId } from '@/core/ids';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { CurrentShopProvider, createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import { LOCAL_SHOP_ID, type OrderDetails, type OrderStore } from '../domain';
import { buildPackingSession } from '../domain/start-session';
import { EditOrderScreen } from './EditOrderScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => {
  resetMockNavigation();
});

async function seed(
  store: OrderStore,
  code = 'ED-1',
  options: Parameters<typeof makeOrder>[1] = {},
) {
  const d = makeOrder(code, {
    tracking: 'TRK-1',
    at: 1000,
    lines: [
      { name: 'Áo thun', variant: 'Đen', quantity: 2 },
      { name: 'Quần', quantity: 1 },
    ],
    ...options,
  });
  await store.saveNewOrder(d);
  return d;
}
async function open(store: OrderStore, d: OrderDetails) {
  mockNavigation.params = { orderId: d.order.id };
  await renderWithProviders(<EditOrderScreen />, { orderStore: store });
  await screen.findByTestId('order-edit-code');
}
const save = () => fireEvent.press(screen.getByTestId('order-edit-save'));

describe('UI-E02 Sửa thông tin đơn (route con, ORD-08)', () => {
  it('nạp đơn: mã đơn KHÓA (chỉ đọc, có chú thích), nguồn, các dòng, mã vận đơn; Lưu tắt khi chưa đổi', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    await open(store, d);
    expect(screen.getByTestId('screen-UI-E02-edit')).toBeOnTheScreen();
    expect(screen.getByTestId('order-edit-code')).toHaveTextContent('ED-1');
    expect(screen.getByText('Mã đơn không đổi được sau khi tạo.')).toBeOnTheScreen();
    expect(screen.queryByTestId('quick-order-code')).toBeNull(); // không có ô nhập mã đơn
    expect(screen.getByLabelText('Nguồn bán: Shopee')).toBeOnTheScreen();
    expect(screen.getByTestId('line-name-0')).toHaveDisplayValue('Áo thun');
    expect(screen.getByTestId('line-variant-0')).toHaveDisplayValue('Đen');
    expect(screen.getByTestId('line-name-1')).toHaveDisplayValue('Quần');
    expect(screen.getByTestId('quick-tracking')).toHaveDisplayValue('TRK-1');
    expect(screen.getByTestId('order-edit-save')).toBeDisabled();
    expect(screen.queryByText(/Ghi chú/)).toBeNull();
  });

  it('sửa nguồn, mã vận đơn, dòng (sửa/thêm/xóa): lưu ĐÚNG đơn/dòng, toast, quay về chi tiết; mã đơn và ID đơn giữ nguyên', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    const other = await seed(store, 'OTHER-1', { tracking: 'ZZZ' });
    const [a] = d.lines;
    await open(store, d);
    await fireEvent.press(screen.getByTestId('source-change'));
    await fireEvent.press(screen.getByTestId('source-option-lazada'));
    await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'NEW-77');
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), 'Trắng');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Xóa dòng sản phẩm này' })[1] as never,
    ); // bỏ dòng Quần
    await fireEvent.press(screen.getByTestId('quick-add-line'));
    await fireEvent.changeText(screen.getByTestId('line-name-1'), 'Nón');
    expect(screen.getByTestId('order-edit-save')).toBeEnabled();
    await save();
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
    expect(await screen.findByText('Đã cập nhật thông tin đơn.')).toBeOnTheScreen();
    const saved = await store.getOrder(LOCAL_SHOP_ID, d.order.id);
    expect(saved?.order).toMatchObject({
      id: d.order.id,
      orderCode: 'ED-1',
      source: 'lazada',
      trackingCode: 'NEW-77',
    });
    expect(saved?.lines[0]?.id).toBe(a?.id);
    // đơn khác không bị đụng
    expect(await store.getOrder(LOCAL_SHOP_ID, other.order.id)).toEqual(other);
    expect(saved?.lines.map((l) => l.name)).toEqual(['Áo thun', 'Nón']); // Quần bị xóa, Nón mới thêm
    expect(saved?.lines[0]).toMatchObject({ name: 'Áo thun', variant: 'Trắng', quantity: 2 });
  });

  it('đơn đã có phiên: form không mở, chỉ có câu giải thích; không sửa được', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    const pkg = d.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(d, pkg.id, { sessionId: 's1' as SessionId, nowDevice: 2000 });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    mockNavigation.params = { orderId: d.order.id };
    await renderWithProviders(<EditOrderScreen />, { orderStore: store });
    expect(await screen.findByTestId('order-edit-locked')).toBeOnTheScreen();
    expect(screen.getByText('Đơn đã bắt đầu quay nên chưa sửa được thông tin.')).toBeOnTheScreen();
    expect(screen.queryByTestId('order-edit-save')).toBeNull();
    expect(await store.getOrder(LOCAL_SHOP_ID, d.order.id)).toEqual(d);
  });

  it('phiên được tạo SAU khi mở form: lưu bị từ chối (ORDER_HAS_SESSION), không đổi gì, quay về chi tiết', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    await open(store, d);
    await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'DOI');
    const pkg = d.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(d, pkg.id, { sessionId: 's2' as SessionId, nowDevice: 2000 });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    await save();
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
    expect((await store.getOrder(LOCAL_SHOP_ID, d.order.id))?.order.trackingCode).toBe('TRK-1');
  });

  it('validate: mã vận đơn quá 64 ký tự báo lỗi ở ô, không lưu (trần khớp Rules, V1-04)', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    await open(store, d);
    expect(screen.getByTestId('quick-tracking').props.maxLength).toBe(65);
    await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'T'.repeat(65));
    await save();
    expect(
      await screen.findByText('Mã vận đơn dài quá 64 ký tự hoặc có ký tự lạ. Hãy kiểm tra lại.'),
    ).toBeOnTheScreen();
    expect(await store.getOrder(LOCAL_SHOP_ID, d.order.id)).toEqual(d);
  });

  it('validate: variant thiếu tên báo lỗi ở dòng, không lưu; xóa hết dòng vẫn lưu được (Chưa khai báo sản phẩm)', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    await open(store, d);
    await fireEvent.changeText(screen.getByTestId('line-name-1'), '');
    await fireEvent.changeText(screen.getByTestId('line-variant-1'), 'Xanh');
    await save();
    expect(await screen.findByText('Hãy nhập tên sản phẩm cho phân loại này.')).toBeOnTheScreen();
    expect(await store.getOrder(LOCAL_SHOP_ID, d.order.id)).toEqual(d);
    await fireEvent.changeText(screen.getByTestId('line-variant-1'), '');
    await fireEvent.changeText(screen.getByTestId('line-name-0'), '');
    await fireEvent.changeText(screen.getByTestId('line-variant-0'), '');
    await save();
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
    expect((await store.getOrder(LOCAL_SHOP_ID, d.order.id))?.lines).toEqual([]);
  });

  it('bấm Lưu liên tục chỉ ghi MỘT lần', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    const spy = jest.spyOn(store, 'updateOrder');
    await open(store, d);
    await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'LIEN-TUC');
    const button = screen.getByTestId('order-edit-save');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
      void fireEvent.press(button);
    });
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lỗi lưu: giữ form, câu "Chưa lưu được thay đổi…", Thử lại dùng ID dòng mới CŨ và không tạo hai dòng', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store);
    let fail = true;
    const seenNew: string[] = [];
    const flaky: OrderStore = {
      ...store,
      updateOrder: async (shop, id, edit) => {
        seenNew.push(...edit.lines.filter((l) => l.name === 'Nón').map((l) => l.id));
        if (fail) throw new AppError('ORDER_SAVE_FAILED');
        return store.updateOrder(shop, id, edit);
      },
    };
    await open(flaky, d);
    await fireEvent.press(screen.getByTestId('quick-add-line'));
    await fireEvent.changeText(screen.getByTestId('line-name-2'), 'Nón');
    await save();
    expect(await screen.findByText('Chưa lưu được thay đổi. Bạn thử lại nhé.')).toBeOnTheScreen();
    expect(mockNavigation.back).not.toHaveBeenCalled();
    expect(screen.getByTestId('line-name-2')).toHaveDisplayValue('Nón');
    expect(await store.getOrder(LOCAL_SHOP_ID, d.order.id)).toEqual(d);
    fail = false;
    await waitFor(() => expect(screen.getByTestId('order-edit-save')).toBeEnabled());
    await save();
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
    expect(seenNew).toHaveLength(2);
    expect(seenNew[0]).toBe(seenNew[1]);
    expect(
      (await store.getOrder(LOCAL_SHOP_ID, d.order.id))?.lines.filter((l) => l.name === 'Nón'),
    ).toHaveLength(1);
  });

  describe('đổi nguồn/mã vận đơn gây trùng đơn khác', () => {
    it('đổi nguồn thành trùng cùng mã+nguồn: hiện đơn hiện có, KHÔNG lưu, không gộp; Vẫn lưu thì lưu', async () => {
      const store = createMemoryOrderStore();
      const mine = await seed(store, 'SAME-1', { source: 'shopee', tracking: '' });
      const theirs = await seed(store, 'SAME-1', { source: 'lazada', tracking: '' });
      await open(store, mine);
      await fireEvent.press(screen.getByTestId('source-change'));
      await fireEvent.press(screen.getByTestId('source-option-lazada'));
      await save();
      expect(await screen.findByText('Đơn này đã có')).toBeOnTheScreen();
      expect(screen.getByText(/Thay đổi này làm đơn trùng với đơn đã có/)).toBeOnTheScreen();
      expect(screen.getByTestId(`order-match-${theirs.order.id}`)).toBeOnTheScreen();
      expect((await store.getOrder(LOCAL_SHOP_ID, mine.order.id))?.order.source).toBe('shopee');
      expect(mockNavigation.back).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId('order-match-create-anyway'));
      await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
      expect((await store.getOrder(LOCAL_SHOP_ID, mine.order.id))?.order.source).toBe('lazada');
      expect(await store.getOrder(LOCAL_SHOP_ID, theirs.order.id)).toEqual(theirs); // đơn kia không đổi
    });

    it('đổi mã vận đơn thành mã của đơn khác: cảnh báo, không tự gộp', async () => {
      const store = createMemoryOrderStore();
      const mine = await seed(store, 'A-1', { tracking: 'T-A' });
      const theirs = await seed(store, 'B-1', { tracking: 'T-B' });
      await open(store, mine);
      await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'T-B');
      await save();
      expect(await screen.findByText('Trùng mã vận đơn')).toBeOnTheScreen();
      expect(screen.getByTestId(`order-match-${theirs.order.id}`)).toBeOnTheScreen();
      expect((await store.getOrder(LOCAL_SHOP_ID, mine.order.id))?.order.trackingCode).toBe('T-A');
    });

    it('sửa dòng sản phẩm (không đổi nguồn/mã vận đơn) KHÔNG kiểm trùng', async () => {
      const store = createMemoryOrderStore();
      const mine = await seed(store, 'A-1', { tracking: 'T-A' });
      await seed(store, 'A-2', { tracking: 'T-A' }); // đã trùng mã vận đơn từ trước
      const spy = jest.spyOn(store, 'findOrdersByCodes');
      await open(store, mine);
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo mới');
      await save();
      await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('thoát form dở', () => {
    it('chưa đổi gì: Hủy thoát ngay', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store);
      await open(store, d);
      expect(mockNavigation.leaveGuardEnabled).toBe(false);
      await fireEvent.press(screen.getByTestId('order-edit-cancel'));
      expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    });

    it('có thay đổi: hỏi Bỏ thay đổi?; Tiếp tục sửa ở lại; Bỏ thay đổi mới thoát và KHÔNG lưu', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store);
      await open(store, d);
      await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'DO-DANG');
      expect(mockNavigation.leaveGuardEnabled).toBe(true);
      await fireEvent.press(screen.getByTestId('order-edit-cancel'));
      expect(screen.getByText('Bỏ thay đổi?')).toBeOnTheScreen();
      expect(mockNavigation.back).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục sửa' }));
      expect(screen.getByTestId('quick-tracking')).toHaveDisplayValue('DO-DANG');
      await fireEvent.press(screen.getByTestId('order-edit-cancel'));
      await fireEvent.press(screen.getByTestId('order-edit-leave-confirm'));
      await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
      expect((await store.getOrder(LOCAL_SHOP_ID, d.order.id))?.order.trackingCode).toBe('TRK-1');
    });

    it('cố rời bằng Back/cử chỉ khi có thay đổi: hiện hộp xác nhận', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store);
      await open(store, d);
      await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'X');
      await act(async () => mockNavigation.attemptLeave?.());
      expect(screen.getByText('Bỏ thay đổi?')).toBeOnTheScreen();
    });
  });

  it('ID lạ hoặc đơn của shop khác: không tìm thấy, không lộ dữ liệu', async () => {
    const store = createMemoryOrderStore();
    const other = await seed(store, 'SECRET', { shopId: 'shop-khac' as ShopId });
    mockNavigation.params = { orderId: other.order.id };
    await renderWithProviders(<EditOrderScreen />, { orderStore: store });
    expect(await screen.findByTestId('order-edit-not-found')).toBeOnTheScreen();
    expect(screen.queryByText('SECRET')).toBeNull();
  });

  it('đổi shop khi đang sửa: form đóng, không giữ dữ liệu shop cũ; lưu dùng shop LÚC BẤM', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store, 'SHOP-A', { shopId: 'shop-a' as ShopId });
    mockNavigation.params = { orderId: d.order.id };
    function Harness() {
      const [shop, setShop] = useState('shop-a');
      return (
        <>
          <Pressable testID="switch" onPress={() => setShop('shop-b')} />
          <CurrentShopProvider shopId={shop}>
            <EditOrderScreen />
          </CurrentShopProvider>
        </>
      );
    }
    await renderWithProviders(<Harness />, { orderStore: store });
    await screen.findByTestId('order-edit-code');
    await fireEvent.changeText(screen.getByTestId('quick-tracking'), 'DANG-SUA');
    await act(async () => fireEvent.press(screen.getByTestId('switch')));
    await waitFor(() => expect(screen.queryByDisplayValue('DANG-SUA')).toBeNull());
    expect(await screen.findByTestId('order-edit-not-found')).toBeOnTheScreen();
    expect((await store.getOrder('shop-a' as ShopId, d.order.id))?.order.trackingCode).toBe(
      'TRK-1',
    );
  });
});
