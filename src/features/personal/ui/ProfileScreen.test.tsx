import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AppError } from '@/core/errors/app-error';
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

const NAMED = { profile: { displayName: 'Lan Anh' } } as const;

describe('ProfileScreen (UI-I01) khung 1a: màn chính', () => {
  it('hiện hồ sơ và cửa hàng thật; không còn ghi chú "minh họa"', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/));
    expect(screen.getByTestId('profile-summary')).toHaveTextContent(/demo@example.com/);
    expect(screen.getByText('Cửa hàng minh họa')).toBeOnTheScreen(); // tên cửa hàng do cổng giả trả về
    expect(screen.queryByText(/Dữ liệu minh họa của khung giao diện/)).toBeNull();
    expect(screen.queryByTestId('profile-loading')).toBeNull();
  });

  it('thứ tự khối theo board: hồ sơ, cửa hàng, gói, dữ liệu bằng chứng, rồi các nhóm menu', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    const seen: string[] = [];
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const { props, children } = node as {
        props?: { testID?: string };
        children?: unknown;
      };
      if (props?.testID) seen.push(props.testID);
      walk(children);
    };
    walk(screen.toJSON());
    const order = [
      'profile-card',
      'shop-card',
      'evidence-overview',
      'group-settings',
      'group-support',
      'group-sign-out',
    ].map((id) => seen.indexOf(id));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('thẻ cửa hàng: ba dòng "Cửa hàng của bạn / tên / Quản lý cửa hàng", mở Cài đặt cửa hàng', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    const card = screen.getByTestId('shop-card');
    expect(card).toHaveTextContent(/Cửa hàng của bạn/);
    expect(card).toHaveTextContent(/Cửa hàng minh họa/);
    expect(card).toHaveTextContent(/Quản lý cửa hàng/);
    expect(card.props.accessibilityLabel).toBe(
      'Cửa hàng của bạn. Cửa hàng minh họa. Quản lý cửa hàng',
    );
    await fireEvent.press(card);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.shopSettings);
  });

  it('chưa có cửa hàng: nói rõ, không bịa tên cửa hàng', async () => {
    await renderProfile(createFakePersonalGateways({ ...NAMED, shop: null }));
    await waitFor(() => expect(screen.getByText('Chưa có cửa hàng')).toBeOnTheScreen());
  });

  it('không bịa huy hiệu "Đã xác thực" (hồ sơ chưa có dữ liệu xác thực email)', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.queryByText(/Đã xác thực/)).toBeNull();
    expect(screen.queryByText(/Đang hoạt động/)).toBeNull();
  });

  it('gói dịch vụ đang ẩn (Q-21ag): màn Cá nhân không có thẻ gói, khung chờ gói, mục menu "Gói dịch vụ" hay chữ "Gói dịch vụ"', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.queryByTestId('plan-card')).toBeNull();
    expect(screen.queryByTestId('plan-loading')).toBeNull();
    expect(screen.queryByTestId('menu-UI-H01')).toBeNull();
    expect(screen.queryByTestId('group-shop')).toBeNull();
    expect(screen.queryByText(/Gói dịch vụ/)).toBeNull();
    expect(screen.queryByText(/Nâng cấp/)).toBeNull();
    // Các khối còn lại (PR-B..I) vẫn đủ.
    for (const id of [
      'shop-card',
      'evidence-overview',
      'group-settings',
      'group-support',
      'group-sign-out',
      'sign-out',
    ]) {
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    }
  });

  it('bật lại gói bằng một dòng ở account-menu (availability available): thẻ gói hiện, "Chưa có thông tin", "Sắp có", mở UI-H01', async () => {
    const item = ACCOUNT_MENU.find((entry) => entry.id === 'plan');
    const mutable = item as { availability: MenuAvailability };
    const before = mutable.availability;
    mutable.availability = 'available';
    try {
      await renderProfile(createFakePersonalGateways(NAMED));
      const plan = screen.getByTestId('plan-card');
      expect(plan).toHaveTextContent(/Gói dịch vụ/);
      expect(plan).toHaveTextContent(/Chưa có thông tin/);
      expect(plan).toHaveTextContent(/Thời hạn lưu: Chưa có thông tin/);
      expect(plan).toHaveTextContent(/Sắp có/);
      expect(plan).not.toHaveTextContent(/\d|Gói tiêu chuẩn|Đang hoạt động/);
      expect(plan.props.accessibilityLabel).toMatch(/\. Sắp có$/);
      await fireEvent.press(plan);
      expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.plan);
    } finally {
      mutable.availability = before;
    }
  });

  it('bật lại gói ở trạng thái coming_soon: thẻ gói khóa, không điều hướng', async () => {
    const item = ACCOUNT_MENU.find((entry) => entry.id === 'plan');
    const mutable = item as { availability: MenuAvailability };
    const before = mutable.availability;
    mutable.availability = 'coming_soon';
    try {
      await renderProfile();
      const plan = screen.getByTestId('plan-card');
      expect(plan).toHaveTextContent(/Sắp có/);
      expect(plan.props.accessibilityRole).not.toBe('button');
      await fireEvent.press(plan);
      expect(mockNavigation.push).not.toHaveBeenCalled();
    } finally {
      mutable.availability = before;
    }
  });

  it('dữ liệu bằng chứng: ba ô nhãn + "Chưa có số liệu" (không số giả), nút mở Trung tâm đồng bộ', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    const block = screen.getByTestId('evidence-overview');
    expect(block).toHaveTextContent(/Dữ liệu bằng chứng/);
    expect(screen.getByTestId('metric-on-device').props.accessibilityLabel).toBe(
      'Trên thiết bị: Chưa có số liệu',
    );
    expect(screen.getByTestId('metric-pending-sync').props.accessibilityLabel).toBe(
      'Đang chờ đồng bộ: Chưa có số liệu',
    );
    expect(screen.getByTestId('metric-cloud').props.accessibilityLabel).toBe(
      'Trên đám mây: Chưa có số liệu',
    );
    for (const id of ['metric-on-device', 'metric-pending-sync', 'metric-cloud']) {
      expect(screen.getByTestId(id)).toHaveTextContent(/Chưa có số liệu/);
    }
    expect(block).not.toHaveTextContent(/\d/);
    await fireEvent.press(screen.getByRole('button', { name: 'Xem trung tâm đồng bộ' }));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
  });

  it('tiêu đề khối bằng chứng là nút có "›" mở Dữ liệu bằng chứng (khung 11)', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    const title = screen.getByTestId('evidence-overview-title');
    expect(title.props.accessibilityRole).toBe('button');
    expect(title.props.accessibilityLabel).toBe('Dữ liệu bằng chứng');
    expect(title.props.accessibilityHint).toBe('Xem chi tiết dữ liệu bằng chứng');
    // Đề mục vẫn là header cho VoiceOver/TalkBack, tách khỏi nút mở.
    expect(screen.getByRole('header', { name: 'Dữ liệu bằng chứng' })).toBeOnTheScreen();
    const hit = StyleSheet.flatten(title.props.style as never) as Record<string, number>;
    expect(hit.minWidth).toBeGreaterThanOrEqual(44);
    expect(hit.minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(title);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.evidenceData);
  });

  it('các thẻ không có chiều cao cố định (chữ lớn không bị cắt)', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    for (const id of ['shop-card', 'profile-summary']) {
      const style = StyleSheet.flatten(screen.getByTestId(id).props.style as never) as Record<
        string,
        unknown
      >;
      expect(style.height).toBeUndefined();
    }
  });

  it('nhóm menu: Cài đặt, Hỗ trợ có tiêu đề; Đăng xuất nhóm riêng; không còn nhóm "Cửa hàng và gói"', async () => {
    await renderProfile(createFakePersonalGateways(NAMED));
    for (const title of ['Tài khoản', 'Cài đặt', 'Hỗ trợ']) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    expect(screen.queryByRole('header', { name: 'Cửa hàng và gói' })).toBeNull();
    expect(screen.queryByTestId('group-shop')).toBeNull();
    expect(screen.getByTestId('group-sign-out')).toContainElement(screen.getByTestId('sign-out'));
    // Không còn hàng trùng "Cài đặt shop", mục "Thành viên và quyền" (O-03, O-07 chưa chốt), hàng "Sửa họ tên".
    expect(screen.queryByText('Cài đặt shop')).toBeNull();
    expect(screen.queryByText('Thành viên và quyền')).toBeNull();
    expect(screen.queryByText('Sửa họ tên')).toBeNull();
  });

  it('tiêu đề màn là "Cá nhân", không có nút quay lại (màn gốc của tab)', async () => {
    await renderProfile();
    expect(screen.getByText('Cá nhân')).toBeOnTheScreen();
    expect(screen.queryByText('Hồ sơ tài khoản')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull();
  });

  it('Thông báo, Quyền riêng tư và bảo mật (PR-G) và Trợ giúp (PR-H) đã mở được, không còn nhãn "Sắp có"', async () => {
    await renderProfile();
    for (const [code, route] of [
      ['UI-I04', ROUTES.notifications],
      ['UI-I05', ROUTES.security],
      ['UI-I06', ROUTES.help],
    ] as const) {
      const row = screen.getByTestId(`menu-${code}`);
      expect(row).not.toHaveTextContent(/Sắp có/);
      await fireEvent.press(row);
      expect(mockNavigation.push).toHaveBeenLastCalledWith(route);
    }
    expect(screen.getByTestId('menu-UI-I05')).toBeOnTheScreen();
    expect(screen.getByTestId('menu-UI-I05')).toHaveTextContent(/Quyền riêng tư và bảo mật/);
  });

  it('cấu hình menu là MỘT chỗ duy nhất: đặt coming_soon thì hàng khóa "Sắp có", không điều hướng, đọc đúng trợ năng', async () => {
    const item = ACCOUNT_MENU.find((entry) => entry.id === 'help');
    expect(item).toBeDefined();
    const mutable = item as { availability: MenuAvailability };
    const before = mutable.availability;
    mutable.availability = 'coming_soon';
    try {
      await renderProfile();
      const row = screen.getByTestId('menu-UI-I06');
      expect(row).toHaveTextContent(/Sắp có/);
      expect(row.props.accessibilityState).toMatchObject({ disabled: true });
      expect(row.props.accessibilityLabel).toMatch(/\. Sắp có$/);
      await fireEvent.press(row);
      expect(mockNavigation.push).not.toHaveBeenCalled();
    } finally {
      mutable.availability = before;
    }
  });

  it('cổng chưa kết nối: lỗi cục bộ ở từng khu vực, menu vẫn dùng được', async () => {
    await renderProfile(createUnavailablePersonalGateways() as never);
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.getByTestId('shop-error')).toBeOnTheScreen();
    // Menu, khối bằng chứng và Đăng xuất vẫn hiện; khu vực lỗi không chặn gì.
    expect(screen.getByTestId('menu-UI-I06')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-card')).toBeNull();
    expect(screen.getByTestId('sign-out')).toBeOnTheScreen();
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
    await renderProfile(createFakePersonalGateways(NAMED));
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
    await renderProfile(
      createFakePersonalGateways({ profile: { signInMethod: 'google', displayName: 'Lan Anh' } }),
    );
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
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('profile-cached-notice')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-cached-notice')).toHaveTextContent(/dữ liệu đã lưu/i);
  });

  it('Đăng xuất mở hộp thoại xác nhận; "Ở lại ứng dụng" đóng và không gọi cổng (luồng đầy đủ: SignOut.test.tsx)', async () => {
    const gateways = await renderProfile();
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(screen.getByText('Xác nhận đăng xuất')).toBeOnTheScreen();
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

describe('ProfileScreen: tải lại theo revision', () => {
  function RevisionProbe() {
    const { updateDisplayName, notifyShopUpdated } = useSession();
    return (
      <>
        <Pressable testID="bump-profile" onPress={() => updateDisplayName('Lan Anh 2')} />
        <Pressable testID="bump-shop" onPress={() => notifyShopUpdated()} />
      </>
    );
  }
  async function renderWithProbe() {
    const gateways = createFakePersonalGateways(NAMED);
    await renderWithProviders(
      <>
        <RevisionProbe />
        <ProfileScreen />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    return gateways;
  }

  it('profileRevision tăng: tải lại hồ sơ MỘT lần (không tải lại shop), dữ liệu cũ vẫn hiện, không nháy khung chờ', async () => {
    const gateways = await renderWithProbe();
    expect(gateways.account.getProfileCalls).toBe(1);
    expect(gateways.account.getShopSummaryCalls).toBe(1);
    let resolve: (() => void) | undefined;
    const real = gateways.account.getProfile.bind(gateways.account);
    jest.spyOn(gateways.account, 'getProfile').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = () => done(real());
        }),
    );
    await fireEvent.press(screen.getByTestId('bump-profile'));
    await waitFor(() => expect(resolve).toBeDefined());
    // Trong lúc tải: dữ liệu cũ còn đó, không có khung chờ.
    expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/);
    expect(screen.queryByTestId('profile-loading')).toBeNull();
    expect(screen.queryByLabelText('Đang tải')).toBeNull();
    await act(async () => {
      resolve?.();
    });
    expect(gateways.account.getShopSummaryCalls).toBe(1);
    expect(screen.queryByTestId('profile-loading')).toBeNull();
    expect(screen.getByTestId('profile-summary')).toBeOnTheScreen();
  });

  it('shopRevision tăng: tải lại shop MỘT lần (không tải lại hồ sơ), thẻ shop không nháy khung chờ', async () => {
    const gateways = await renderWithProbe();
    let resolve: (() => void) | undefined;
    const real = gateways.account.getShopSummary.bind(gateways.account);
    const spy = jest.spyOn(gateways.account, 'getShopSummary').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = () => done(real());
        }),
    );
    await fireEvent.press(screen.getByTestId('bump-shop'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('shop-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('shop-loading')).toBeNull();
    await act(async () => {
      resolve?.();
    });
    expect(gateways.account.getProfileCalls).toBe(1);
    expect(screen.getByTestId('shop-card')).toBeOnTheScreen();
  });
});

