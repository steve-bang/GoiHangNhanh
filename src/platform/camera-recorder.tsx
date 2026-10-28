import { useEffect, useRef, type MutableRefObject } from 'react';
import { CameraView } from 'expo-camera';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export type RecorderResult =
  | { readonly ok: true; readonly tempUri: string }
  | { readonly ok: false; readonly reason: 'RECORDER_FAILED' };

export interface CameraRecorderHandle {
  /** Bắt đầu ghi một video. Ném lỗi nếu camera chưa sẵn sàng. */
  record(): { readonly done: Promise<RecorderResult>; stop(): void };
}

interface CameraRecorderProps {
  /** Nhận tay cầm điều khiển ghi khi camera đã gắn; `null` khi gỡ. */
  handleRef: MutableRefObject<CameraRecorderHandle | null>;
  /** Camera đã sẵn sàng ghi. */
  onReady?: () => void;
  torch?: boolean;
  /** Camera không mở được (bị app khác dùng, lỗi phần cứng). */
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Camera GHI VIDEO thật trên `expo-camera` (`mode="video"`, `recordAsync`). Ghi KHÔNG tiếng
 * (`mute`): `app.json` đặt `microphonePermission: false`, và việc có thu tiếng hay không là quyết định
 * mở O-09; không đụng micro để không phát sinh quyền mới. Tệp trả về nằm ở thư mục TẠM của hệ điều hành
 * nên bên gọi phải chuyển vào thư mục bền ngay (`persistRecording`). `expo-camera` không có sự kiện
 * "đã bắt đầu ghi": coi là đang ghi khi `recordAsync` đã được gọi mà chưa báo lỗi. Chưa kiểm chứng
 * trên thiết bị (độ ổn định ghi dài, bị ngắt cuộc gọi/nền, hết bộ nhớ).
 */
export function CameraRecorder({
  handleRef,
  onReady,
  torch = false,
  onError,
  style,
  testID,
}: CameraRecorderProps) {
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    handleRef.current = {
      record() {
        const camera = cameraRef.current;
        if (!camera) throw new Error('camera_not_ready');
        const done = camera.recordAsync().then(
          (video): RecorderResult =>
            video?.uri
              ? { ok: true, tempUri: video.uri }
              : { ok: false, reason: 'RECORDER_FAILED' },
          (): RecorderResult => ({ ok: false, reason: 'RECORDER_FAILED' }),
        );
        // Giữ chính đối tượng camera đang ghi: khi màn bị gỡ, React tháo `cameraRef` TRƯỚC các cleanup nên
        // `cameraRef.current?.stopRecording()` lúc đó là no-op. Dừng qua tay cầm này không phụ thuộc màn.
        // Nếu view native đã bị hủy, lời gọi có thể không còn tác dụng (cần kiểm chứng trên thiết bị).
        return {
          done,
          stop: () => {
            try {
              Promise.resolve(camera.stopRecording()).catch(() => undefined);
            } catch {
              // camera đã bị hủy: kết quả ghi (nếu có) vẫn tới qua `done`
            }
          },
        };
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return (
    <CameraView
      ref={cameraRef}
      testID={testID}
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      mode="video"
      mute
      enableTorch={torch}
      {...(onReady ? { onCameraReady: onReady } : {})}
      {...(onError ? { onMountError: () => onError() } : {})}
    />
  );
}
