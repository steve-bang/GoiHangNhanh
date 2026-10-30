/**
 * Trần dung lượng mỗi tệp bằng chứng (Q-24c, thống nhất Q-28b): áp dụng cho MỌI bằng chứng (đóng gói
 * và hàng hoàn). Phải khớp `withinEvidenceLimits` trong `firebase/firestore.rules`.
 */
export const PHOTO_MAX_BYTES = 25_000_000;
export const VIDEO_MAX_BYTES = 2_000_000_000;

/** Trần theo loại khai báo; loại lạ dùng trần lớn nhất (Rules đã từ chối loại lạ lúc khai báo). */
export function maxBytesFor(kind: unknown): number {
  return kind === 'photo' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
}

/** Kích thước khai báo hợp lệ: số nguyên dương, không vượt trần của loại. */
export function isDeclaredSizeAllowed(kind: unknown, sizeBytes: unknown): boolean {
  return (
    typeof sizeBytes === 'number' &&
    Number.isInteger(sizeBytes) &&
    sizeBytes > 0 &&
    sizeBytes <= maxBytesFor(kind)
  );
}

/**
 * Tuổi tối đa của sự kiện trigger còn được xử lý (Function chạy với `retry: true`). Quá trần thì ghi
 * nhận rồi dừng, không thử lại vô hạn khi lỗi kéo dài.
 */
export const MAX_EVENT_AGE_MS = 6 * 60 * 60_000;

/** `true` khi sự kiện quá tuổi; thời gian sự kiện không đọc được thì coi là còn hạn (không bỏ sót). */
export function isEventTooOld(eventTime: string | undefined, nowMs: number): boolean {
  if (!eventTime) return false;
  const at = Date.parse(eventTime);
  return Number.isFinite(at) && nowMs - at > MAX_EVENT_AGE_MS;
}
