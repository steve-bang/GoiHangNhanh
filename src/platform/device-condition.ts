import { BatteryState, getBatteryLevelAsync, getBatteryStateAsync } from 'expo-battery';

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

export const UNKNOWN_DEVICE_CONDITION: DeviceCondition = {
  batteryLevel: null,
  charging: null,
  thermal: null,
};

/**
 * Đọc pin và trạng thái sạc bằng `expo-battery`. Nhiệt độ: Expo KHÔNG có API nhiệt (chỉ có ở lớp native:
 * iOS `ProcessInfo.thermalState`, Android `PowerManager.getCurrentThermalStatus`), nên `thermal` luôn
 * `null` cho tới khi có mô-đun native; quy tắc chặn theo nhiệt đã viết sẵn ở `runPrecheck`. Lỗi đọc hoặc
 * máy không hỗ trợ (mức pin -1, web) thì trả "không biết". Chưa kiểm chứng trên thiết bị.
 */
export async function readDeviceCondition(): Promise<DeviceCondition> {
  try {
    const [level, state] = await Promise.all([getBatteryLevelAsync(), getBatteryStateAsync()]);
    return {
      batteryLevel: Number.isFinite(level) && level >= 0 && level <= 1 ? level : null,
      charging:
        state === BatteryState.CHARGING || state === BatteryState.FULL
          ? true
          : state === BatteryState.UNPLUGGED
            ? false
            : null,
      thermal: null,
    };
  } catch {
    return UNKNOWN_DEVICE_CONDITION;
  }
}
