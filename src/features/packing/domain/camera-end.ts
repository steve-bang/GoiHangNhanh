/** Sai lệch cho phép khi camera tự dừng đúng hạn (đồng hồ camera và JS lệch nhau chút ít). */
export const LIMIT_TOLERANCE_MS = 3000;

/**
 * Vì sao camera trả kết quả (V1-11):
 * - `requested`: app/người dùng đã yêu cầu dừng (bấm Dừng, rời màn, hết giờ theo bộ đếm của app, vào nền).
 * - `limit`: camera tự dừng đúng giới hạn thời lượng (`maxDuration`), trong sai lệch `LIMIT_TOLERANCE_MS`.
 * - `early`: camera tự dừng SỚM mà không ai yêu cầu (hệ điều hành ngắt camera: cuộc gọi, app khác chiếm
 *   camera, hết chỗ...). Video có thể thiếu phần sau: phiên phải được đánh dấu gián đoạn, không coi là đủ.
 */
export type CameraEnd = 'requested' | 'limit' | 'early';

export function classifyCameraEnd(input: {
  readonly stopRequested: boolean;
  /** Thời gian từ lúc gọi lệnh ghi tới lúc camera trả kết quả (đồng hồ đơn điệu). */
  readonly elapsedMs: number;
  readonly limitSeconds: number;
}): CameraEnd {
  if (input.stopRequested) return 'requested';
  if (input.elapsedMs >= input.limitSeconds * 1000 - LIMIT_TOLERANCE_MS) return 'limit';
  return 'early';
}
