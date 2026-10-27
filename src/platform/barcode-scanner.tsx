import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Adapter mỏng trên `expo-camera` (ADR-016, chờ spike thiết bị thật): màn hình chỉ biết hai thứ ở
 * đây, nên đổi thư viện quét chỉ sửa tệp này. Chỉ dùng để QUÉT mã (không quay video, không micro).
 */

/** Mã đơn/vận đơn thường gặp: QR và các mã vạch dòng (nhãn sàn, nhãn vận chuyển). */
const SCAN_BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'code128',
  'code39',
  'code93',
  'ean13',
  'ean8',
  'itf14',
  'upc_a',
  'upc_e',
  'codabar',
  'datamatrix',
];

/**
 * `checking`: chưa biết. `granted`: dùng được. `askable`: chưa hỏi hoặc có thể hỏi lại.
 * `blocked`: người dùng đã từ chối hẳn, chỉ bật lại được trong Cài đặt hệ điều hành.
 */
export type ScannerPermission = 'checking' | 'granted' | 'askable' | 'blocked';

export function useScannerPermission(): {
  status: ScannerPermission;
  request: () => Promise<void>;
} {
  const [permission, requestPermission] = useCameraPermissions();
  const status: ScannerPermission = !permission
    ? 'checking'
    : permission.granted
      ? 'granted'
      : permission.canAskAgain
        ? 'askable'
        : 'blocked';
  return {
    status,
    request: async () => {
      await requestPermission();
    },
  };
}

interface BarcodeScannerViewProps {
  /** Gọi mỗi lần camera đọc được mã (có thể lặp liên tục cùng một mã: nơi dùng tự chống lặp). */
  onScan: (code: string) => void;
  torch?: boolean;
  /** Camera không mở được (bị app khác dùng, lỗi phần cứng, không có camera). */
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function BarcodeScannerView({
  onScan,
  torch = false,
  onError,
  style,
  testID,
}: BarcodeScannerViewProps) {
  return (
    <CameraView
      testID={testID}
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: SCAN_BARCODE_TYPES }}
      onBarcodeScanned={({ data }) => {
        const code = data.trim();
        if (code.length > 0) onScan(code);
      }}
      {...(onError ? { onMountError: () => onError() } : {})}
    />
  );
}
