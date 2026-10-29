import { useEffect, useRef, type MutableRefObject } from 'react';
import { CameraView } from 'expo-camera';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useScannerPermission, type ScannerPermission } from './barcode-scanner';

export type PhotoResult =
  | { readonly ok: true; readonly tempUri: string }
  | { readonly ok: false; readonly reason: 'PHOTO_FAILED' };

export interface CameraPhotoHandle {
  /** Chụp một ảnh. Ném lỗi nếu camera chưa sẵn sàng. */
  capture(): Promise<PhotoResult>;
}

interface CameraPhotoProps {
  /** Nhận tay cầm chụp khi camera đã gắn; `null` khi gỡ. */
  handleRef: MutableRefObject<CameraPhotoHandle | null>;
  /** Camera đã sẵn sàng chụp. */
  onReady?: () => void;
  /** Camera không mở được (bị app khác dùng, lỗi phần cứng, không có camera). */
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Quyền camera cho chụp ảnh: cùng quyền với quét mã (không thêm quyền micro, không thêm quyền mới). */
export type PhotoPermission = ScannerPermission;
export const usePhotoPermission = useScannerPermission;

/**
 * Camera CHỤP ẢNH trên `expo-camera` (`mode="picture"`, `takePictureAsync`). Không dùng micro. `exif: false`: tùy chọn này chỉ quyết định ảnh trả về có kèm EXIF hay không, KHÔNG nhồi GPS vào tệp;
 * vị trí thiết bị lưu ở bản ghi ảnh (`platform/location.ts`, Q-26k) là nguồn chính. Hướng ảnh do expo-camera xử lý
 * (chưa kiểm chứng trên thiết bị). Tệp trả về nằm ở thư mục TẠM của hệ điều hành nên bên gọi phải chuyển
 * vào thư mục bền ngay (`persistRecording`). Chưa kiểm chứng trên thiết bị (độ ổn định, xoay ảnh, bộ nhớ thấp).
 */
export function CameraPhoto({ handleRef, onReady, onError, style, testID }: CameraPhotoProps) {
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    handleRef.current = {
      async capture(): Promise<PhotoResult> {
        const camera = cameraRef.current;
        if (!camera) throw new Error('camera_not_ready');
        try {
          const photo = await camera.takePictureAsync({ quality: 0.9, exif: false });
          return photo?.uri
            ? { ok: true, tempUri: photo.uri }
            : { ok: false, reason: 'PHOTO_FAILED' };
        } catch {
          return { ok: false, reason: 'PHOTO_FAILED' };
        }
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
      mode="picture"
      mute
      {...(onReady ? { onCameraReady: onReady } : {})}
      {...(onError ? { onMountError: () => onError() } : {})}
    />
  );
}
