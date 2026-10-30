/**
 * Trần dung lượng mỗi tệp bằng chứng (Q-24c, thống nhất Q-28b). PHẢI khớp `withinEvidenceLimits` của
 * `firebase/firestore.rules` và `firebase/functions/src/limits.ts`: tệp vượt trần thì máy chủ luôn từ
 * chối, nên hàng đợi báo "cần xử lý" ngay thay vì thử lại vô ích (V1-04).
 */
export const PHOTO_MAX_BYTES = 25_000_000;
export const VIDEO_MAX_BYTES = 2_000_000_000;

export function evidenceMaxBytes(kind: 'video' | 'photo'): number {
  return kind === 'photo' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
}

/** Mã lỗi nội bộ của hàng đợi (đề xuất BA, chưa vào `codes.ts`; decisions.md Q-29 / V1-04). */
export const UPLOAD_FILE_TOO_LARGE = 'UPLOAD_FILE_TOO_LARGE';
