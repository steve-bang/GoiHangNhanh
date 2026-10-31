import { useEffect } from 'react';
import { View } from 'react-native';

import type { CameraPhotoHandle, PhotoPermission, PhotoResult } from '@/platform/camera-photo';

/**
 * Mock cho `@/platform/camera-photo`:
 *
 *   jest.mock('@/platform/camera-photo', () => jest.requireActual('@/test-utils/mock-camera-photo').cameraPhotoMock);
 *
 * Test điều khiển qua `mockPhoto`: `permission` (quyền camera), `nextResult` (kết quả lần chụp tới),
 * `signalReady()`, `mountError()`.
 */
export const mockPhoto = {
  mounted: false,
  captureCalls: 0,
  permission: 'granted' as PhotoPermission,
  requestCalls: 0,
  nextResult: { ok: true, tempUri: 'file:///cache/Camera/photo.jpg' } as PhotoResult,
  onReady: undefined as undefined | (() => void),
  onError: undefined as undefined | (() => void),
  signalReady() {
    mockPhoto.onReady?.();
  },
  mountError() {
    mockPhoto.onError?.();
  },
};

export function resetMockPhoto(): void {
  mockPhoto.mounted = false;
  mockPhoto.captureCalls = 0;
  mockPhoto.permission = 'granted';
  mockPhoto.requestCalls = 0;
  mockPhoto.nextResult = { ok: true, tempUri: 'file:///cache/Camera/photo.jpg' };
  mockPhoto.onReady = undefined;
  mockPhoto.onError = undefined;
}

export const cameraPhotoMock = {
  usePhotoPermission: () => ({
    status: mockPhoto.permission,
    request: async () => {
      mockPhoto.requestCalls += 1;
    },
  }),
  CameraPhoto: ({
    handleRef,
    onReady,
    onError,
    testID,
  }: {
    handleRef: { current: CameraPhotoHandle | null };
    onReady?: () => void;
    onError?: () => void;
    testID?: string;
  }) => {
    mockPhoto.mounted = true;
    mockPhoto.onReady = onReady;
    mockPhoto.onError = onError;
    useEffect(() => {
      handleRef.current = {
        capture: async () => {
          mockPhoto.captureCalls += 1;
          return mockPhoto.nextResult;
        },
      };
      return () => {
        handleRef.current = null;
      };
    }, [handleRef]);
    return <View testID={testID} />;
  },
};
