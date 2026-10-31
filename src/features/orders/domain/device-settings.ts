/**
 * Cài đặt THEO MÁY (bảng `device_settings`, migration v15, V1-09): lựa chọn gắn với chiếc máy này (ví dụ
 * "Chỉ tải khi có Wi‑Fi" theo gói cước), không phải dữ liệu của cửa hàng hay tài khoản, không đồng bộ
 * lên máy chủ. Kho lưu khóa/giá trị JSON; KIỂU nằm ở định nghĩa từng cài đặt nên PR sau (V1-10, V1-16)
 * thêm khóa mới mà không cần migration. Giá trị đã lưu sai kiểu/không đọc được -> giá trị mặc định.
 *
 * Khóa đã dùng (thêm khóa mới vào danh sách này để tránh trùng):
 * - `upload.wifi_only` (boolean, mặc định `false`): V1-09, `features/upload`.
 * - `privacy.crash_reports` (boolean, mặc định `true`): V1-16, `features/personal` (Gửi báo lỗi ứng dụng).
 */
export interface DeviceSettingDefinition<T> {
  /** Khóa ổn định dạng `<nhóm>.<tên>`; không đổi sau khi phát hành (giá trị cũ sẽ mất). */
  readonly key: string;
  readonly defaultValue: T;
  /** Kiểm kiểu giá trị đã giải mã JSON; sai kiểu trả `undefined` (dùng mặc định). */
  readonly decode: (raw: unknown) => T | undefined;
}

/** Cài đặt bật/tắt. */
export function booleanSetting(
  key: string,
  defaultValue: boolean,
): DeviceSettingDefinition<boolean> {
  return {
    key,
    defaultValue,
    decode: (raw) => (typeof raw === 'boolean' ? raw : undefined),
  };
}

/** Kho thô: đọc/ghi chuỗi JSON theo khóa. `read` trả `undefined` khi chưa lưu. */
export interface DeviceSettingsStore {
  read(key: string): Promise<string | undefined>;
  /** Ghi đè (upsert). `atDevice` = giờ THIẾT BỊ (ms). */
  write(key: string, value: string, atDevice: number): Promise<void>;
}

/** Đọc một cài đặt có kiểu từ chuỗi đã lưu: chưa có, JSON hỏng hoặc sai kiểu -> mặc định. */
export function decodeDeviceSetting<T>(
  definition: DeviceSettingDefinition<T>,
  stored: string | undefined,
): T {
  if (stored === undefined) return definition.defaultValue;
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return definition.defaultValue;
  }
  const value = definition.decode(raw);
  return value === undefined ? definition.defaultValue : value;
}

export function encodeDeviceSetting<T>(value: T): string {
  return JSON.stringify(value);
}
