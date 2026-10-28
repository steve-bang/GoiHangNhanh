import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, StyleSheet } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import { ACCOUNT_MENU, type MenuAvailability } from './account-menu';
import { ProfileScreen } from './ProfileScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

let mockVersion: string | null = '9.8.7';
jest.mock('@/platform/app-info', () => ({ getAppVersion: () => mockVersion }));

let mockOffline = false;
jest.mock('@/platform/connectivity', () => ({ useIsOffline: () => mockOffline }));

beforeEach(() => {
  resetMockNavigation();
  mockOffline = false;
  mockVersion = '9.8.7';
});

async function renderProfile(gateways = createFakePersonalGateways()) {
  await renderWithProviders(<ProfileScreen />, { personalGateways: gateways });
  return gateways;
}

describe('ProfileScreen (UI-I01)', () => {
  it('hiện khung chờ rồi hồ sơ và shop thật; không còn ghi chú "minh họa"', async () => {
    await renderProfile(createFakePersonalGateways({ profile: { displayName: 'Lan Anh' } }));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/));
    expect(screen.getByTestId('profile-summary')).toHaveTextContent(/demo@example.com/);
    expect(screen.getByText('Cửa hàng minh họa')).toBeOnTheScreen(); // tên cửa hàng do cổng giả trả về
    expect(screen.queryByText(/Dữ liệu minh họa của khung giao diện/)).toBeNull();
    expect(screen.queryByTestId('profile-loading')).toBeNull();
  });

  it('chưa có họ tên: lời mời "Thêm họ tên" (không bịa tên từ email), bấm mở Sửa họ tên', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Thêm họ tên')).toBeOnTheScreen());
    expect(screen.queryByText('Chưa có họ tên')).toBeNull();
    // Chữ cái đầu không bịa từ email: avatar hiện biểu tượng người dùng, không có chữ "D" của "demo".
    expect(screen.queryByText('D')).toBeNull();
    await fireEvent.press(screen.getByTestId('profile-summary'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.editProfile);
  });

  it('chưa có cửa hàng: nói rõ, không bịa tên cửa hàng', async () => {
    await renderProfile(createFakePersonalGateways({ shop: null }));
    await waitFor(() => expect(screen.getByText('Chưa có cửa hàng')).toBeOnTheScreen());
  });

  it('gói dịch vụ: chỉ nhãn "Sắp có", khóa, không số/giá/hạn giả, không nói "chưa biết" hai lần', async () => {
    await renderProfile();
    const plan = screen.getByTestId('menu-UI-H01');
    expect(plan).toHaveTextContent(/Gói dịch vụ/);
    expect(plan).toHaveTextContent(/Sắp có/);
    expect(plan).not.toHaveTextContent(/\d|Không xác định|Chưa có thông tin/);
    expect(screen.queryByText('Không xác định được trạng thái')).toBeNull();
  });

  it('gói dịch vụ không bị bóp: thẻ nhóm không padding (không lề đôi), hàng chỉ có lề của hàng', async () => {
    await renderProfile();
    const group = screen.getByTestId('group-shop');
    // Con thứ hai của nhóm là Card flush: không padding, lề do từng hàng lo một lần.
    const card = group.children[1] as unknown as { props: { style: unknown } };
    const cardStyle = StyleSheet.flatten(card.props.style as never) as Record<string, unknown>;
    expect(cardStyle.padding).toBe(0);
    const row = StyleSheet.flatten(
      screen.getByTestId('menu-UI-H01').props.style as never,
    ) as Record<string, number>;
    expect(row.paddingHorizontal).toBe(16);
  });

  it('gom thành các nhóm có tiêu đề: Tài khoản, Cửa hàng và gói, Cài đặt, Hỗ trợ; Đăng xuất nhóm riêng', async () => {
    await renderProfile();
    for (const title of ['Tài khoản', 'Cửa hàng và gói', 'Cài đặt', 'Hỗ trợ']) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('group-sign-out')).toContainElement(screen.getByTestId('sign-out'));
    // Không còn hàng trùng "Cài đặt shop", mục "Thành viên và quyền" (O-03, O-07 chưa chốt), hàng "Sửa họ tên".
    expect(screen.queryByText('Cài đặt shop')).toBeNull();
    expect(screen.queryByText('Thành viên và quyền')).toBeNull();
    expect(screen.queryByText('Sửa họ tên')).toBeNull();
  });

  it('tiêu đề màn là "Cá nhân"', async () => {
    await renderProfile();
    expect(screen.getByText('Cá nhân')).toBeOnTheScreen();
    expect(screen.queryByText('Hồ sơ tài khoản')).toBeNull();
  });

  it('mục chưa làm: nhãn "Sắp có", khóa, không điều hướng, đọc đúng trợ năng', async () => {
    await renderProfile();
    for (const code of ['UI-I04', 'UI-I05', 'UI-I06', 'UI-H01']) {
      const row = screen.getByTestId(`menu-${code}`);
      expect(row).toHaveTextContent(/Sắp có/);
      expect(row.props.accessibilityState).toMatchObject({ disabled: true });
      expect(row.props.accessibilityLabel).toMatch(/\. Sắp có$/);
      await fireEvent.press(row);
    }
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('cấu hình menu là MỘT chỗ duy nhất: đổi availability thì hàng mở được', async () => {
    const item = ACCOUNT_MENU.find((entry) => entry.id === 'help');
    expect(item).toBeDefined();
    const mutable = item as { availability: MenuAvailability };
    const before = mutable.availability;
    mutable.availability = 'available';
    try {
      await renderProfile();
      const row = screen.getByTestId('menu-UI-I06');
      expect(row).not.toHaveTextContent(/Sắp có/);
      await fireEvent.press(row);
      expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.help);
    } finally {
      mutable.availability = before;
    }
  });

  it('lỗi hồ sơ không che khu vực shop; thử lại thì hồ sơ hiện ra', async () => {
    const gateways = createFakePersonalGateways();
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderProfile(gateways);
    // lỗi được dùng cho lời gọi đầu tiên (hồ sơ); shop vẫn tải được
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.getByText('Mất kết nối mạng.')).toBeOnTheScreen();
    expect(screen.getByText('Cửa hàng minh họa')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-summary')).toBeNull();

    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });

  it('cổng chưa kết nối: lỗi cục bộ ở từng khu vực, menu vẫn dùng được', async () => {
    await renderProfile(createUnavailablePersonalGateways() as never);
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.getByTestId('shop-error')).toBeOnTheScreen();
    // Menu vẫn hiện (mục chưa làm bị khóa nhưng không biến mất); khu vực lỗi không chặn gì.
    expect(screen.getByTestId('menu-UI-I06')).toBeOnTheScreen();
  });

  it('kéo làm mới lỗi: GIỮ dữ liệu đã tải và báo chưa làm mới được', async () => {
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan Anh' } });
    await renderProfile(gateways);
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());

    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await act(async () => {
      screen.getByTestId('screen-UI-I01-scroll').props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(screen.getByTestId('profile-refresh-failed')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/);
    expect(gateways.account.getProfileCalls).toBe(2);
  });

  it('ngoại tuyến: dữ liệu đã tải kèm nhãn "có thể chưa mới nhất"', async () => {
    mockOffline = true;
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-cached-notice')).toBeOnTheScreen();
  });

  it('thẻ hồ sơ mở Sửa họ tên; Đổi mật khẩu mở route con', async () => {
    await renderProfile(createFakePersonalGateways({ profile: { displayName: 'Lan Anh' } }));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('profile-summary'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.editProfile);
    await fireEvent.press(screen.getByTestId('change-password-entry'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.changePassword);
  });

  it('tài khoản Apple/Google: ẩn mục Đổi mật khẩu, vẫn có thẻ hồ sơ', async () => {
    await renderProfile(createFakePersonalGateways({ profile: { signInMethod: 'google' } }));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.queryByTestId('change-password-entry')).toBeNull();
  });

  it('thẻ cửa hàng mở Cài đặt cửa hàng (không còn hàng trùng)', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('shop-card'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.shopSettings);
  });

  it('dòng phiên bản lấy từ cấu hình; không đọc được thì bỏ dòng, không bịa số', async () => {
    await renderProfile();
    expect(screen.getByTestId('app-version')).toHaveTextContent('Đơn\u00a0Chứng · phiên bản 9.8.7');
  });

  it('không đọc được phiên bản: không hiện dòng phiên bản', async () => {
    mockVersion = null;
    await renderProfile();
    expect(screen.queryByTestId('app-version')).toBeNull();
  });

  it('cảnh báo dữ liệu đã lưu hiện thành thẻ cảnh báo có chữ, không chỉ chữ xám', async () => {
    mockOffline = true;
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('profile-cached-notice')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-cached-notice')).toHaveTextContent(/dữ liệu đã lưu/i);
  });

  it('Đăng xuất mở hộp thoại xác nhận; "Ở lại ứng dụng" đóng và không gọi cổng (luồng đầy đủ: SignOut.test.tsx)', async () => {
    const gateways = await renderProfile();
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(screen.getByText('Bạn muốn đăng xuất?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ở lại ứng dụng'));
    expect(screen.queryByText('Bạn muốn đăng xuất?')).toBeNull();
    expect(gateways.account.signOutCalls).toBe(0);
  });

  it('đổi phiên (tài khoản khác): bỏ dữ liệu cũ và tải lại, không rò sang phiên mới', async () => {
    function SwitchProbe() {
      const { beginSession } = useSession();
      return (
        <Pressable
          testID="switch-session"
          onPress={() =>
            beginSession({ uid: 'u2', email: 'b@example.com', displayName: null }, 's2')
          }
        />
      );
    }
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan Anh' } });
    await renderWithProviders(
      <>
        <SwitchProbe />
        <ProfileScreen />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/));
    expect(gateways.account.getProfileCalls).toBe(1);
    await fireEvent.press(screen.getByTestId('switch-session'));
    await waitFor(() => expect(gateways.account.getProfileCalls).toBe(2));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
  });
});
