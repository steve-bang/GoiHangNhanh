import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFakeApi } from '@/api/testing';
import { AppError } from '@/core/errors/app-error';
import { renderWithProviders } from '@/test-utils/render';

import { SessionHydrator } from '../ui/SessionHydrator';
import { useSession } from '../ui/SessionProvider';
import { createFirebasePersonalGateways } from './firebase-personal-gateways';

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error.code : 'NOT_APP_ERROR';
  }
}

/** API giả với danh tính phiên cố định (cổng phiên giả không biết shop đã tạo trong cổng shop giả). */
function withIdentity(
  api: ReturnType<typeof createFakeApi>,
  shopId: string | null,
  signInMethod: 'password' | 'apple' | 'google' | null = 'password',
) {
  return {
    ...api,
    session: {
      ...api.session,
      restore: api.session.restore.bind(api.session),
      identity: async () => ({
        uid: 'u1',
        email: 'a@x.vn',
        displayName: null,
        signInMethod,
        shopId,
      }),
    },
  };
}

function Probe() {
  const { state, key, signOut } = useSession();
  return (
    <>
      <Text testID="status">{state.status}</Text>
      <Text testID="key">{key}</Text>
      <Text testID="shop">{String(state.shopId)}</Text>
      <Text testID="out" onPress={() => void signOut().catch(() => undefined)} />
    </>
  );
}

describe('cổng cá nhân chế độ Firebase (PR1)', () => {
  it('nối danh tính, hồ sơ, shop và đăng xuất; cài đặt thông báo GIỮ "chưa kết nối" (mục menu ẩn ở v1)', async () => {
    const api = createFakeApi({ sessionState: 'signed_in' });
    const created = await api.shop.createShop({ name: 'Shop A', sellingSources: [] });
    const { account, settings } = createFirebasePersonalGateways(withIdentity(api, created.id));
    expect(await account.getSessionIdentity()).toEqual({
      uid: 'u1',
      email: 'a@x.vn',
      displayName: null,
      signInMethod: 'password',
      shopId: created.id,
    });
    expect(await account.getProfile()).toMatchObject({ uid: 'u1', signInMethod: 'password' });
    expect(await account.getShopSummary()).toMatchObject({
      id: created.id,
      name: 'Shop A',
      role: 'owner',
    });
    for (const call of [
      () => settings.getNotificationPreferences(),
      () =>
        settings.updateNotificationPreferences({
          uploadProblems: true,
          syncCompleted: false,
          storageNearlyFull: true,
          planExpiring: true,
        }),
    ]) {
      expect(await codeOf(call())).toBe('AUTH_SERVICE_UNAVAILABLE');
    }
  });

  it('chưa đăng nhập: danh tính null, hồ sơ báo chưa kết nối (không bịa)', async () => {
    const { account } = createFirebasePersonalGateways(
      createFakeApi({ sessionState: 'signed_out' }),
    );
    expect(await account.getSessionIdentity()).toBeNull();
    expect(await codeOf(account.getProfile())).toBe('AUTH_SERVICE_UNAVAILABLE');
  });

  it('hồ sơ lấy phương thức đăng nhập từ danh tính; không xác định được thì báo chưa kết nối (không bịa)', async () => {
    const withMethod = (signInMethod: 'password' | 'apple' | 'google' | null) =>
      createFirebasePersonalGateways({
        ...createFakeApi(),
        session: {
          ...createFakeApi().session,
          identity: async () => ({
            uid: 'u1',
            email: 'a@x.vn',
            displayName: 'Chị Lan',
            signInMethod,
            shopId: null,
          }),
        },
      });
    expect(await withMethod('google').account.getProfile()).toMatchObject({
      signInMethod: 'google',
      displayName: 'Chị Lan',
    });
    expect(await codeOf(withMethod(null).account.getProfile())).toBe('AUTH_SERVICE_UNAVAILABLE');
  });

  it('chưa có shop: getShopSummary là null; shop không đọc được cũng là null', async () => {
    const noShop = createFirebasePersonalGateways(
      createFakeApi({ sessionState: 'signed_in_no_shop' }),
    );
    expect(await noShop.account.getShopSummary()).toBeNull();
    // 'fake-session-shop' không có trong kho shop của bản giả: coi như không đọc được.
    const unknown = createFirebasePersonalGateways(createFakeApi({ sessionState: 'signed_in' }));
    expect(await unknown.account.getShopSummary()).toBeNull();
  });

  it('signOut gọi auth.signOut của API', async () => {
    const api = createFakeApi();
    const { account } = createFirebasePersonalGateways(api);
    await account.signOut();
    expect(api.auth.signOutCalls).toBe(1);
  });
});

