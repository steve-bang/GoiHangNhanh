import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import type { SessionIdentity } from '../domain/types';
import { SessionGate } from './SessionGate';
import { SessionHydrator } from './SessionHydrator';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

const WITH_SHOP: SessionIdentity = {
  uid: 'uid-a',
  email: 'a@x.vn',
  displayName: null,
  signInMethod: 'password',
  shopId: 'shop-a',
};

function SignOutProbe() {
  const { signOut } = useSession();
  return <Text testID="probe-out" onPress={() => void signOut()} />;
}

async function setup(
  identity: jest.Mock,
  { strict = true, latch = false }: { strict?: boolean; latch?: boolean } = {},
) {
  const gateways = createFakePersonalGateways({ latencyMs: 0 });
  gateways.account.getSessionIdentity = identity as never;
  gateways.account.signOut = async () => undefined;
  await renderWithProviders(
    <>
      <SessionHydrator />
      <SignOutProbe />
      <SessionGate latch={latch}>
        <Text testID="business-screen">màn nghiệp vụ</Text>
      </SessionGate>
    </>,
    { personalGateways: gateways, requireKnownShop: strict },
  );
}

const pending = () => jest.fn(() => new Promise<SessionIdentity | null>(() => undefined));

describe('SessionGate (V1-06): chế độ chặt (bản Firebase)', () => {
  it('đang nạp phiên: không hiện màn nghiệp vụ, hiện "Đang nạp thông tin cửa hàng…", không điều hướng', async () => {
    await setup(pending());
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(screen.getByText('Đang nạp thông tin cửa hàng…')).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('chưa đăng nhập (đã xác nhận) -> về Chào mừng, không hiện màn', async () => {
    await setup(jest.fn().mockResolvedValue(null));
    await act(async () => undefined);
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('đã đăng nhập nhưng chưa có cửa hàng -> Tạo cửa hàng, không mở bằng shop tạm', async () => {
    await setup(jest.fn().mockResolvedValue({ ...WITH_SHOP, shopId: null }));
    await act(async () => undefined);
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.createShop);
  });

  it('đã đăng nhập và biết cửa hàng -> mở màn', async () => {
    await setup(jest.fn().mockResolvedValue(WITH_SHOP));
    expect(await screen.findByTestId('business-screen')).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('offline lần đầu chưa có đệm userShops: "Chưa kết nối được cửa hàng" + Thử lại; có mạng thì mở', async () => {
    const identity = jest
      .fn()
      .mockRejectedValueOnce(new AppError('AUTH_NETWORK_ERROR'))
      .mockResolvedValue(WITH_SHOP);
    await setup(identity);
    await act(async () => undefined);
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(screen.getByText('Chưa kết nối được cửa hàng.')).toBeOnTheScreen();
    expect(
      screen.getByText('Bạn kiểm tra mạng rồi thử lại nhé. Dữ liệu trên máy vẫn được giữ.'),
    ).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(identity).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId('business-screen')).toBeOnTheScreen();
  });

  it('đăng xuất khi đang ở màn (không latch) -> gỡ màn, về Chào mừng', async () => {
    await setup(jest.fn().mockResolvedValue(WITH_SHOP));
    await screen.findByTestId('business-screen');
    await act(async () => screen.getByTestId('probe-out').props.onPress());
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });

  it('latch (màn quay): đã mở thì phiên đổi sau đó KHÔNG gỡ màn, không điều hướng (bất biến 2)', async () => {
    await setup(jest.fn().mockResolvedValue(WITH_SHOP), { latch: true });
    await screen.findByTestId('business-screen');
    await act(async () => screen.getByTestId('probe-out').props.onPress());
    expect(screen.getByTestId('business-screen')).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('latch không mở hộ khi chưa từng mở: chưa đăng nhập vẫn về Chào mừng', async () => {
    await setup(jest.fn().mockResolvedValue(null), { latch: true });
    await act(async () => undefined);
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });
});

describe('SessionGate: cổng giả (dev/test/bản web) giữ hành vi cũ', () => {
  it('hiện màn ngay, kể cả khi chưa nạp phiên / chưa đăng nhập; không điều hướng', async () => {
    await setup(pending(), { strict: false });
    expect(screen.getByTestId('business-screen')).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });
});
