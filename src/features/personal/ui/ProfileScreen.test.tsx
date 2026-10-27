import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import { ProfileScreen } from './ProfileScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

let mockOffline = false;
jest.mock('@/platform/connectivity', () => ({ useIsOffline: () => mockOffline }));

beforeEach(() => {
  resetMockNavigation();
  mockOffline = false;
});

async function renderProfile(gateways = createFakePersonalGateways()) {
  await renderWithProviders(<ProfileScreen />, { personalGateways: gateways });
  return gateways;
}

describe('ProfileScreen (UI-I01)', () => {
  it('hiện khung chờ rồi hồ sơ và shop thật; không còn ghi chú "minh họa"', async () => {
    await renderProfile(createFakePersonalGateways({ profile: { displayName: 'Lan Anh' } }));
    await waitFor(() => expect(screen.getByTestId('profile-name')).toHaveTextContent('Lan Anh'));
    expect(screen.getByTestId('profile-email')).toHaveTextContent('demo@example.com');
    expect(screen.getByText('Shop minh họa')).toBeOnTheScreen(); // tên shop do cổng giả trả về
    expect(screen.queryByText(/Dữ liệu minh họa của khung giao diện/)).toBeNull();
    expect(screen.queryByTestId('profile-loading')).toBeNull();
  });

  it('chưa có họ tên: hiện "Chưa có họ tên", không bịa tên từ email', async () => {
    await renderProfile();
    await waitFor(() =>
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Chưa có họ tên'),
    );
  });

  it('chưa có shop: nói rõ, không bịa tên shop', async () => {
    await renderProfile(createFakePersonalGateways({ shop: null }));
    await waitFor(() => expect(screen.getByText('Chưa có shop')).toBeOnTheScreen());
  });

  it('gói dịch vụ: chỉ trạng thái trung thực, không số/giá/hạn giả', async () => {
    await renderProfile();
    const plan = screen.getByTestId('plan-card');
    expect(plan).toHaveTextContent(/Chưa có thông tin gói/);
    expect(plan).toHaveTextContent(/Không xác định được trạng thái/);
    expect(plan).not.toHaveTextContent(/\d/);
  });

  it('lỗi hồ sơ không che khu vực shop; thử lại thì hồ sơ hiện ra', async () => {
    const gateways = createFakePersonalGateways();
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderProfile(gateways);
    // lỗi được dùng cho lời gọi đầu tiên (hồ sơ); shop vẫn tải được
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.getByText('Mất kết nối mạng.')).toBeOnTheScreen();
    expect(screen.getByText('Shop minh họa')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-name')).toBeNull();

    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('profile-name')).toBeOnTheScreen());
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });

  it('cổng chưa kết nối: lỗi cục bộ ở từng khu vực, menu vẫn dùng được', async () => {
    await renderProfile(createUnavailablePersonalGateways() as never);
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.getByTestId('shop-error')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('menu-UI-I06'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.help);
  });

  it('kéo làm mới lỗi: GIỮ dữ liệu đã tải và báo chưa làm mới được', async () => {
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan Anh' } });
    await renderProfile(gateways);
    await waitFor(() => expect(screen.getByTestId('profile-name')).toBeOnTheScreen());

    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await act(async () => {
      screen.getByTestId('screen-UI-I01-scroll').props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(screen.getByTestId('profile-refresh-failed')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Lan Anh');
    expect(gateways.account.getProfileCalls).toBe(2);
  });

  it('ngoại tuyến: dữ liệu đã tải kèm nhãn "có thể chưa mới nhất"', async () => {
    mockOffline = true;
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('profile-name')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-cached-notice')).toBeOnTheScreen();
  });

  it('lối vào Sửa họ tên và Đổi mật khẩu mở đúng route con', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('edit-profile-entry')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('edit-profile-entry'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.editProfile);
    await fireEvent.press(screen.getByTestId('change-password-entry'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.changePassword);
  });

  it('tài khoản Apple/Google: ẩn mục Đổi mật khẩu, vẫn có Sửa họ tên', async () => {
    await renderProfile(createFakePersonalGateways({ profile: { signInMethod: 'google' } }));
    await waitFor(() => expect(screen.getByTestId('edit-profile-entry')).toBeOnTheScreen());
    expect(screen.queryByTestId('change-password-entry')).toBeNull();
  });

  it('mục menu mở đúng route', async () => {
    await renderProfile();
    await fireEvent.press(screen.getByTestId('menu-UI-I05'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.security);
    await fireEvent.press(screen.getByTestId('plan-card-item'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.plan);
  });

  it('Đăng xuất chỉ mở hộp thoại; xác nhận KHÔNG gọi cổng và nói rõ chưa dùng được (PR3)', async () => {
    const gateways = await renderProfile();
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(screen.getByText('Đăng xuất khỏi tài khoản?')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Ở lại'));
    expect(screen.queryByText('Đăng xuất khỏi tài khoản?')).toBeNull();

    await fireEvent.press(screen.getByTestId('sign-out'));
    const confirm = screen.getAllByText('Đăng xuất').at(-1);
    if (!confirm) throw new Error('Không thấy nút xác nhận');
    await fireEvent.press(confirm);
    expect(gateways.account.signOutCalls).toBe(0);
    expect(screen.getByText(/Đăng xuất chưa dùng được ở bản này/)).toBeOnTheScreen();
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
    await waitFor(() => expect(screen.getByTestId('profile-name')).toHaveTextContent('Lan Anh'));
    expect(gateways.account.getProfileCalls).toBe(1);
    await fireEvent.press(screen.getByTestId('switch-session'));
    await waitFor(() => expect(gateways.account.getProfileCalls).toBe(2));
    await waitFor(() => expect(screen.getByTestId('profile-name')).toBeOnTheScreen());
  });
});
