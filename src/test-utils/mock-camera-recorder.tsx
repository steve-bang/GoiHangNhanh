import { useEffect } from 'react';
import { View } from 'react-native';

import type { CameraRecorderHandle, RecorderResult } from '@/platform/camera-recorder';

/**
 * Mock cho `@/platform/camera-recorder`:
 *
 *   jest.mock('@/platform/camera-recorder', () => jest.requireActual('@/test-utils/mock-camera-recorder').cameraRecorderMock);
 *
 * Test điều khiển bộ ghi qua `mockRecorder`: `signalReady()` (camera sẵn sàng), `finish(result)`
 * (kết thúc ghi, mô phỏng người dùng dừng hoặc lỗi), `mountError()` (camera không mở được).
 */
export const mockRecorder = {
  mounted: false,
  recordCalls: 0,
  stopCalls: 0,
  torch: false,
  onReady: undefined as undefined | (() => void),
  onError: undefined as undefined | (() => void),
  resolveDone: undefined as undefined | ((result: RecorderResult) => void),
  /** Chạy ĐỒNG BỘ ngay khi `record()` được gọi (mô phỏng màn bị gỡ đúng lúc bắt đầu ghi). */
  onRecord: undefined as undefined | (() => void),
  signalReady() {
    mockRecorder.onReady?.();
  },
  finish(result: RecorderResult) {
    mockRecorder.resolveDone?.(result);
  },
  mountError() {
    mockRecorder.onError?.();
  },
};

export function resetMockRecorder(): void {
  mockRecorder.mounted = false;
  mockRecorder.recordCalls = 0;
  mockRecorder.stopCalls = 0;
  mockRecorder.torch = false;
  mockRecorder.onReady = undefined;
  mockRecorder.onError = undefined;
  mockRecorder.resolveDone = undefined;
  mockRecorder.onRecord = undefined;
}

export const cameraRecorderMock = {
  CameraRecorder: ({
    handleRef,
    onReady,
    onError,
    torch,
    testID,
  }: {
    handleRef: { current: CameraRecorderHandle | null };
    onReady?: () => void;
    onError?: () => void;
    torch?: boolean;
    testID?: string;
  }) => {
    mockRecorder.mounted = true;
    mockRecorder.torch = torch ?? false;
    mockRecorder.onReady = onReady;
    mockRecorder.onError = onError;
    useEffect(() => {
      handleRef.current = {
        record: () => {
          mockRecorder.recordCalls += 1;
          const done = new Promise<RecorderResult>((resolve) => {
            mockRecorder.resolveDone = resolve;
          });
          mockRecorder.onRecord?.();
          return {
            done,
            stop: () => {
              mockRecorder.stopCalls += 1;
            },
          };
        },
      };
      return () => {
        handleRef.current = null;
      };
    }, [handleRef]);
    return <View testID={testID} />;
  },
};
