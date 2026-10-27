import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import type { ShopId } from '@/core/ids';
import { createMemoryOrderStore, LOCAL_SHOP_ID, type OrderStore } from '@/features/orders';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { ProfileScreen } from './ProfileScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock('@/platform/connectivity', () => ({ useIsOffline: () => false }));

beforeEach(() => resetMockNavigation());

const USER_A = { uid: 'user-a', email: 'a@example.com', displayName: 'Lan Anh' };

/** Đưa phiên vào trạng thái đã đăng nhập, mô phỏng cache trong bộ nhớ gắn với phiên (mẫu account-switch). */
function SessionProbe() {
  const session = useSession();
  const [cache, setCache] = useState<string | null>(null);
  useEffect(() => session.onSessionCleared(() => setCache(null)), [session]);
  return (
    <>
      <Text testID="probe-status">{session.state.status}</Text>
      <Text testID="probe-key">{session.key}</Text>
      <Text testID="probe-cache">{cache ?? '(đã xả)'}</Text>
      <Pressable testID="probe-fill" onPress={() => setCache('du-lieu-tai-khoan-A')} />
      <Pressable testID="probe-begin" onPress={() => session.beginSession(USER_A, 'shop-a')} />
    </>
  );
}

async function setup(
  options: { store?: OrderStore; gateways?: ReturnType<typeof createFakePersonalGateways> } = {},
) {
  const gateways = options.gateways ?? createFakePersonalGateways();
  await renderWithProviders(
    <>
      <SessionProbe />
      <ProfileScreen />
    </>,
    { personalGateways: gateways, orderStore: options.store ?? createMemoryOrderStore() },
  );
  await fireEvent.press(screen.getByTestId('probe-begin'));
  await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in'));
  await fireEvent.press(screen.getByTestId('probe-fill'));
  return gateways;
}

const openDialog = () => fireEvent.press(screen.getByTestId('sign-out'));
const confirmSignOut = async () => {
  const confirm = screen.getAllByText('Đăng xuất').at(-1);
  if (!confirm) throw new Error('Không thấy nút xác nhận');
  await fireEvent.press(confirm);
};
const withStore = (overrides: Partial<OrderStore>): OrderStore => ({
  ...createMemoryOrderStore(),
  ...overrides,
});

describe('Đăng xuất an toàn (PER-21)', () => {
  it('hộp thoại nói rõ sẽ phải đăng nhập lại và dữ liệu trên máy được giữ; Ở lại ứng dụng không gọi cổng', async () => {
    const gateways = await setup();
    await openDialog();
    expect(screen.getByText('Bạn muốn đăng xuất?')).toBeOnTheScreen();
    expect(
      screen.getByText(/Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng Đơn\sChứng\./),
    ).toBeOnTheScreen();
    expect(screen.getByText(/vẫn được giữ lại, không bị xóa/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ở lại ứng dụng'));
    expect(screen.queryByText('Bạn muốn đăng xuất?')).toBeNull();
    expect(gateways.account.signOutCalls).toBe(0);
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
  });

  it('thành công: gọi cổng, xả state/cache của tài khoản cũ, về Chào mừng, báo thành công SAU khi xong', async () => {
    const gateways = await setup();
    expect(screen.getByTestId('probe-key')).toHaveTextContent('user-a:shop-a');
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
    expect(gateways.account.signOutCalls).toBe(1);
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_out');
    expect(screen.getByTestId('probe-key')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('probe-cache')).toHaveTextContent('(đã xả)');
    expect(screen.getByText('Bạn đã đăng xuất thành công.')).toBeOnTheScreen();
  });

  it('không xóa dữ liệu cục bộ khi đăng xuất (Q-19h)', async () => {
    const store = createMemoryOrderStore();
    const spy = jest.spyOn(store, 'saveNewOrder');
    await setup({ store });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalled());
    // Kho chỉ được hỏi (đếm/kiểm tra), không có thao tác ghi/xóa nào.
    expect(spy).not.toHaveBeenCalled();
    expect(Object.keys(store)).not.toContain('deleteAll');
  });

  it('đang quay: chặn, KHÔNG gọi cổng đăng xuất, giữ phiên, không điều hướng', async () => {
    const hasRecording = jest.fn().mockResolvedValue(true);
    const gateways = await setup({
      store: withStore({ hasRecordingInProgress: hasRecording }),
    });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(screen.getByTestId('sign-out-recording')).toBeOnTheScreen());
    expect(screen.getByText(/kết thúc phiên quay trước khi đăng xuất/)).toBeOnTheScreen();
    expect(hasRecording).toHaveBeenCalledWith(LOCAL_SHOP_ID);
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
    expect(screen.getByTestId('probe-cache')).toHaveTextContent('du-lieu-tai-khoan-A');
  });

  it('còn bằng chứng chưa đồng bộ: cảnh báo cụ thể, có lối tới trung tâm đồng bộ, KHÔNG đăng xuất', async () => {
    const gateways = await setup({
      store: withStore({ countUnsynced: jest.fn().mockResolvedValue(3) }),
    });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(screen.getByTestId('sign-out-unsynced')).toBeOnTheScreen());
    expect(screen.getByTestId('sign-out-unsynced')).toHaveTextContent(/Còn 3 tệp bằng chứng/);
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('sign-out-open-sync'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
  });

  it('kho cục bộ không đọc được: không coi là an toàn, báo AUTH_SIGN_OUT_FAILED và giữ phiên', async () => {
    const gateways = await setup({
      store: withStore({ countUnsynced: jest.fn().mockRejectedValue(new Error('x')) }),
    });
    await openDialog();
    await confirmSignOut();
    await waitFor(() =>
      expect(screen.getByText(/Chưa đăng xuất được\. Bạn thử lại nhé\./)).toBeOnTheScreen(),
    );
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
  });

  it('cổng đăng xuất lỗi: báo AUTH_SIGN_OUT_FAILED, giữ phiên và state, không báo thành công giả, thử lại được', async () => {
    const gateways = await setup();
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await openDialog();
    await confirmSignOut();
    await waitFor(() =>
      expect(screen.getByText(/Chưa đăng xuất được\. Bạn thử lại nhé\./)).toBeOnTheScreen(),
    );
    expect(screen.queryByText('Bạn đã đăng xuất thành công.')).toBeNull();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
    expect(screen.getByTestId('probe-cache')).toHaveTextContent('du-lieu-tai-khoan-A');

    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
    expect(gateways.account.signOutCalls).toBe(2);
  });

  it('chống bấm lặp: bấm xác nhận nhiều lần khi đang kiểm tra chỉ đăng xuất một lần', async () => {
    let release: (n: number) => void = () => undefined;
    const countUnsynced = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const gateways = await setup({ store: withStore({ countUnsynced }) });
    await openDialog();
    const confirm = screen.getAllByText('Đăng xuất').at(-1);
    if (!confirm) throw new Error('Không thấy nút xác nhận');
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    expect(countUnsynced).toHaveBeenCalledTimes(1);
    await act(async () => release(0));
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledTimes(1));
    expect(gateways.account.signOutCalls).toBe(1);
  });

  it('cô lập theo shop: kiểm tra bằng shop hiện tại, không hỏi shop khác', async () => {
    const countUnsynced = jest.fn().mockResolvedValue(0);
    await setup({ store: withStore({ countUnsynced }) });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(countUnsynced).toHaveBeenCalled());
    const asked = countUnsynced.mock.calls.map((c) => c[0] as ShopId);
    expect(asked).toEqual([LOCAL_SHOP_ID]);
  });
});
