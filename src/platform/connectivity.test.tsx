import { act, renderHook } from '@testing-library/react-native';

import type * as ConnectivityModuleTypes from './connectivity';

jest.unmock('@/platform/connectivity');

type Listener = (state: { type: string; isConnected: boolean | null }) => void;
const netInfoListeners: Listener[] = [];
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: Listener) => {
      netInfoListeners.push(listener);
      return () => undefined;
    },
  },
}));

type ConnectivityModule = typeof ConnectivityModuleTypes;

function load(): ConnectivityModule {
  let mod!: ConnectivityModule;
  jest.isolateModules(() => {
    mod = jest.requireActual<ConnectivityModule>('./connectivity');
  });
  return mod;
}

const emit = (type: string, isConnected: boolean | null) =>
  netInfoListeners.forEach((listener) => listener({ type, isConnected }));

beforeEach(() => {
  netInfoListeners.length = 0;
});

describe('toConnectivity', () => {
  const { toConnectivity } = load();
  it.each([
    ['wifi', true, { online: true, type: 'wifi' }],
    ['cellular', true, { online: true, type: 'cellular' }],
    ['ethernet', true, { online: true, type: 'other' }],
    ['vpn', true, { online: true, type: 'other' }],
    ['unknown', null, { online: true, type: 'other' }], // chưa biết: coi là có mạng
    ['wifi', null, { online: true, type: 'wifi' }],
    ['none', false, { online: false, type: 'none' }],
    ['wifi', false, { online: false, type: 'none' }],
    ['none', null, { online: false, type: 'none' }],
  ] as const)('%s, isConnected=%s', (type, isConnected, expected) => {
    expect(toConnectivity({ type, isConnected } as never)).toEqual(expected);
  });
});

describe('connectivity', () => {
  it('trước sự kiện đầu: có mạng; sau đó theo NetInfo, chỉ báo khi đổi', () => {
    const { getConnectivity, subscribeConnectivity } = load();
    expect(getConnectivity()).toEqual({ online: true, type: 'other' });
    const seen: boolean[] = [];
    const unsubscribe = subscribeConnectivity((value) => seen.push(value.online));
    expect(netInfoListeners).toHaveLength(1); // một đăng ký NetInfo cho cả app
    emit('none', false);
    emit('none', false); // không đổi: không báo lại
    emit('wifi', true);
    expect(seen).toEqual([false, true]);
    expect(getConnectivity()).toEqual({ online: true, type: 'wifi' });
    unsubscribe();
    emit('none', false);
    expect(seen).toEqual([false, true]);
    expect(getConnectivity().online).toBe(false);
  });

  it('useIsOffline theo trạng thái mạng', async () => {
    // Không cô lập mô-đun ở đây: hook phải dùng cùng bản React với renderer.
    const { useIsOffline } = jest.requireActual<ConnectivityModule>('./connectivity');
    const { result } = await renderHook(() => useIsOffline());
    expect(result.current).toBe(false);
    await act(async () => emit('none', false));
    expect(result.current).toBe(true);
    await act(async () => emit('cellular', true));
    expect(result.current).toBe(false);
  });
});
