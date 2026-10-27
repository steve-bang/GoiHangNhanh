import { View } from 'react-native';

/**
 * Mock cho adapter xem trước camera (`@/platform/camera-preview`):
 *
 *   jest.mock('@/platform/camera-preview', () => jest.requireActual('@/test-utils/mock-camera-preview').cameraPreviewMock);
 */
export const mockPreview = {
  torch: false,
  onError: undefined as undefined | (() => void),
};

export function resetMockPreview(): void {
  mockPreview.torch = false;
  mockPreview.onError = undefined;
}

export const cameraPreviewMock = {
  CameraPreview: ({
    torch,
    onError,
    testID,
  }: {
    torch?: boolean;
    onError?: () => void;
    testID?: string;
  }) => {
    mockPreview.torch = torch ?? false;
    mockPreview.onError = onError;
    return <View testID={testID} />;
  },
};
