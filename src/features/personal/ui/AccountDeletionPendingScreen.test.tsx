import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import type { DisputeId, OrderId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { createMemoryDisputeStore } from '@/features/disputes';
import { createMemoryOrderStore, type OrderStore } from '@/features/orders';
import { createMemoryLocalWipe } from '@/test-utils/memory-local-wipe';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways, FAKE_ACCOUNT_PASSWORD } from '../data/fake-personal-gateways';
import { AccountDeletionPendingScreen } from './AccountDeletionPendingScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

function SessionProbe() {
  const { beginSession } = useSession();
  return (
    <Pressable
      testID="begin-session"
      onPress={() => beginSession({ uid: 'u1', email: 'a@example.com', displayName: null }, null)}
    />
  );
}

async function setup(
  options: {
    store?: OrderStore;
    openDisputes?: number;
    localWipe?: ReturnType<typeof createMemoryLocalWipe>;
  } = {},
) {
  const gateways = createFakePersonalGateways({ shop: null });
  const localWipe = options.localWipe ?? createMemoryLocalWipe();
  const disputeStore = createMemoryDisputeStore();
  for (let i = 0; i < (options.openDisputes ?? 0); i += 1) {
    await disputeStore.createDispute({
      id: `d-${i}` as DisputeId,
      shopId: 'shop-x' as ShopId,
      subject: { kind: 'order', orderId: 'o1' as OrderId, label: 'DH001' },
      issueType: 'missing_item',
      note: '',
      createdAtDevice: 1,
    });
  }
  await renderWithProviders(
    <>
      <SessionProbe />
      <AccountDeletionPendingScreen />
    </>,
    {
      personalGateways: gateways,
      orderStore: options.store ?? createMemoryOrderStore(),
      disputeStore,
      localWipe,
    },
  );
  await fireEvent.press(screen.getByTestId('begin-session'));
  return { gateways, localWipe };
}

describe('Đang hoàn tất xóa tài khoản (V1-15, xóa dở dang V1-14 l)', () => {
  it('giải thích, câu chung 30 ngày, điều kiện máy (không có mục chủ cửa hàng), ô mật khẩu và Đăng xuất', async () => {
    await setup();
    expect(screen.getByTestId('screen-UI-A04-deletion-pending')).toBeOnTheScreen();
    expect(screen.getByTestId('pending-intro')).toHaveTextContent(/đã bắt đầu nhưng chưa xong/);
    expect(screen.getByTestId('pending-server-status')).toHaveTextContent(
      /đang trong quá trình xóa trên máy chủ\..*dữ liệu cửa hàng trên máy chủ bị xóa hẳn sau 30 ngày, trừ khi phải giữ lại vì lý do pháp lý hoặc tranh chấp đang mở/,
    );
    // Không dùng câu "Tài khoản bị xóa ngay" của màn Xóa tài khoản.
    expect(screen.queryByText(/Tài khoản bị xóa ngay/)).toBeNull();
    expect(screen.queryByTestId('delete-condition-ownership')).toBeNull();
    expect(await screen.findByTestId('delete-password')).toBeOnTheScreen();
    expect(screen.getByTestId('pending-sign-out')).toBeOnTheScreen();
  });

  it('nhập lại mật khẩu: gọi lại deleteAccount rồi xóa trên máy như luồng thường, về Chào mừng', async () => {
    const { gateways, localWipe } = await setup();
    await waitFor(() => expect(screen.getByTestId('delete-confirm')).toBeEnabled());
    await fireEvent.changeText(screen.getByTestId('delete-password'), FAKE_ACCOUNT_PASSWORD);
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
    expect(gateways.account.deleteAccountCalls).toBe(1);
    expect(localWipe.state.log).toEqual([
      'setMarker',
      'deleteEvidenceFiles',
      'wipeDatabase',
      'clearMarker',
    ]);
  });

  it('còn tranh chấp mở trên máy: không cho xóa dữ liệu trên máy, vẫn đăng xuất được', async () => {
    const { gateways } = await setup({ openDisputes: 1 });
    expect(await screen.findByTestId('delete-blocked-hint')).toHaveTextContent(
      /được giữ lại\..*liên hệ hỗ trợ\..*vẫn có thể đăng xuất/,
    );
    // Người dùng không vào được hồ sơ: không bảo "đóng hồ sơ".
    expect(screen.getByTestId('delete-condition-disputes')).not.toHaveTextContent(/Hãy đóng hồ sơ/);
    expect(screen.getByTestId('delete-condition-disputes')).toHaveTextContent(
      /Còn 1 hồ sơ tranh chấp đang mở trên máy, nên dữ liệu trên máy được giữ lại\./,
    );
    expect(screen.queryByTestId('delete-password')).toBeNull();
    await fireEvent.press(screen.getByTestId('pending-sign-out'));
    const dialogConfirm = screen.getAllByText('Đăng xuất').at(-1);
    if (!dialogConfirm) throw new Error('no dialog');
    await fireEvent.press(dialogConfirm);
    await waitFor(() => expect(gateways.account.signOutCalls).toBe(1));
    expect(gateways.account.deleteAccountCalls).toBe(0);
  });

  it('còn tệp chưa tải: phải tích riêng mới hoàn tất; đăng xuất KHÔNG bị chặn vì tệp (cửa hàng đã khóa)', async () => {
    const { gateways } = await setup({
      store: { ...createMemoryOrderStore(), countUnsyncedOnDevice: async () => 2 },
    });
    expect(await screen.findByTestId('delete-unsynced-warning')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('delete-password'), FAKE_ACCOUNT_PASSWORD);
    expect(screen.getByTestId('delete-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tôi hiểu 2 tệp này sẽ mất' }));
    expect(screen.getByTestId('delete-confirm')).toBeEnabled();

    await fireEvent.press(screen.getByTestId('pending-sign-out'));
    const dialogConfirm = screen.getAllByText('Đăng xuất').at(-1);
    if (!dialogConfirm) throw new Error('no dialog');
    await fireEvent.press(dialogConfirm);
    await waitFor(() => expect(gateways.account.signOutCalls).toBe(1));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });
});
