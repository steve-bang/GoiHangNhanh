import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  createLocalOrderStore,
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
  type OrderStore,
} from '@/features/orders';
import { ROUTES } from '@/core/navigation';
import { colors } from '@/core/theme';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';
import { sampleOrder, sampleSession } from '@/test-utils/order-fixtures';
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
const USER_B = { uid: 'user-b', email: 'b@example.com', displayName: null };

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
      <Pressable testID="probe-begin-b" onPress={() => session.beginSession(USER_B, 'shop-b')} />
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
  it('hộp thoại (khung 4a) có icon, hỏi xác nhận và nói dữ liệu trên máy được giữ; Ở lại ứng dụng không gọi cổng', async () => {
    const gateways = await setup();
    await openDialog();
    expect(screen.getByText('Xác nhận đăng xuất')).toBeOnTheScreen();
    expect(screen.getByText('Bạn có chắc muốn đăng xuất khỏi ứng dụng?')).toBeOnTheScreen();
    // Hàng "Đăng xuất" của màn nền và icon của hộp thoại cùng dùng glyph này.
    expect(
      screen.getAllByTestId('icon-log-out-outline', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.getByText('Video và dữ liệu trên máy này vẫn được giữ lại.')).toBeOnTheScreen();
    // "Ở lại ứng dụng" là nút chính (xanh đặc); "Đăng xuất" là nút phụ viền và chữ đỏ.
    const stay = StyleSheet.flatten(
      screen.getByRole('button', { name: 'Ở lại ứng dụng' }).props.style as never,
    ) as Record<string, unknown>;
    expect(stay).toMatchObject({ backgroundColor: colors.brand });
    const confirm = screen
      .getAllByRole('button', { name: 'Đăng xuất' })
      .map((node) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>)
      .filter((style) => style.borderColor === colors.danger);
    expect(confirm).toHaveLength(1);
    expect(confirm[0]).toMatchObject({ backgroundColor: colors.surface });
    await fireEvent.press(screen.getByText('Ở lại ứng dụng'));
    expect(screen.queryByText('Xác nhận đăng xuất')).toBeNull();
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

  it.each([
    ['bộ nhớ', async () => createMemoryOrderStore()],
    [
      'SQLite (node:sqlite)',
      async () => createLocalOrderStore(async () => createNodeSqliteDatabase()),
    ],
  ] as const)(
    'không xóa dữ liệu cục bộ khi đăng xuất (Q-20h): đơn và phiên còn nguyên (%s)',
    async (_name, create) => {
      const store = await create();
      const details = sampleOrder();
      await store.saveNewOrder(details);
      const session = sampleSession(details);
      await store.saveSession(session);

      await setup({ store });
      await openDialog();
      await confirmSignOut();
      await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
      expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_out');

      expect(await store.getOrder(LOCAL_SHOP_ID, details.order.id)).toEqual(details);
      expect(await store.getSession(LOCAL_SHOP_ID, session.id)).toEqual(session);
      expect(await store.listSessionsOfOrder(LOCAL_SHOP_ID, details.order.id)).toHaveLength(1);
    },
  );

  it('tài khoản A sửa tên rồi đăng xuất, tài khoản B vào: không thấy tên của A (cổng giả không giữ dữ liệu A)', async () => {
    const gateways = await setup();
    await gateways.account.updateProfile({ displayName: 'Tên riêng của A' });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
    expect((await gateways.account.getProfile()).displayName).toBeNull();

    await fireEvent.press(screen.getByTestId('probe-begin-b'));
    await waitFor(() => expect(screen.getByTestId('probe-key')).toHaveTextContent('user-b:shop-b'));
    await waitFor(() => expect(screen.getByTestId('profile-no-name')).toBeOnTheScreen());
    expect(screen.queryByText('Tên riêng của A')).toBeNull();
  });

  it('đang quay: chặn, KHÔNG gọi cổng đăng xuất, giữ phiên, không điều hướng', async () => {
    const hasRecording = jest.fn().mockResolvedValue(true);
    const gateways = await setup({
      store: withStore({ hasRecordingOnDevice: hasRecording }),
    });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(screen.getByTestId('sign-out-recording')).toBeOnTheScreen());
    expect(screen.getByTestId('sign-out-recording')).toHaveTextContent(
      'Bạn đang quay video đóng gói. Hãy dừng quay trước khi đăng xuất.',
    );
    // Khung 4b: icon camera, CHỈ một nút "Ở lại ứng dụng" (không có lối đăng xuất).
    expect(screen.getByText('Đang quay video')).toBeOnTheScreen();
    expect(
      screen.getByTestId('icon-videocam-outline', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    // Chỉ còn hàng "Đăng xuất" của màn nền; hộp thoại không có nút đăng xuất.
    expect(
      screen.getAllByRole('button', { name: 'Đăng xuất' }).map((b) => b.props.testID as string),
    ).toEqual(['sign-out']);
    await fireEvent.press(screen.getByRole('button', { name: 'Ở lại ứng dụng' }));
    expect(screen.queryByTestId('sign-out-recording')).toBeNull();
    expect(gateways.account.signOutCalls).toBe(0);
    expect(hasRecording).toHaveBeenCalledTimes(1);
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
    expect(screen.getByTestId('probe-cache')).toHaveTextContent('du-lieu-tai-khoan-A');
  });

  it('còn bằng chứng chưa đồng bộ: cảnh báo cụ thể, có lối tới trung tâm đồng bộ, KHÔNG đăng xuất', async () => {
    const gateways = await setup({
      store: withStore({ countUnsyncedOnDevice: jest.fn().mockResolvedValue(3) }),
    });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(screen.getByTestId('sign-out-unsynced')).toBeOnTheScreen());
    expect(screen.getByTestId('sign-out-unsynced')).toHaveTextContent(/Còn 3 tệp bằng chứng/);
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();

    // Khung 4c: nút chính "Xem trung tâm đồng bộ", nút phụ "Ở lại ứng dụng"; KHÔNG có "Đăng xuất" (Q-20l).
    expect(screen.getByText('Còn bằng chứng chưa đồng bộ')).toBeOnTheScreen();
    expect(
      screen.getAllByRole('button', { name: 'Đăng xuất' }).map((b) => b.props.testID as string),
    ).toEqual(['sign-out']);
    expect(screen.getByRole('button', { name: 'Ở lại ứng dụng' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('sign-out-open-sync'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
    expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in');
  });

  it('kho cục bộ không đọc được: không coi là an toàn, báo AUTH_SIGN_OUT_FAILED và giữ phiên', async () => {
    const gateways = await setup({
      store: withStore({ countUnsyncedOnDevice: jest.fn().mockRejectedValue(new Error('x')) }),
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
    const countUnsyncedOnDevice = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const gateways = await setup({ store: withStore({ countUnsyncedOnDevice }) });
    await openDialog();
    const confirm = screen.getAllByText('Đăng xuất').at(-1);
    if (!confirm) throw new Error('Không thấy nút xác nhận');
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    expect(countUnsyncedOnDevice).toHaveBeenCalledTimes(1);
    await act(async () => release(0));
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledTimes(1));
    expect(gateways.account.signOutCalls).toBe(1);
  });

  it('đăng xuất kiểm tra TOÀN THIẾT BỊ: phiên đang quay của shop khác (không phải shop đang dùng) vẫn chặn', async () => {
    const store = createMemoryOrderStore();
    const other = sampleOrder();
    const details = {
      ...other,
      order: { ...other.order, shopId: 'shop-khac' as never },
    };
    await store.saveNewOrder(details);
    await store.saveSession({ ...sampleSession(details), sessionStatus: 'recording' as never });
    // Phiên đăng nhập đang dùng shop-a: kiểm tra theo shop không thấy, nhưng đăng xuất vẫn bị chặn.
    expect(await store.hasRecordingInProgress('shop-a' as never)).toBe(false);

    const gateways = await setup({ store });
    await openDialog();
    await confirmSignOut();
    await waitFor(() => expect(screen.getByTestId('sign-out-recording')).toBeOnTheScreen());
    expect(gateways.account.signOutCalls).toBe(0);
  });
});
