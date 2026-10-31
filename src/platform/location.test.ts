import * as Location from 'expo-location';

import {
  getDeviceLocation,
  getLocationPermission,
  requestLocationPermission,
} from '@/platform/location';

// `jest.setup.ts` thay adapter bằng mock; ở đây thử chính adapter với expo-location giả.
jest.unmock('@/platform/location');
jest.mock('expo-location', () => ({
  PermissionStatus: { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mocked = Location as unknown as {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

const perm = (status: string, canAskAgain = true) => ({
  status,
  granted: status === 'granted',
  canAskAgain,
});

beforeEach(() => {
  jest.useRealTimers();
  for (const fn of [
    mocked.getForegroundPermissionsAsync,
    mocked.requestForegroundPermissionsAsync,
    mocked.hasServicesEnabledAsync,
    mocked.getCurrentPositionAsync,
  ]) {
    fn.mockReset();
  }
  mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('granted'));
  mocked.hasServicesEnabledAsync.mockResolvedValue(true);
  mocked.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 10.5, longitude: 106.25, accuracy: 7.5 },
    timestamp: 1,
  });
});

describe('getDeviceLocation', () => {
  it('có quyền + dịch vụ bật: trả tọa độ, sai số và giờ thiết bị', async () => {
    const result = await getDeviceLocation();
    expect(result).toMatchObject({ ok: true, lat: 10.5, lng: 106.25, accuracyM: 7.5 });
    expect(result.ok && result.atDevice).toBeGreaterThan(0);
  });

  it('sai số không báo: accuracyM = null', async () => {
    mocked.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: null },
    });
    expect(await getDeviceLocation()).toMatchObject({ ok: true, accuracyM: null });
  });

  it('chưa cấp quyền: denied và KHÔNG hỏi quyền, KHÔNG đọc vị trí', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('denied'));
    expect(await getDeviceLocation()).toEqual({ ok: false, status: 'denied' });
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('dịch vụ vị trí tắt: off', async () => {
    mocked.hasServicesEnabledAsync.mockResolvedValue(false);
    expect(await getDeviceLocation()).toEqual({ ok: false, status: 'off' });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('quá thời gian chờ: timeout (không dùng vị trí cũ)', async () => {
    mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
    expect(await getDeviceLocation(20)).toEqual({ ok: false, status: 'timeout' });
  });

  it('hệ điều hành báo lỗi hoặc tọa độ hỏng: unavailable, không ném lỗi', async () => {
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('no signal'));
    expect(await getDeviceLocation()).toEqual({ ok: false, status: 'unavailable' });
    mocked.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: Number.NaN, longitude: 2, accuracy: 1 },
    });
    expect(await getDeviceLocation()).toEqual({ ok: false, status: 'unavailable' });
    mocked.hasServicesEnabledAsync.mockRejectedValue(new Error('boom'));
    expect(await getDeviceLocation()).toEqual({ ok: false, status: 'unavailable' });
  });
});

describe('quyền vị trí', () => {
  it('getLocationPermission không hiện hộp thoại; phân biệt chưa hỏi, từ chối, bị chặn', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('undetermined'));
    expect(await getLocationPermission()).toBe('undetermined');
    mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('denied', false));
    expect(await getLocationPermission()).toBe('blocked');
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requestLocationPermission chỉ hỏi khi còn hỏi được; đã cấp hoặc bị chặn thì không hỏi', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('undetermined'));
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(perm('granted'));
    expect(await requestLocationPermission()).toBe('granted');
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);

    mocked.requestForegroundPermissionsAsync.mockClear();
    mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('granted'));
    expect(await requestLocationPermission()).toBe('granted');
    mocked.getForegroundPermissionsAsync.mockResolvedValue(perm('denied', false));
    expect(await requestLocationPermission()).toBe('blocked');
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('lỗi hệ điều hành: coi là denied, không ném', async () => {
    mocked.getForegroundPermissionsAsync.mockRejectedValue(new Error('x'));
    expect(await getLocationPermission()).toBe('denied');
    expect(await requestLocationPermission()).toBe('denied');
  });
});
