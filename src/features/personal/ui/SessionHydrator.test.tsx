import { act, screen } from '@testing-library/react-native';
import { useSyncExternalStore as mockUseSyncExternalStore } from 'react';
import { Text } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import type { SessionIdentity } from '../domain/types';
import { HYDRATE_MIN_RETRY_INTERVAL_MS, SessionHydrator } from './SessionHydrator';
import { useSession } from './SessionProvider';

const mockAppActive = new Set<() => void>();
jest.mock('@/platform/app-state', () => ({
  subscribeAppActive: (cb: () => void) => {
    mockAppActive.add(cb);
    return () => mockAppActive.delete(cb);
  },
}));

let mockOffline = false;
const mockOfflineListeners = new Set<() => void>();
const setOffline = (value: boolean) => {
  mockOffline = value;
  mockOfflineListeners.forEach((l) => l());
};
jest.mock('@/platform/connectivity', () => ({
  useIsOffline: () =>
    mockUseSyncExternalStore(
      (cb) => {
        mockOfflineListeners.add(cb);
        return () => mockOfflineListeners.delete(cb);
      },
      () => mockOffline,
    ),
}));

const IDENTITY_A: SessionIdentity = {
  uid: 'uid-a',
  email: 'a@x.vn',
  displayName: null,
  signInMethod: 'password',
  shopId: 'shop-a',
};

