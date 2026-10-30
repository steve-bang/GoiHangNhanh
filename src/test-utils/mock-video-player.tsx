import { View } from 'react-native';

/**
 * Mock cho adapter phát video cục bộ (`@/platform/video-player`), bật chung trong `jest.setup.ts`
 * (`expo-video` là mô-đun native). Test điều khiển lỗi phát qua `mockVideoPlayer.onError`; test của
 * chính adapter dùng `jest.unmock`.
 */
export const mockVideoPlayer = {
  uri: undefined as string | undefined,
  onError: undefined as undefined | (() => void),
};

export function resetMockVideoPlayer(): void {
  mockVideoPlayer.uri = undefined;
  mockVideoPlayer.onError = undefined;
}

export const videoPlayerMock = {
  LocalVideoPlayer: ({
    uri,
    onError,
    testID,
    accessibilityLabel,
  }: {
    uri: string;
    onError?: () => void;
    testID?: string;
    accessibilityLabel?: string;
  }) => {
    mockVideoPlayer.uri = uri;
    mockVideoPlayer.onError = onError;
    return <View testID={testID} accessibilityLabel={accessibilityLabel} />;
  },
};
