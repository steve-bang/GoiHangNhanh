import type { ErrorCode } from '@/core/errors/codes';

import { MIN_FREE_BYTES_TO_RECORD } from './recording-controller';

/** Quyền camera như `useScannerPermission` báo. */
export type CameraStatus = 'checking' | 'granted' | 'askable' | 'blocked';

/** Điều kiện BẮT BUỘC của A04 mà app kiểm được (micro chưa kiểm: ghi không tiếng tới khi O-09 chốt). */
export type PrecheckId = 'camera' | 'storage' | 'localWrite';

/** Cách khắc phục hiển thị cho người dùng (không tự thực hiện thay họ). */
export type PrecheckFix = 'request_permission' | 'open_settings' | 'free_storage' | 'retry';

export interface PrecheckIssue {
  readonly id: PrecheckId;
  /** Mã lỗi của docs/04 A04 (thông báo lấy từ `errors:<code>`). */
  readonly code: Extract<
    ErrorCode,
    'CAMERA_PERMISSION_DENIED' | 'INSUFFICIENT_STORAGE' | 'LOCAL_SAVE_UNAVAILABLE'
  >;
  readonly fix: PrecheckFix;
}

export type PrecheckResult =
  /** Còn đang chờ hệ điều hành trả lời quyền camera. */
  | { readonly status: 'pending' }
  | { readonly status: 'ready' }
  | { readonly status: 'blocked'; readonly issues: readonly PrecheckIssue[] };

export interface PrecheckPorts {
  readonly camera: CameraStatus;
  /** Dung lượng trống (byte); `null` = không đọc được (không chặn quay: không đoán là thiếu). */
  readonly freeBytes: number | null;
  /** Thử ghi vào nơi lưu bền; `false` = không ghi được (chặn). */
  readonly canWrite: () => boolean;
  /** Ngưỡng dung lượng tối thiểu; mặc định giá trị tạm chờ O-05. */
  readonly minFreeBytes?: number;
}

/**
 * Kiểm tra sẵn sàng ghi hình (docs/04 A04): quyền camera, dung lượng trống so với ngưỡng, khả năng ghi
 * tệp cục bộ. Hàm thuần, chạy ngầm; chỉ trả `blocked` khi có điều kiện bắt buộc không đạt, và liệt kê
 * TẤT CẢ điều kiện không đạt để người dùng xử lý một lượt. Không đọc dung lượng thì không chặn; thử ghi
 * lỗi thì chặn (video có thể không lưu được). Quyền camera còn `checking` thì `pending`, chưa kết luận.
 */
export function runPrecheck(ports: PrecheckPorts): PrecheckResult {
  if (ports.camera === 'checking') return { status: 'pending' };
  const issues: PrecheckIssue[] = [];
  if (ports.camera !== 'granted') {
    issues.push({
      id: 'camera',
      code: 'CAMERA_PERMISSION_DENIED',
      fix: ports.camera === 'askable' ? 'request_permission' : 'open_settings',
    });
  }
  const min = ports.minFreeBytes ?? MIN_FREE_BYTES_TO_RECORD;
  if (ports.freeBytes !== null && ports.freeBytes < min) {
    issues.push({ id: 'storage', code: 'INSUFFICIENT_STORAGE', fix: 'free_storage' });
  }
  if (!ports.canWrite()) {
    issues.push({ id: 'localWrite', code: 'LOCAL_SAVE_UNAVAILABLE', fix: 'retry' });
  }
  return issues.length === 0 ? { status: 'ready' } : { status: 'blocked', issues };
}