describe('SessionHydrator với cổng Firebase', () => {
  it('nạp uid và shopId thật từ danh tính', async () => {
    const gateways = createFirebasePersonalGateways(createFakeApi({ sessionState: 'signed_in' }));
    await renderWithProviders(
      <>
        <SessionHydrator />
        <Probe />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed_in'));
    expect(screen.getByTestId('key')).toHaveTextContent('fake-session-user:fake-session-shop');
  });

  it('đã đăng nhập nhưng chưa có shop: shopId null (không LOCAL_SHOP_ID)', async () => {
    const gateways = createFirebasePersonalGateways(
      createFakeApi({ sessionState: 'signed_in_no_shop' }),
    );
    await renderWithProviders(
      <>
        <SessionHydrator />
        <Probe />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed_in'));
    expect(screen.getByTestId('shop')).toHaveTextContent('null');
  });

  it('chưa đăng nhập hoặc lỗi cổng: giữ nguyên chưa đăng nhập', async () => {
    const out = createFirebasePersonalGateways(createFakeApi({ sessionState: 'signed_out' }));
    await renderWithProviders(
      <>
        <SessionHydrator />
        <Probe />
      </>,
      { personalGateways: out },
    );
    await act(async () => undefined);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
  });
});

describe('Đăng xuất thật qua SessionProvider (PER-21)', () => {
  it('gọi auth.signOut rồi xả phiên (shopId về null); lỗi thì giữ nguyên phiên', async () => {
    const api = createFakeApi({ sessionState: 'signed_in' });
    const gateways = createFirebasePersonalGateways(api);
    await renderWithProviders(
      <>
        <SessionHydrator />
        <Probe />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed_in'));

    api.auth.failNext('AUTH_NETWORK_ERROR');
    await act(async () => {
      screen.getByTestId('out').props.onPress();
    });
    expect(api.auth.signOutCalls).toBe(1);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
    expect(screen.getByTestId('shop')).toHaveTextContent('fake-session-shop');

    await act(async () => {
      screen.getByTestId('out').props.onPress();
    });
    expect(api.auth.signOutCalls).toBe(2);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
    expect(screen.getByTestId('shop')).toHaveTextContent('null');
    expect(screen.getByTestId('key')).toHaveTextContent('anonymous');
  });
});

describe('cổng cá nhân chế độ Firebase: tab Cá nhân thật (V1-05)', () => {
  async function setup() {
    const api = createFakeApi({ sessionState: 'signed_in' });
    const email = 'lan@example.com';
    await api.auth.signUpWithEmail({ email, password: 'Mat-khau-1' });
    const shop = await api.shop.createShop({ name: 'Shop Lan', sellingSources: ['shopee'] });
    const gateways = createFirebasePersonalGateways(withIdentity(api, shop.id));
    return { api, shop, account: gateways.account, email };
  }

  it('danh sách shop lấy từ máy chủ: shop của tài khoản, đang hoạt động', async () => {
    const { account, shop } = await setup();
    expect(await account.listShops()).toEqual([
      { id: shop.id, name: 'Shop Lan', role: 'owner', status: 'active', canEdit: true },
    ]);
  });

  it('danh sách shop lỗi thì ném mã của API (không trả rỗng giả)', async () => {
    const { api, account } = await setup();
    api.shop.failNext('AUTH_NETWORK_ERROR');
    expect(await codeOf(account.listShops())).toBe('AUTH_NETWORK_ERROR');
  });

  it('đổi tên shop: gửi tên đã chuẩn hóa, trả shop máy chủ xác nhận', async () => {
    const { api, account, shop } = await setup();
    expect(await account.updateShopName(shop.id, '  Shop Mới ')).toMatchObject({
      id: shop.id,
      name: 'Shop Mới',
      status: 'active',
    });
    expect(api.shop.renameCalls).toEqual([{ shopId: shop.id, name: 'Shop Mới' }]);
  });

  it('đổi tên shop: lỗi quyền giữ nguyên mã SHOP_PERMISSION_DENIED cho màn Sửa tên', async () => {
    const { api, account, shop } = await setup();
    api.shop.failNext('SHOP_PERMISSION_DENIED');
    expect(await codeOf(account.updateShopName(shop.id, 'X'))).toBe('SHOP_PERMISSION_DENIED');
  });

  it('chuyển shop: chỉ shop đang dùng hợp lệ; shop khác SHOP_SWITCH_FAILED (máy chủ một shop/tài khoản)', async () => {
    const { account, shop } = await setup();
    expect(await account.switchShop(shop.id)).toMatchObject({ id: shop.id });
    expect(await codeOf(account.switchShop('shop-khac'))).toBe('SHOP_SWITCH_FAILED');
  });

  it('đổi họ tên: gửi tên đã chuẩn hóa, hồ sơ trả về mang tên máy chủ đã nhận', async () => {
    const { api, account } = await setup();
    expect(await account.updateProfile({ displayName: '  Chị Lan ' })).toEqual({
      uid: 'u1',
      email: 'a@x.vn',
      displayName: 'Chị Lan',
      signInMethod: 'password',
    });
    expect(api.auth.displayNameCalls).toEqual(['Chị Lan']);
  });

  it('đổi họ tên lỗi mạng: ném, không báo đã lưu', async () => {
    const { api, account } = await setup();
    api.auth.failNext('AUTH_NETWORK_ERROR');
    expect(await codeOf(account.updateProfile({ displayName: 'A' }))).toBe('AUTH_NETWORK_ERROR');
  });

  it('xóa tài khoản (V1-15): chuyển mật khẩu cho API; sai -> AUTH_WRONG_CURRENT_PASSWORD; đúng -> resolve', async () => {
    const { api, account } = await setup();
    expect(await codeOf(account.deleteAccount('sai-1'))).toBe('AUTH_WRONG_CURRENT_PASSWORD');
    await expect(account.deleteAccount('Mat-khau-1')).resolves.toBe('deleted');
    expect(api.auth.deleteAccountCalls).toBe(2);
  });

  it('đổi mật khẩu: sai mật khẩu hiện tại -> AUTH_WRONG_CURRENT_PASSWORD; đúng -> resolve', async () => {
    const { api, account, email } = await setup();
    expect(
      await codeOf(account.changePassword({ currentPassword: 'sai-1', newPassword: 'Moi-hon-22' })),
    ).toBe('AUTH_WRONG_CURRENT_PASSWORD');
    await account.changePassword({ currentPassword: 'Mat-khau-1', newPassword: 'Moi-hon-22' });
    expect(api.auth.changePasswordCalls).toBe(2);
    await expect(
      api.auth.signInWithPassword({ email, password: 'Moi-hon-22' }),
    ).resolves.toBeTruthy();
  });

  it.each([
    'AUTH_REQUIRES_RECENT_LOGIN',
    'AUTH_SESSION_EXPIRED',
    'AUTH_TOO_MANY_REQUESTS',
  ] as const)(
    'đổi mật khẩu: lỗi %s đi nguyên lên màn (màn có nút Đăng nhập lại khi cần)',
    async (code) => {
      const { api, account } = await setup();
      api.auth.failNext(code);
      expect(
        await codeOf(
          account.changePassword({ currentPassword: 'Mat-khau-1', newPassword: 'Moi-hon-22' }),
        ),
      ).toBe(code);
    },
  );
});
