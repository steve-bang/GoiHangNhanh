import { View } from 'react-native';

/**
 * Mock dùng chung cho adapter quét mã (`@/platform/barcode-scanner`). Dùng trong test màn hình:
 *
 *   jest.mock('@/platform/barcode-scanner', () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock);
 *
 * Điều khiển quyền bằng `mockScanner.permission`, mô phỏng camera đọc mã bằng `mockScanner.emit(code)`.
 */
export const mockScanner = {
  permission: 'granted' as 'checking' | 'granted' | 'askable' | 'blocked',
  request: jest.fn(async () => undefined),
  torch: false,
  onScan: undefined as undefined | ((code: string) => void),
  onError: undefined as undefined | (() => void),
  emit(code: string) {
    mockScanner.onScan?.(code);
  },
};

export function resetMockScanner(): void {
  mockScanner.permission = 'granted';
  mockScanner.request.mockClear();
  mockScanner.torch = false;
  mockScanner.onScan = undefined;
  mockScanner.onError = undefined;
}

export const barcodeScannerMock = {
  useScannerPermission: () => ({ status: mockScanner.permission, request: mockScanner.request }),
  BarcodeScannerView: ({
    onScan,
    onError,
    torch,
    testID,
  }: {
    onScan: (code: string) => void;
    onError?: () => void;
    torch?: boolean;
    testID?: string;
  }) => {
    mockScanner.onScan = onScan;
    mockScanner.onError = onError;
    mockScanner.torch = torch ?? false;
    return <View testID={testID} />;
  },
};