let clock = 1_000_000;
beforeEach(() => {
  mockAppActive.clear();
  mockOfflineListeners.clear();
  mockOffline = false;
  clock = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterEach(() => jest.restoreAllMocks());

const foreground = () => act(async () => void mockAppActive.forEach((cb) => cb()));
const advance = (ms: number) => {
  clock += ms;
};

function Probe() {
  const { state, signOut, beginSession, hydration, retryHydration } = useSession();
  return (
    <>
      <Text testID="hydration">{hydration}</Text>
      <Text testID="retry" onPress={retryHydration} />
      <Text testID="status">{state.status}</Text>
      <Text testID="user">{String(state.user?.uid)}</Text>
      <Text testID="shop">{String(state.shopId)}</Text>
      <Text testID="out" onPress={() => void signOut().catch(() => undefined)} />
      <Text
        testID="login-b"
        onPress={() => beginSession({ uid: 'uid-b', email: 'b@x.vn', displayName: null }, 'shop-b')}
      />
    </>
  );
}

function setup(getSessionIdentity: jest.Mock) {
  const gateways = createFakePersonalGateways();
  gateways.account.getSessionIdentity = getSessionIdentity as never;
  gateways.account.signOut = async () => undefined;
  return renderWithProviders(
    <>
      <SessionHydrator />
      <Probe />
    </>,
    { personalGateways: gateways },
  );
}

const networkError = () => new AppError('AUTH_NETWORK_ERROR');

describe('SessionHydrator: thử lại khi nạp danh tính lỗi', () => {
  it('lần 1 lỗi, app về foreground (sau giãn cách) thì lần 2 thành công và nạp phiên', async () => {
    const identity = jest.fn().mockRejectedValueOnce(networkError()).mockResolvedValue(IDENTITY_A);
    await setup(identity);
    await act(async () => undefined);
    expect(identity).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');

    advance(HYDRATE_MIN_RETRY_INTERVAL_MS);
    await foreground();
    expect(identity).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
    expect(screen.getByTestId('user')).toHaveTextContent('uid-a');
    expect(screen.getByTestId('shop')).toHaveTextContent('shop-a');
  });

  it('có giới hạn tần suất: về foreground liên tục trong giãn cách chỉ thử một lần', async () => {
    const identity = jest.fn().mockRejectedValue(networkError());
    await setup(identity);
    await act(async () => undefined);
    await foreground();
    advance(HYDRATE_MIN_RETRY_INTERVAL_MS - 1);
    await foreground();
    expect(identity).toHaveBeenCalledTimes(1);
    advance(1);
    await foreground();
    expect(identity).toHaveBeenCalledTimes(2);
  });

  it('không chạy chồng: lần thử trước chưa xong thì kích hoạt mới bị bỏ qua', async () => {
    let resolve: (value: SessionIdentity | null) => void = () => undefined;
    const identity = jest.fn(
      () =>
        new Promise<SessionIdentity | null>((r) => {
          resolve = r;
        }),
    );
    await setup(identity);
    advance(HYDRATE_MIN_RETRY_INTERVAL_MS * 3);
    await foreground();
    await foreground();
    expect(identity).toHaveBeenCalledTimes(1);
    await act(async () => resolve(IDENTITY_A));
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
  });

  it('mạng có lại (offline -> online) thì thử lại', async () => {
    mockOffline = true;
    const identity = jest.fn().mockRejectedValueOnce(networkError()).mockResolvedValue(IDENTITY_A);
    await setup(identity);
    await act(async () => undefined);
    expect(identity).toHaveBeenCalledTimes(1);
    advance(HYDRATE_MIN_RETRY_INTERVAL_MS);
    await act(async () => setOffline(false));
    expect(identity).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
  });

  it('chưa đăng nhập (trả null) là câu trả lời dứt khoát: không thử lại nữa', async () => {
    const identity = jest.fn().mockResolvedValue(null);
    await setup(identity);
    await act(async () => undefined);
    advance(HYDRATE_MIN_RETRY_INTERVAL_MS);
    await foreground();
    expect(identity).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
  });

  it('người dùng đăng nhập giữa chừng: kết quả muộn bị bỏ, không thay phiên hợp lệ', async () => {
    let resolve: (value: SessionIdentity | null) => void = () => undefined;
    const identity = jest.fn(
      () =>
        new Promise<SessionIdentity | null>((r) => {
          resolve = r;
        }),
    );
    await setup(identity);
    await act(async () => screen.getByTestId('login-b').props.onPress());
    await act(async () => resolve(IDENTITY_A));
    expect(screen.getByTestId('user')).toHaveTextContent('uid-b');
    expect(screen.getByTestId('shop')).toHaveTextContent('shop-b');
  });

  it('đã đăng nhập thì không thử nữa; đăng xuất xong về foreground cũng không nạp lại danh tính cũ', async () => {
    const identity = jest.fn().mockResolvedValue(IDENTITY_A);
    await setup(identity);
    await act(async () => undefined);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
    await act(async () => screen.getByTestId('out').props.onPress());
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
    advance(HYDRATE_MIN_RETRY_INTERVAL_MS * 3);
    await foreground();
    expect(identity).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
  });
});

describe('SessionHydrator: báo trạng thái nạp cho cổng phiên (V1-06)', () => {
  it('bắt đầu "đang nạp"; có danh tính -> "đã xong"', async () => {
    let resolve: (value: SessionIdentity | null) => void = () => undefined;
    const identity = jest.fn(
      () =>
        new Promise<SessionIdentity | null>((r) => {
          resolve = r;
        }),
    );
    await setup(identity);
    expect(screen.getByTestId('hydration')).toHaveTextContent('pending');
    await act(async () => resolve(IDENTITY_A));
    expect(screen.getByTestId('hydration')).toHaveTextContent('settled');
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
  });

  it('chưa đăng nhập (null) -> "đã xong", vẫn signed_out', async () => {
    await setup(jest.fn().mockResolvedValue(null));
    await act(async () => undefined);
    expect(screen.getByTestId('hydration')).toHaveTextContent('settled');
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
  });

  it('lỗi -> "lỗi"; Thử lại của người dùng thử NGAY (bỏ giãn cách), hiện "đang nạp" rồi nạp được', async () => {
    let resolve: (value: SessionIdentity | null) => void = () => undefined;
    const identity = jest
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockImplementation(
        () =>
          new Promise<SessionIdentity | null>((r) => {
            resolve = r;
          }),
      );
    await setup(identity);
    await act(async () => undefined);
    expect(screen.getByTestId('hydration')).toHaveTextContent('failed');

    // Chưa hết giãn cách 10 giây nhưng người dùng bấm: vẫn thử.
    await act(async () => screen.getByTestId('retry').props.onPress());
    expect(identity).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('hydration')).toHaveTextContent('pending');
    // Bấm lặp khi đang chờ: không chạy chồng.
    await act(async () => screen.getByTestId('retry').props.onPress());
    expect(identity).toHaveBeenCalledTimes(2);

    await act(async () => resolve(IDENTITY_A));
    expect(screen.getByTestId('hydration')).toHaveTextContent('settled');
    expect(screen.getByTestId('shop')).toHaveTextContent('shop-a');
  });

  it('Thử lại lỗi tiếp -> quay về "lỗi"', async () => {
    const identity = jest.fn().mockRejectedValue(networkError());
    await setup(identity);
    await act(async () => undefined);
    await act(async () => screen.getByTestId('retry').props.onPress());
    expect(identity).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('hydration')).toHaveTextContent('failed');
  });

  it('đăng nhập trong app khi đang lỗi nạp -> "đã xong"; đăng xuất sau đó vẫn "đã xong"', async () => {
    await setup(jest.fn().mockRejectedValue(networkError()));
    await act(async () => undefined);
    expect(screen.getByTestId('hydration')).toHaveTextContent('failed');
    await act(async () => screen.getByTestId('login-b').props.onPress());
    expect(screen.getByTestId('hydration')).toHaveTextContent('settled');
    await act(async () => screen.getByTestId('out').props.onPress());
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
    expect(screen.getByTestId('hydration')).toHaveTextContent('settled');
  });
});
