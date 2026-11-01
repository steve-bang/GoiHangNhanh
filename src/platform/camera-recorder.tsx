import { useEffect, useRef, type MutableRefObject } from 'react';
import { CameraView } from 'expo-camera';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export type RecorderResult =
  | { readonly ok: true; readonly tempUri: string }
  | { readonly ok: false; readonly reason: 'RECORDER_FAILED' };

export interface CameraRecorderHandle {
  /** Bắt đầu ghi một video. Ném lỗi nếu camera chưa sẵn sàng. */
  record(options?: { readonly maxDurationSec?: number }): {
    readonly done: Promise<RecorderResult>;
    stop(): void;
  };
}

/**
 * Thông số quay (V1-22). Kiểu định nghĩa ở đây để `platform` không import `features`; UI truyền hằng từ
 * domain (`VIDEO_PROFILE`) xuống. `quality`/`bitrateBps` là prop của `CameraView`; `codec`/`maxFileBytes`
 * là tùy chọn của `recordAsync` (`codec` chỉ iOS; Android bỏ qua, CameraX ra H.264). Không đặt thì dùng
 * mặc định của `expo-camera` (hành vi cũ).
 */
export interface CameraRecordProfile {
  readonly quality: '1080p' | '720p';
  readonly bitrateBps: number;
  readonly codec: 'avc1' | 'hvc1';
  readonly maxFileBytes: number;
}

interface CameraRecorderProps {
  /** Thông số quay cố định (độ phân giải, bitrate, codec, trần dung lượng). */
  profile?: CameraRecordProfile;
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
 * trên thiết bị (độ ổn định ghi dài, bị ngắt cuộc gọi/nền, hết bộ nhớ). Hành vi `profile` (V1-22) dựa trên
 * ĐỌC mã nguồn `expo-camera` 58.0.12, chưa chạy trên máy.
 */
export function CameraRecorder({
  handleRef,
  onReady,
  torch = false,
  onError,
  style,
  testID,
  profile,
}: CameraRecorderProps) {
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    handleRef.current = {
      record(options) {
        const camera = cameraRef.current;
        if (!camera) throw new Error('camera_not_ready');
        const recordOptions = {
          ...(options?.maxDurationSec !== undefined ? { maxDuration: options.maxDurationSec } : {}),
          // maxFileSize: lưới cứng chống tệp > 2 GB, có trên cả hai nền tảng (camera tự dừng và trả tệp
          // hợp lệ khi chạm trần). `codec` bắt buộc ở iOS để `videoBitrate` có tác dụng.
          ...(profile ? { maxFileSize: profile.maxFileBytes, codec: profile.codec } : {}),
        };
        const done = camera
          .recordAsync(Object.keys(recordOptions).length > 0 ? recordOptions : undefined)
          .then(
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
  }, [handleRef, profile]);

  return (
    <CameraView
      ref={cameraRef}
      testID={testID}
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      mode="video"
      mute
      {...(profile ? { videoQuality: profile.quality, videoBitrate: profile.bitrateBps } : {})}
      enableTorch={torch}
      {...(onReady ? { onCameraReady: onReady } : {})}
      {...(onError ? { onMountError: () => onError() } : {})}
    />
  );
}
