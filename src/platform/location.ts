import * as Location from 'expo-location';

/**
 * Vị trí của thiết bị tại lúc ghi (best-effort). Đây là số đọc của máy, KHÔNG chứng minh nơi chụp thật
 * (có thể sai số, có thể bị giả lập) nên không bao giờ gắn nhãn "đã xác thực vị trí" (CLAUDE.md #11).
 */
export type DeviceLocationOutcome =
  | {
      readonly ok: true;
      readonly lat: number;
      readonly lng: number;
      /** Sai số ngang ước tính (mét); `null` nếu hệ điều hành không báo. */
      readonly accuracyM: number | null;
      /** Giờ THIẾT BỊ (ms) lúc nhận vị trí. */
      readonly atDevice: number;
    }
  | { readonly ok: false; readonly status: 'denied' | 'unavailable' | 'timeout' | 'off' };

/** Thời gian chờ vị trí mặc định: ngắn để không làm chậm việc lưu ảnh (vị trí chỉ là phụ). */
export const LOCATION_TIMEOUT_MS = 3000;

export type LocationPermissionStatus = 'granted' | 'undetermined' | 'denied' | 'blocked';

function toPermissionStatus(
  response: Location.LocationPermissionResponse,
): LocationPermissionStatus {
  if (response.granted) return 'granted';
  if (response.canAskAgain === false) return 'blocked';
  return response.status === Location.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
}

/** Trạng thái quyền vị trí "khi đang dùng app", KHÔNG hiện hộp thoại xin quyền. */
export async function getLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    return toPermissionStatus(await Location.getForegroundPermissionsAsync());
  } catch {
    return 'denied';
  }
}

/**
 * Xin quyền vị trí "khi đang dùng app" (chỉ foreground, không bao giờ xin nền). Chỉ hiện hộp thoại khi
 * hệ điều hành còn cho hỏi; đã bị từ chối hẳn thì trả `blocked` mà không hỏi lại. Không ném lỗi.
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted || current.canAskAgain === false) return toPermissionStatus(current);
    return toPermissionStatus(await Location.requestForegroundPermissionsAsync());
  } catch {
    return 'denied';
  }
}

/**
 * Lấy vị trí hiện tại, tối đa `timeoutMs`. KHÔNG xin quyền (việc đó làm trước, ở `requestLocationPermission`)
 * và KHÔNG dùng vị trí cũ đã lưu của hệ điều hành (có thể là nơi khác). Không bao giờ ném lỗi:
 * `denied` (chưa được cấp quyền), `off` (dịch vụ vị trí của máy đang tắt), `timeout`, `unavailable`.
 * Chưa kiểm chứng trên thiết bị (độ chính xác, thời gian có vị trí lần đầu trong nhà).
 */
export async function getDeviceLocation(
  timeoutMs: number = LOCATION_TIMEOUT_MS,
): Promise<DeviceLocationOutcome> {
  try {
    if ((await getLocationPermission()) !== 'granted') return { ok: false, status: 'denied' };
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, status: 'off' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const position = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch((): null => null);
    const result = await Promise.race([position, timeout]);
    if (timer !== undefined) clearTimeout(timer);
    if (result === 'timeout') return { ok: false, status: 'timeout' };
    if (result === null) return { ok: false, status: 'unavailable' };
    const { latitude, longitude, accuracy } = result.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, status: 'unavailable' };
    }
    return {
      ok: true,
      lat: latitude,
      lng: longitude,
      accuracyM: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
      atDevice: Date.now(),
    };
  } catch {
    return { ok: false, status: 'unavailable' };
  }
}
