import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { ShopEditScreen } from './ShopEditScreen';
import { beginProbeSession, SessionProbe, SHOP_A, SHOP_B } from './shop-test-kit';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

const saveButton = () => screen.getByTestId('edit-shop-save');
const isDisabled = () => Boolean(saveButton().props.accessibilityState?.disabled);

async function renderEdit(gateways = createFakePersonalGateways({ shops: [SHOP_A] })) {
  await renderWithProviders(
    <>
      <SessionProbe />
      <ShopEditScreen />
    </>,
    { personalGateways: gateways },
  );
  await beginProbeSession();
  await waitFor(() => expect(screen.getByTestId('edit-shop-name')).toBeOnTheScreen());
  return gateways;
}

describe('ShopEditScreen (UI-I02 route con, PER-06)', () => {
  it('hiện tên hiện tại, chỉ có ô tên (không logo/mô tả giả); Lưu khóa khi chưa sửa', async () => {
    await renderEdit();
    expect(screen.getByTestId('edit-shop-name').props.value).toBe('Shop A');
    expect(
      screen.getByText(/Đổi tên không làm thay đổi video và lịch sử đã lưu/),
    ).toBeOnTheScreen();
    expect(isDisabled()).toBe(true);
  });

  it('tên trống: báo đúng câu và khóa Lưu; quá 50 ký tự cũng khóa', async () => {
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), '   ');
    expect(screen.getByText('Tên cửa hàng không được để trống.')).toBeOnTheScreen();
    expect(isDisabled()).toBe(true);
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), 'a'.repeat(51));
    expect(screen.getByText(/rút gọn xuống 50 ký tự/)).toBeOnTheScreen();
    await fireEvent.press(saveButton());
    expect(gateways.account.updateShopNameCalls).toHaveLength(0);
  });

  it('lưu thành công: gọi cổng một lần với tên đã cắt khoảng trắng, báo phiên, toast SAU khi xác nhận, rồi quay lại', async () => {
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), '  Shop Mới  ');
    await fireEvent.press(saveButton());
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
    expect(gateways.account.updateShopNameCalls).toEqual([{ shopId: 'shop-a', name: 'Shop Mới' }]);
    expect(screen.getByTestId('probe-shop-revision')).toHaveTextContent('1');
    expect(mockNavigation.allowLeave).toHaveBeenCalled();
    expect(await screen.findByText('Đã cập nhật thông tin cửa hàng.')).toBeOnTheScreen();
  });

  it('chống gửi lặp: bấm liên tiếp chỉ gọi cổng một lần, chưa báo thành công khi cổng chưa xác nhận', async () => {
    const gateways = createFakePersonalGateways({ shops: [SHOP_A] });
    let release: () => void = () => undefined;
    const original = gateways.account.updateShopName.bind(gateways.account);
    gateways.account.updateShopName = (shopId, name) =>
      new Promise((resolve) => {
        release = () => resolve(original(shopId, name));
      });
    await renderEdit(gateways);
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), 'Shop Mới');
    await fireEvent.press(saveButton());
    await fireEvent.press(saveButton());
    expect(isDisabled()).toBe(true);
    expect(screen.queryByText('Đã cập nhật thông tin cửa hàng.')).toBeNull();
    expect(mockNavigation.back).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-shop-revision')).toHaveTextContent('0');
    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
  });

  it('SHOP_SAVE_FAILED: lỗi tại màn, giữ chữ đã gõ, không toast thành công, không báo phiên; thử lại được', async () => {
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), 'Shop Mới');
    gateways.account.failNext('SHOP_SAVE_FAILED');
    await fireEvent.press(saveButton());
    expect(await screen.findByTestId('edit-shop-save-error')).toHaveTextContent(
      'Không thể cập nhật cửa hàng lúc này. Bạn thử lại nhé.',
    );
    expect(screen.getByTestId('edit-shop-name').props.value).toBe('Shop Mới');
    expect(screen.queryByText('Đã cập nhật thông tin cửa hàng.')).toBeNull();
    expect(screen.getByTestId('probe-shop-revision')).toHaveTextContent('0');
    expect(mockNavigation.back).not.toHaveBeenCalled();
    expect(isDisabled()).toBe(false);

    await fireEvent.press(saveButton());
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
  });

  it('cổng từ chối vì thiếu quyền (quyền đổi sau khi mở màn): báo đúng câu, không báo thành công', async () => {
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), 'Shop Mới');
    gateways.account.failNext('SHOP_PERMISSION_DENIED');
    await fireEvent.press(saveButton());
    expect(await screen.findByTestId('edit-shop-save-error')).toHaveTextContent(
      'Bạn chưa có quyền thực hiện thao tác này. Hãy liên hệ chủ cửa hàng.',
    );
    expect(screen.queryByText('Đã cập nhật thông tin cửa hàng.')).toBeNull();
  });

  it('không có quyền sửa (canEdit=false): không có ô nhập, không có nút Lưu, nói rõ lý do', async () => {
    await renderWithProviders(<ShopEditScreen />, {
      personalGateways: createFakePersonalGateways({ shops: [SHOP_B] }),
    });
    expect(await screen.findByTestId('edit-shop-no-permission')).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-shop-name')).toBeNull();
    expect(screen.queryByTestId('edit-shop-save')).toBeNull();
  });

  it('hủy khi có thay đổi: hỏi xác nhận; "Tiếp tục sửa" giữ nguyên, "Bỏ thay đổi" thì rời', async () => {
    await renderEdit();
    expect(mockNavigation.leaveGuardEnabled).toBe(false);
    await fireEvent.changeText(screen.getByTestId('edit-shop-name'), 'Shop Mới');
    expect(mockNavigation.leaveGuardEnabled).toBe(true);
    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    expect(screen.getByText('Bỏ thay đổi?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Tiếp tục sửa'));
    expect(screen.queryByText('Bỏ thay đổi?')).toBeNull();
    expect(mockNavigation.back).not.toHaveBeenCalled();

    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    await fireEvent.press(screen.getByText('Bỏ thay đổi'));
    expect(mockNavigation.allowLeave).toHaveBeenCalled();
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });

  it('không tải được shop: lỗi cục bộ có Thử lại, không có ô nhập', async () => {
    const gateways = createFakePersonalGateways({ shops: [SHOP_A] });
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderWithProviders(<ShopEditScreen />, { personalGateways: gateways });
    expect(await screen.findByTestId('edit-shop-load-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-shop-name')).toBeNull();
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('edit-shop-name')).toBeOnTheScreen());
  });
});
