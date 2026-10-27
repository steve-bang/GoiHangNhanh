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
 * S1). CHỈ XEM TRƯỚC: không `recordAsync`, không micro (`mute`), không ghi tệp. Việc ghi video thật
 * là đợt sau (recorder, thư mục bền, máy trạng thái tệp); màn hình phải nói rõ "chưa ghi video".
 */
export function CameraPreview({ torch = false, onError, style, testID }: CameraPreviewProps) {
  return (
    <CameraView
      testID={testID}
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      mode="video"
      mute
      enableTorch={torch}
      {...(onError ? { onMountError: () => onError() } : {})}
    />
  );
}
