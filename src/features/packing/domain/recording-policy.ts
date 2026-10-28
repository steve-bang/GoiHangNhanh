/**
 * Chính sách điều kiện quay (O-05, người dùng chốt): MẶC ĐỊNH chặn khi chỗ trống không đủ để quay ít nhất
 * 10 phút. Về sau thời lượng tối thiểu này sẽ theo GÓI của người dùng (docs/06); hôm nay chưa có dữ liệu
 * gói nên dùng mặc định cho mọi người. Nơi duy nhất cần đổi khi có gói: cung cấp `RecordingPolicy` khác cho
 * `runPrecheck` và `startRecording`.
 */
export interface RecordingPolicy {
  /** Số phút quay tối thiểu mà chỗ trống phải chứa được. */
  readonly minRecordMinutes: number;
}

export const DEFAULT_RECORDING_POLICY: RecordingPolicy = { minRecordMinutes: 10 };

/**
 * Ước lượng dung lượng một phút video (byte) để đổi "phút" ra "byte": 60 MB/phút (khoảng 8 Mbps, 1080p).
 * GIÁ TRỊ ƯỚC LƯỢNG chưa đo trên thiết bị (bitrate thực phụ thuộc máy và mã hóa của expo-camera): cần
 * đo rồi chỉnh. Chỉ dùng để quy đổi ngưỡng, không hiển thị cho người dùng.
 */
export const ESTIMATED_BYTES_PER_MINUTE = 60 * 1024 * 1024;

export function requiredFreeBytes(policy: RecordingPolicy = DEFAULT_RECORDING_POLICY): number {
  return Math.max(0, policy.minRecordMinutes) * ESTIMATED_BYTES_PER_MINUTE;
}

/** Dung lượng trống tối thiểu để bắt đầu quay theo chính sách mặc định (10 phút). */
export const MIN_FREE_BYTES_TO_RECORD = requiredFreeBytes();

/**
 * Mức pin tối thiểu khi KHÔNG cắm sạc (A04: kiểm tra điều kiện có thể làm video không lưu được; người
 * dùng đồng ý chặn). GIÁ TRỊ TẠM 10%, cần thử trên máy thật.
 */
export const MIN_BATTERY_LEVEL = 0.1;
