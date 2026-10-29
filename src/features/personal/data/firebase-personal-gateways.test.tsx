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
  it('nối danh tính, hồ sơ, shop và đăng xuất; phần còn lại GIỮ "chưa kết nối"', async () => {
    const api = createFakeApi({ sessionState: 'signed_in' });
    const created = await api.shop.createShop({ name: 'Shop A', sellingSources: [] });
    const { account, settings } = createFirebasePersonalGateways({
      ...api,
      session: {
        ...api.session,
        identity: async () => ({
          uid: 'u1',
          email: 'a@x.vn',
          displayName: null,
          shopId: created.id,
        }),
      },
    });
    expect(await account.getSessionIdentity()).toEqual({
      uid: 'u1',
      email: 'a@x.vn',
      displayName: null,
      shopId: created.id,
    });
    expect(await account.getProfile()).toMatchObject({ uid: 'u1', signInMethod: 'password' });
    expect(await account.getShopSummary()).toMatchObject({
      id: created.id,
      name: 'Shop A',
      role: 'owner',
    });
    for (const call of [
      () => account.listShops(),
      () => account.switchShop('s'),
      () => account.updateShopName('s', 'Tên'),
      () => account.updateProfile({ displayName: 'A' }),
      () => account.changePassword({ currentPassword: 'a', newPassword: 'b' }),
      () => settings.getNotificationPreferences(),
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
