import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';

interface VideoPlayerProps {
  /**
   * Nguồn phát: tệp trên máy (`file://…`, từ `resolveRecordingUri`) hoặc URL ký `https://…` từ máy chủ
   * (`getEvidenceReadUrl`). URL ký là bí mật ngắn hạn: không log.
   */
  uri: string;
  /** Trình phát không mở được tệp (hỏng, định dạng lạ, bị hệ điều hành chặn). */
  onError?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Phát MỘT video bằng chứng, từ tệp trên máy hoặc URL ký của máy chủ (UI-E04, V1-17) bằng `expo-video` (Expo SDK 58, iOS AVPlayer,
 * Android ExoPlayer, web thẻ `<video>`). Lớp native đọc thẳng từ tệp/luồng nên video không nạp vào bộ nhớ JS.
 * CHỈ ĐỌC: không cache (`useCaching: false`, video bằng chứng là dữ liệu nhạy cảm, kể cả bản phát từ máy chủ), không chỉnh, không ghi tệp gốc (bất biến 4). Không tự phát
 * (người dùng bấm phát ở thanh điều khiển của hệ điều hành), không phát nền, không hình-trong-hình
 * (`app.json` plugin `expo-video` đặt cả hai là `false`). Chưa kiểm chứng trên thiết bị (video dài, tua).
 */
export function VideoPlayer({ uri, onError, accessibilityLabel, style, testID }: VideoPlayerProps) {
  const player = useVideoPlayer({ uri, useCaching: false });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onError?.();
  });
  return (
    <VideoView
      testID={testID}
      player={player}
      style={style}
      nativeControls
      contentFit="contain"
      allowsPictureInPicture={false}
      startsPictureInPictureAutomatically={false}
      fullscreenOptions={{ enable: true }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
