import { CameraView } from 'expo-camera';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface CameraPreviewProps {
  torch?: boolean;
  /** Camera không mở được (bị app khác dùng, lỗi phần cứng, không có camera). */
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Xem trước camera sau cho màn quay (UI-C03, UI-D04) trên `expo-camera` (ADR-016/017, chờ spike
 * S1). CHỈ XEM TRƯỚC: không `recordAsync`, không ghi tệp. Dùng `mode="picture"` (không phải
 * `"video"`) để xem trước không dính tới micro: `app.json` đặt `microphonePermission: false` nên
 * Info.plist không có mô tả micro, và chế độ video có thể chạm micro trên iOS (thiếu mô tả thì hệ
 * điều hành kết thúc app). Khi nối recorder thật phải đổi sang `mode="video"` CÙNG VỚI mô tả quyền
 * micro và quyết định O-09 (tiếng khi từ chối micro). Việc ghi video thật là đợt sau; màn hình phải
 * nói rõ "chưa ghi video".
 */
export function CameraPreview({ torch = false, onError, style, testID }: CameraPreviewProps) {
  return (
    <CameraView
      testID={testID}
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      mode="picture"
      mute
      enableTorch={torch}
      {...(onError ? { onMountError: () => onError() } : {})}
    />
  );
}
