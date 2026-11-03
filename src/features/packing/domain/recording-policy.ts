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
 * Chính sách đang áp dụng: NGUỒN DUY NHẤT cho UI-C02 (`runPrecheck`) và màn quay (giới hạn giờ + ngưỡng
 * dung lượng của lưới an toàn trong `startRecording`). Khi có dữ liệu gói, chỉ đổi ở đây.
 */
export const ACTIVE_RECORDING_POLICY: RecordingPolicy = DEFAULT_RECORDING_POLICY;

/**
 * Thông số quay tường minh, giống nhau trên iOS và Android (V1-22, Q-30a/b người dùng đã chốt): 1080p30,
 * H.264 (`avc1`), khoảng 6 Mbps. Hằng thuần (domain không import SDK); `platform/camera-recorder` nhận nó
 * qua prop `profile` và áp vào `CameraView` (`videoQuality`, `videoBitrate`) và `recordAsync` (`codec`,
 * `maxFileSize`). Chưa kiểm chứng trên thiết bị: cần đo ở G-14 (bytes/phút cảnh tĩnh và động, nhãn vận
 * đơn còn đọc được).
 */
export interface VideoProfile {
  readonly quality: '1080p';
  /** Bitrate mục tiêu (bit/giây). Bộ mã hóa có thể vượt 20-30% khi cảnh động (xem `HEADROOM`). */
  readonly bitrateBps: number;
  /** H.264 cho cả hai nền tảng. iOS BẮT BUỘC truyền codec thì `videoBitrate` mới có tác dụng; Android bỏ qua. */
  readonly codec: 'avc1';
  /**
   * Lưới cứng chống tệp quá trần tải lên (2.000.000.000 byte, `VIDEO_MAX_BYTES` của `features/upload`):
   * camera tự dừng và trả tệp hợp lệ khi chạm trần. Chừa ~5% cho khối container. Test đối chiếu hai hằng.
   */
  readonly maxFileBytes: number;
}

export const VIDEO_PROFILE: VideoProfile = {
  quality: '1080p',
  bitrateBps: 6_000_000,
  codec: 'avc1',
  maxFileBytes: 1_900_000_000,
};

/** Bộ mã hóa vượt bitrate mục tiêu 20-30% khi cảnh động: ước lượng dung lượng cộng thêm 30%. */
export const BITRATE_HEADROOM = 1.3;

/**
 * Ước lượng dung lượng một phút video (byte, thập phân) SUY RA từ bitrate đã đặt cộng headroom: với 6 Mbps
 * là khoảng 58,5 MB/phút (45 MB/phút danh nghĩa). Giá trị ước lượng chưa đo trên thiết bị (G-14): cần so
 * với bytes/phút đo được ở cảnh động rồi chỉnh. Chỉ dùng để quy đổi ngưỡng, không hiển thị cho người dùng.
 */
export const ESTIMATED_BYTES_PER_MINUTE = Math.ceil(
  (VIDEO_PROFILE.bitrateBps / 8) * 60 * BITRATE_HEADROOM,
);

export function requiredFreeBytes(policy: RecordingPolicy = DEFAULT_RECORDING_POLICY): number {
  return Math.max(0, policy.maxRecordMinutes) * ESTIMATED_BYTES_PER_MINUTE;
}

/** Số giây tối đa một lần quay theo chính sách. */
export function maxRecordSeconds(policy: RecordingPolicy = DEFAULT_RECORDING_POLICY): number {
  return Math.max(0, policy.maxRecordMinutes) * 60;
}

/** Báo "sắp tự dừng" khi còn chừng này giây (người dùng kịp kết thúc gọn). */
export const WARN_BEFORE_LIMIT_SECONDS = 60;

/**
 * Dung lượng trống tối thiểu theo chính sách MẶC ĐỊNH (đủ quay trọn 10 phút). Chỉ là giá trị mặc định
 * của `startRecording` khi không truyền `RecordingPorts.minFreeBytes`; màn quay truyền ngưỡng theo
 * `ACTIVE_RECORDING_POLICY` (cùng nguồn với UI-C02).
 */
export const MIN_FREE_BYTES_TO_RECORD = requiredFreeBytes();

/**
 * Mức pin tối thiểu khi KHÔNG cắm sạc (A04: kiểm tra điều kiện có thể làm video không lưu được; người
 * dùng đồng ý chặn). GIÁ TRỊ TẠM 10%, cần thử trên máy thật.
 */
export const MIN_BATTERY_LEVEL = 0.1;

/**
 * Khoảng giữa hai nhịp tim khi đang quay (ms; G-4): ghi `lastAliveAtDevice` để sau khi app bị kill biết app
 * sống đến lúc nào. GIÁ TRỊ TẠM 5 giây, cần đo tải ghi/pin trên máy thật.
 */
export const HEARTBEAT_INTERVAL_MS = 5000;