function pending<T>() {
  return new Promise<T>(() => undefined);
}

describe('ProfileScreen khung 1b: đang tải', () => {
  it('cả hai khu vực chưa xong: khung chờ cho mọi khối, không hiện số/chữ giả; Đăng xuất vẫn có', async () => {
    const gateways = createFakePersonalGateways();
    jest.spyOn(gateways.account, 'getProfile').mockReturnValue(pending());
    jest.spyOn(gateways.account, 'getShopSummary').mockReturnValue(pending());
    await renderProfile(gateways);
    for (const id of ['profile-loading', 'shop-loading', 'evidence-loading', 'menu-loading']) {
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId('plan-loading')).toBeNull();
    expect(screen.queryByTestId('evidence-overview')).toBeNull();
    expect(screen.queryByText('Chưa có thông tin')).toBeNull();
    expect(screen.getByTestId('sign-out')).toBeOnTheScreen();
  });

  it('trình đọc màn hình: mỗi thẻ khung chờ là MỘT phần tử "Đang tải" (4 thẻ), không phần tử con lẻ', async () => {
    const gateways = createFakePersonalGateways();
    jest.spyOn(gateways.account, 'getProfile').mockReturnValue(pending());
    jest.spyOn(gateways.account, 'getShopSummary').mockReturnValue(pending());
    await renderProfile(gateways);
    expect(screen.getAllByLabelText('Đang tải')).toHaveLength(4);
  });

  it('hồ sơ chậm nhưng cửa hàng đã xong: chỉ thẻ hồ sơ là khung chờ, thẻ cửa hàng và các khối khác hiện', async () => {
    const gateways = createFakePersonalGateways();
    jest.spyOn(gateways.account, 'getProfile').mockReturnValue(pending());
    await renderProfile(gateways);
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-card')).toBeNull();
    expect(screen.getByTestId('evidence-overview')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-loading')).toBeNull();
  });
});

describe('ProfileScreen khung 1c: lỗi', () => {
  it('lỗi hồ sơ: thẻ lỗi (nền lỗi, nút chính "Thử lại") trên khung chờ mờ ẩn khỏi trình đọc; shop không bị che', async () => {
    const gateways = createFakePersonalGateways();
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderProfile(gateways);
    // lỗi được dùng cho lời gọi đầu tiên (hồ sơ); shop vẫn tải được
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.getByText('Mất kết nối mạng.')).toBeOnTheScreen();
    expect(screen.getByText('Cửa hàng minh họa')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-summary')).toBeNull();
    expect(screen.queryByTestId('profile-loading')).toBeNull();
    const style = StyleSheet.flatten(screen.getByTestId('profile-error').props.style as never);
    expect(style).toMatchObject({ backgroundColor: expect.any(String) });
    // Khung chờ phía trên thẻ lỗi bị ẩn khỏi trình đọc màn hình (không nghe "đang tải" khi đã lỗi).
    expect(screen.queryByLabelText('Đang tải')).toBeNull();

    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('profile-no-name')).toBeOnTheScreen());
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });

  it('lỗi cửa hàng không che hồ sơ đã tải; thử lại thì thẻ cửa hàng hiện', async () => {
    const gateways = createFakePersonalGateways(NAMED);
    jest
      .spyOn(gateways.account, 'getShopSummary')
      .mockRejectedValueOnce(new AppError('AUTH_NETWORK_ERROR'));
    await renderProfile(gateways);
    await waitFor(() => expect(screen.getByTestId('shop-error')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/);
    expect(screen.queryByTestId('plan-card')).toBeNull();
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('shop-card')).toBeOnTheScreen());
    expect(screen.queryByTestId('shop-error')).toBeNull();
  });
});

