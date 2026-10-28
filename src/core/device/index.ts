/**
 * Kiểu tình trạng máy dùng chung (TypeScript thuần). MỘT nguồn: `platform/device-condition.ts` (đọc từ
 * hệ điều hành) và `features/packing/domain/precheck.ts` (quy tắc kiểm tra) cùng dùng, domain không
 * import platform.
 */

/** Mức nhiệt do hệ điều hành báo (iOS `thermalState`, Android `thermalStatus`). */
export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';

/**
 * Tình trạng máy lúc kiểm tra trước khi quay (A04: "cảnh báo thiết bị quá nóng/bộ nhớ gần đầy nếu hệ
 * điều hành cung cấp"). Mỗi trường `null` = KHÔNG biết (không đoán, không chặn).
 */
export interface DeviceCondition {
  /** Mức pin 0..1. */
  readonly batteryLevel: number | null;
  /** Đang cắm sạc hoặc đã đầy; `null` khi không rõ. */
  readonly charging: boolean | null;
  readonly thermal: ThermalLevel | null;
}
