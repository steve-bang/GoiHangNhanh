import type { DeviceLocationOutcome, LocationPermissionStatus } from '@/platform/location';

/**
 * Mock cho `@/platform/location` (đã đăng ký mặc định trong `jest.setup.ts`). Test điều khiển qua
 * `mockLocation`: `permission`, `nextResult`. Test của chính adapter dùng `jest.unmock('@/platform/location')`.
 */
export const mockLocation = {
  permission: 'granted' as LocationPermissionStatus,
  requestCalls: 0,
  locateCalls: 0,
  nextResult: {
    ok: true,
    lat: 10.77,
    lng: 106.7,
    accuracyM: 12.4,
    atDevice: 20_000,
  } as DeviceLocationOutcome,
};

export function resetMockLocation(): void {
  mockLocation.permission = 'granted';
  mockLocation.requestCalls = 0;
  mockLocation.locateCalls = 0;
  mockLocation.nextResult = { ok: true, lat: 10.77, lng: 106.7, accuracyM: 12.4, atDevice: 20_000 };
}

export const locationMock = {
  LOCATION_TIMEOUT_MS: 3000,
  getLocationPermission: async () => mockLocation.permission,
  requestLocationPermission: async () => {
    mockLocation.requestCalls += 1;
    return mockLocation.permission;
  },
  getDeviceLocation: async () => {
    mockLocation.locateCalls += 1;
    return mockLocation.nextResult;
  },
};
