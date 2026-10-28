/**
 * Chính sách giới hạn quay (O-05, người dùng chốt): MẶC ĐỊNH mỗi lần quay TỐI ĐA 10 phút, quá thì app
 * tự dừng và báo người dùng; và máy phải đủ chỗ trống để quay trọn thời lượng đó thì mới cho bắt đầu.
 * Về sau thời lượng tối đa này sẽ theo GÓI của người dùng (docs/06); hôm nay chưa có dữ liệu gói nên
 * dùng mặc định cho mọi người. Nơi duy nhất cần đổi khi có gói: cung cấp `RecordingPolicy` khác cho
 * `runPrecheck`, `startRecording` và màn quay.
 */
export interface RecordingPolicy {
  /** Số phút tối đa cho một lần quay (cũng là số phút mà chỗ trống phải chứa được). */
  readonly maxRecordMinutes: number;
}

export const DEFAULT_RECORDING_POLICY: RecordingPolicy = { maxRecordMinutes: 10 };

/**
 * Ước lượng dung lượng một phút video (byte) để đổi "phút" ra "byte": 60 MB/phút (khoảng 8 Mbps, 1080p).
 * GIÁ TRỊ ƯỚC LƯỢNG chưa đo trên thiết bị (bitrate thực phụ thuộc máy và mã hóa của expo-camera): cần
 * đo rồi chỉnh. Chỉ dùng để quy đổi ngưỡng, không hiển thị cho người dùng.
 */
export const ESTIMATED_BYTES_PER_MINUTE = 60 * 1024 * 1024;

export function requiredFreeBytes(policy: RecordingPolicy = DEFAULT_RECORDING_POLICY): number {
  return Math.max(0, policy.maxRecordMinutes) * ESTIMATED_BYTES_PER_MINUTE;
}

/** Số giây tối đa một lần quay theo chính sách. */
export function maxRecordSeconds(policy: RecordingPolicy = DEFAULT_RECORDING_POLICY): number {
  return Math.max(0, policy.maxRecordMinutes) * 60;
}

/** Báo "sắp tự dừng" khi còn chừng này giây (người dùng kịp kết thúc gọn). */
export const WARN_BEFORE_LIMIT_SECONDS = 60;

/** Dung lượng trống tối thiểu để bắt đầu quay theo chính sách mặc định (đủ quay trọn 10 phút). */
export const MIN_FREE_BYTES_TO_RECORD = requiredFreeBytes();

/**
 * Mức pin tối thiểu khi KHÔNG cắm sạc (A04: kiểm tra điều kiện có thể làm video không lưu được; người
 * dùng đồng ý chặn). GIÁ TRỊ TẠM 10%, cần thử trên máy thật.
 */
export const MIN_BATTERY_LEVEL = 0.1;
