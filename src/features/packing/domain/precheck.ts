import type { ErrorCode } from '@/core/errors/codes';

import {
  DEFAULT_RECORDING_POLICY,
  MIN_BATTERY_LEVEL,
  requiredFreeBytes,
  type RecordingPolicy,
} from './recording-policy';

/** Quyền camera như `useScannerPermission` báo. */
export type CameraStatus = 'checking' | 'granted' | 'askable' | 'blocked';

/** Mức nhiệt do hệ điều hành báo. */
export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';

/** Tình trạng máy; mỗi trường `null` = không biết (không đoán, không chặn). */
export interface DeviceConditionInput {
  /** Mức pin 0..1. */
  readonly batteryLevel: number | null;
  /** Đang sạc hoặc đã đầy. */
  readonly charging: boolean | null;
  readonly thermal: ThermalLevel | null;
}

/** Điều kiện BẮT BUỘC của A04 mà app kiểm được (micro chưa kiểm: ghi không tiếng tới khi O-09 chốt). */
export type PrecheckId = 'camera' | 'storage' | 'localWrite' | 'battery' | 'thermal';

/** Cách khắc phục hiển thị cho người dùng (không tự thực hiện thay họ). */
export type PrecheckFix =
  'request_permission' | 'open_settings' | 'free_storage' | 'retry' | 'charge' | 'cool_down';

export interface PrecheckIssue {
  readonly id: PrecheckId;
  /** Mã lỗi (thông báo lấy từ `errors:<code>`); `BATTERY_LOW`/`DEVICE_OVERHEATED` là mã đề xuất chờ BA. */
  readonly code: Extract<
    ErrorCode,
    | 'CAMERA_PERMISSION_DENIED'
    | 'INSUFFICIENT_STORAGE'
    | 'LOCAL_SAVE_UNAVAILABLE'
    | 'BATTERY_LOW'
    | 'DEVICE_OVERHEATED'
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
  /** Pin và nhiệt độ; không truyền = không biết. */
  readonly device?: DeviceConditionInput;
  /** Chính sách giới hạn quay (O-05); mặc định tối đa 10 phút, về sau theo gói. */
  readonly policy?: RecordingPolicy;
}

/**
 * Kiểm tra sẵn sàng ghi hình (docs/04 A04): quyền camera, chỗ trống đủ quay tối thiểu theo chính sách
 * (mặc định tối đa 10 phút mỗi lần quay, O-05), khả năng ghi tệp cục bộ, pin và nhiệt độ. Hàm thuần, chạy ngầm; chỉ trả
 * `blocked` khi có điều kiện không đạt, và liệt kê TẤT CẢ để người dùng xử lý một lượt. Không đọc được
 * dung lượng, pin hay nhiệt độ thì KHÔNG chặn (không đoán); thử ghi lỗi thì chặn. Pin chỉ chặn khi không
 * cắm sạc. Quyền camera còn `checking` thì `pending`, chưa kết luận.
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
  const min = requiredFreeBytes(ports.policy ?? DEFAULT_RECORDING_POLICY);
  if (ports.freeBytes !== null && ports.freeBytes < min) {
    issues.push({ id: 'storage', code: 'INSUFFICIENT_STORAGE', fix: 'free_storage' });
  }
  if (!ports.canWrite()) {
    issues.push({ id: 'localWrite', code: 'LOCAL_SAVE_UNAVAILABLE', fix: 'retry' });
  }
  const { batteryLevel, charging, thermal } = ports.device ?? {
    batteryLevel: null,
    charging: null,
    thermal: null,
  };
  if (batteryLevel !== null && batteryLevel <= MIN_BATTERY_LEVEL && charging !== true) {
    issues.push({ id: 'battery', code: 'BATTERY_LOW', fix: 'charge' });
  }
  if (thermal === 'serious' || thermal === 'critical') {
    issues.push({ id: 'thermal', code: 'DEVICE_OVERHEATED', fix: 'cool_down' });
  }
  return issues.length === 0 ? { status: 'ready' } : { status: 'blocked', issues };
}
