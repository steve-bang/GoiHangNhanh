import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { ShopSettingsScreen } from './ShopSettingsScreen';
import { beginProbeSession, SessionProbe, SHOP_A, SHOP_B } from './shop-test-kit';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

async function open(gateways = createFakePersonalGateways({ shops: [SHOP_A] })) {
  await renderWithProviders(
    <>
      <SessionProbe />
      <ShopSettingsScreen />
    </>,
    { personalGateways: gateways },
  );
  await beginProbeSession();
  await waitFor(() => expect(screen.getByTestId('shop-settings-card')).toBeOnTheScreen());
  return gateways;
}

describe('ShopSettingsScreen (UI-I02, PER-05)', () => {
  it('hiện khung chờ rồi thẻ shop: tên, ô icon cửa hàng, vai trò, trạng thái; không có mục Thành viên', async () => {
    await renderWithProviders(<ShopSettingsScreen />, {
      personalGateways: createFakePersonalGateways({ shops: [SHOP_A], latencyMs: 30 }),
    });
    expect(screen.getByTestId('shop-settings-loading')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId('shop-settings-name')).toHaveTextContent(/Shop A/),
    );
    expect(screen.getByTestId('shop-settings-role')).toHaveTextContent(/Chủ cửa hàng/);
    expect(screen.getByTestId('shop-settings-status')).toHaveTextContent(/Đang hoạt động/);
    expect(
      screen.getByTestId('shop-settings-avatar', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    // Board 07 khung 5 không có câu mô tả đầu trang.
    expect(screen.queryByTestId('shop-settings-intro')).toBeNull();
    expect(screen.queryByText(/Thành viên và quyền/)).toBeNull();
    expect(screen.queryByTestId('shop-settings-members')).toBeNull();
  });

  it('có quyền sửa: hàng "Sửa tên cửa hàng" mở màn sửa', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('shop-settings-edit'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.shopEdit);
  });

  it('không có quyền sửa: không có nút, nói rõ liên hệ chủ cửa hàng', async () => {
    await open(createFakePersonalGateways({ shops: [SHOP_B] }));
    expect(screen.queryByTestId('shop-settings-edit')).toBeNull();
    expect(screen.getByTestId('shop-settings-no-permission')).toHaveTextContent(
      /chưa có quyền sửa thông tin cửa hàng.*liên hệ chủ cửa hàng/,
    );
    expect(screen.getByTestId('shop-settings-role')).toHaveTextContent(/Thành viên/);
  });

  it('hàng thông tin: nhãn bên này, giá trị bên kia, đọc thành "nhãn. giá trị"', async () => {
    await open();
    expect(screen.getByTestId('shop-settings-role').props.accessibilityLabel).toBe(
      'Vai trò. Chủ cửa hàng',
    );
    expect(screen.getByTestId('shop-settings-status').props.accessibilityLabel).toBe(
      'Trạng thái. Đang hoạt động',
    );
  });

  it('thao tác là hàng có mũi tên: Sửa tên cửa hàng, Chuyển cửa hàng khi từ hai cửa hàng', async () => {
    await open(createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] }));
    await waitFor(() => expect(screen.getByTestId('shop-settings-switch')).toBeOnTheScreen());
    const actions = screen.getByTestId('shop-settings-actions');
    expect(actions).toContainElement(screen.getByTestId('shop-settings-edit'));
    expect(actions).toContainElement(screen.getByTestId('shop-settings-switch'));
    expect(screen.getByTestId('shop-settings-edit')).toHaveTextContent(/Sửa tên cửa hàng/);
    expect(screen.getByTestId('shop-settings-edit')).toHaveTextContent(/chevron-forward/);
  });

  it('KHÔNG có "Xóa cửa hàng" và không có dòng ID (mô hình chưa có mã cửa hàng) ở mọi vai trò', async () => {
    await open(createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] }));
    await waitFor(() => expect(screen.getByTestId('shop-settings-switch')).toBeOnTheScreen());
    expect(screen.queryByText(/Xóa cửa hàng/)).toBeNull();
    expect(screen.queryByText(/\bID\b/)).toBeNull();
    expect(screen.queryByText(/Quản lý$/)).toBeNull();
  });

  it('Vai trò và Trạng thái là hàng chỉ đọc: không phải nút, không có mũi tên', async () => {
    await open();
    for (const id of ['shop-settings-role', 'shop-settings-status']) {
      const row = screen.getByTestId(id);
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(row).not.toHaveTextContent(/chevron/);
    }
  });

  it('shop bị khóa: trạng thái đọc là "Bị khóa" (không bịa "Đang hoạt động")', async () => {
    await open(
      createFakePersonalGateways({ shops: [{ ...SHOP_A, status: 'suspended' as const }] }),
    );
    expect(screen.getByTestId('shop-settings-status').props.accessibilityLabel).toBe(
      'Trạng thái. Bị khóa',
    );
    expect(screen.queryByText('Đang hoạt động')).toBeNull();
  });

  it('không có hành động nào (không quyền sửa, một cửa hàng): không dựng nhóm hàng rỗng', async () => {
    await open(createFakePersonalGateways({ shops: [SHOP_B] }));
    expect(screen.queryByTestId('shop-settings-actions')).toBeNull();
  });

  it('chỉ một shop: ẩn Chuyển cửa hàng', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('shop-settings-edit')).toBeOnTheScreen());
    expect(screen.queryByTestId('shop-settings-switch')).toBeNull();
  });

  it('từ hai shop: hiện Chuyển cửa hàng và mở màn chuyển', async () => {
    await open(createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] }));
    await waitFor(() => expect(screen.getByTestId('shop-settings-switch')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('shop-settings-switch'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.shopSwitch);
  });

  it('chưa có shop: nói rõ, không bịa thẻ shop', async () => {
    await renderWithProviders(<ShopSettingsScreen />, {
      personalGateways: createFakePersonalGateways({ shop: null }),
    });
    await waitFor(() => expect(screen.getByTestId('shop-settings-empty')).toBeOnTheScreen());
    expect(screen.queryByTestId('shop-settings-card')).toBeNull();
    expect(screen.queryByTestId('shop-settings-edit')).toBeNull();
  });

  it('lỗi tải: báo tại khu vực và thử lại được', async () => {
    const gateways = createFakePersonalGateways({ shops: [SHOP_A] });
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderWithProviders(<ShopSettingsScreen />, { personalGateways: gateways });
    await waitFor(() => expect(screen.getByTestId('shop-settings-error')).toBeOnTheScreen());
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('shop-settings-name')).toBeOnTheScreen());
  });

  it('sau khi tên shop được cập nhật ở màn khác (shopRevision đổi): thẻ tải lại tên mới', async () => {
    const gateways = await open();
    await gateways.account.updateShopName('shop-a', 'Shop Mới');
    await fireEvent.press(screen.getByTestId('probe-shop-updated'));
    await waitFor(() =>
      expect(screen.getByTestId('shop-settings-name')).toHaveTextContent(/Shop Mới/),
    );
  });
});
