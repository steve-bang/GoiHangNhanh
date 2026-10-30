import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import type { SessionIdentity } from '../domain/types';
import { useCurrentShopId } from '@/features/orders';

import { SessionGate } from './SessionGate';
import { HYDRATE_TIMEOUT_MS, SessionHydrator } from './SessionHydrator';
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
  const { signOut, changeShop } = useSession();
  return (
    <>
      <Text testID="probe-out" onPress={() => void signOut()} />
      <Text testID="probe-shop-b" onPress={() => changeShop('shop-b')} />
    </>
  );
}

function ShopProbe({ testID }: { testID: string }) {
  return <Text testID={testID}>{useCurrentShopId()}</Text>;
}

const mockSignOutGateway = jest.fn(async () => undefined);
beforeEach(() => mockSignOutGateway.mockClear());

async function setup(
  identity: jest.Mock,
  {
    strict = true,
    latch = false,
    extra = null,
  }: { strict?: boolean; latch?: boolean; extra?: React.ReactNode } = {},
) {
  const gateways = createFakePersonalGateways({ latencyMs: 0 });
  gateways.account.getSessionIdentity = identity as never;
  gateways.account.signOut = mockSignOutGateway;
  await renderWithProviders(
    <>
      <SessionHydrator />
      <SignOutProbe />
      <SessionGate latch={latch}>
        <Text testID="business-screen">màn nghiệp vụ</Text>
        <ShopProbe testID="gate-shop" />
      </SessionGate>
      {extra}
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

describe('SessionGate: màn quay (latch) giữ shop và giữ các cổng khác (review PR #49)', () => {
  it('màn quay giữ shopId chụp lúc mở khi phiên chuyển shop; màn thường đọc shop mới', async () => {
    await setup(jest.fn().mockResolvedValue(WITH_SHOP), {
      extra: (
        <SessionGate latch>
          <ShopProbe testID="record-shop" />
        </SessionGate>
      ),
    });
    expect(await screen.findByTestId('record-shop')).toHaveTextContent('shop-a');
    await act(async () => screen.getByTestId('probe-shop-b').props.onPress());
    expect(screen.getByTestId('record-shop')).toHaveTextContent('shop-a');
    expect(screen.getByTestId('gate-shop')).toHaveTextContent('shop-b');
  });

  it('đang có màn quay mở: đăng xuất KHÔNG làm cổng khác reset (gỡ màn quay); đóng màn quay thì mới về Chào mừng', async () => {
    function Recording() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <Text testID="close-recording" onPress={() => setOpen(false)} />
          {open ? (
            <SessionGate latch>
              <Text testID="recording-screen">đang quay</Text>
            </SessionGate>
          ) : null}
        </>
      );
    }
    await setup(jest.fn().mockResolvedValue(WITH_SHOP), { extra: <Recording /> });
    await screen.findByTestId('recording-screen');
    await act(async () => screen.getByTestId('probe-out').props.onPress());
    expect(screen.getByTestId('recording-screen')).toBeOnTheScreen();
    // Cổng thường (màn bên dưới, ví dụ nhóm tab) giữ nội dung, không điều hướng.
    expect(screen.getByTestId('business-screen')).toBeOnTheScreen();
    expect(mockNavigation.reset).not.toHaveBeenCalled();

    await act(async () => screen.getByTestId('close-recording').props.onPress());
    expect(screen.queryByTestId('business-screen')).toBeNull();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome);
  });
});

describe('SessionGate: thoát khỏi trạng thái kẹt (review PR #49)', () => {
  it('đang nạp quá HYDRATE_TIMEOUT_MS -> "Chưa kết nối được cửa hàng" có Thử lại', async () => {
    jest.useFakeTimers();
    try {
      const identity = jest
        .fn()
        .mockImplementationOnce(() => new Promise<SessionIdentity | null>(() => undefined))
        .mockResolvedValue(WITH_SHOP);
      await setup(identity);
      expect(screen.getByText('Đang nạp thông tin cửa hàng…')).toBeOnTheScreen();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(HYDRATE_TIMEOUT_MS - 1);
      });
      expect(screen.queryByText('Chưa kết nối được cửa hàng.')).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText('Chưa kết nối được cửa hàng.')).toBeOnTheScreen();
      // Lần treo không chặn Thử lại.
      await act(async () => {
        await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
      });
      expect(identity).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('business-screen')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('"Chưa kết nối được cửa hàng" có Đăng xuất theo luồng an toàn: xác nhận rồi mới đăng xuất, về Chào mừng', async () => {
    await setup(jest.fn().mockRejectedValue(new AppError('AUTH_NETWORK_ERROR')));
    await act(async () => undefined);
    await fireEvent.press(screen.getByTestId('session-gate-sign-out'));
    expect(screen.getByText('Xác nhận đăng xuất')).toBeOnTheScreen();
    expect(mockSignOutGateway).not.toHaveBeenCalled();
    await act(async () => {
      const buttons = screen.getAllByRole('button', { name: 'Đăng xuất' });
      await fireEvent.press(buttons[buttons.length - 1]!);
    });
    expect(mockSignOutGateway).toHaveBeenCalledTimes(1);
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