describe('ProfileScreen khung 1d: ngoại tuyến', () => {
  it('ngoại tuyến nhưng lỗi KHÔNG phải lỗi mạng: đi khung 1c (thẻ lỗi), không phải "Đang ngoại tuyến"', async () => {
    mockOffline = true;
    const gateways = createFakePersonalGateways(NAMED);
    gateways.account.failNext('AUTH_SERVICE_UNAVAILABLE');
    await renderProfile(gateways);
    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeOnTheScreen());
    expect(screen.queryByTestId('profile-offline')).toBeNull();
  });

  it('chưa có dữ liệu hồ sơ: trạng thái "Đang ngoại tuyến" có nút Thử lại; tải lại khi bấm', async () => {
    mockOffline = true;
    const gateways = createFakePersonalGateways(NAMED);
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderProfile(gateways);
    await waitFor(() => expect(screen.getByTestId('profile-offline')).toBeOnTheScreen());
    expect(screen.getByText('Đang ngoại tuyến')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-error')).toBeNull();
    // Các khối còn lại vẫn có (cửa hàng đã tải, Đăng xuất): không phải màn trống toàn màn.
    expect(screen.getByText('Cửa hàng minh họa')).toBeOnTheScreen();
    expect(screen.getByTestId('sign-out')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.queryByTestId('profile-offline')).toBeNull();
  });

  it('đã có dữ liệu: GIỮ dữ liệu, chỉ thêm thẻ cảnh báo "có thể chưa mới nhất" (không xóa vì ngoại tuyến)', async () => {
    mockOffline = true;
    await renderProfile(createFakePersonalGateways(NAMED));
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toBeOnTheScreen());
    expect(screen.getByTestId('profile-cached-notice')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-offline')).toBeNull();
    expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/);
  });
});

describe('ProfileScreen khung 1e: chưa có họ tên', () => {
  it('thay thẻ hồ sơ bằng trạng thái trống + "Cập nhật" (mở Sửa họ tên); phần còn lại vẫn dùng được', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByTestId('profile-no-name')).toBeOnTheScreen());
    expect(screen.getByText('Chưa có họ tên')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-summary')).toBeNull();
    // Không bịa tên/chữ cái đầu từ email.
    expect(screen.queryByText('D')).toBeNull();
    expect(screen.queryByText('demo')).toBeNull();
    expect(screen.getByTestId('shop-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-card')).toBeNull();
    expect(screen.getByTestId('evidence-overview')).toBeOnTheScreen();
    expect(screen.getByTestId('sign-out')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cập nhật' }));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.editProfile);
  });
});
