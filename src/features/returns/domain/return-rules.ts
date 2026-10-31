import { AppError } from '@/core/errors/app-error';

import type { OpeningVideo, ReturnStatus } from './types';

/** Mã hiển thị của hồ sơ: RH-00001 (số thứ tự theo shop). Không phải ID. */
export function formatReturnCode(seq: number): string {
  return `RH-${String(seq).padStart(5, '0')}`;
}

/** Hồ sơ đã xác nhận không sửa được nữa (chỉ liên kết đơn gốc sau, có lịch sử; bất biến 7). */
export function assertEditable(status: ReturnStatus): void {
  if (status === 'confirmed') throw new AppError('RETURN_ALREADY_CONFIRMED');
}

/** Lưu tình trạng bên ngoài: `receiving` -> `opening`, các trạng thái sau giữ nguyên. */
export function statusAfterExterior(status: ReturnStatus): ReturnStatus {
  assertEditable(status);
  return status === 'receiving' ? 'opening' : status;
}

/** Ghi nhận không có video mở kiện: chỉ từ `opening`/`checking` (không nhảy cóc), sang `checking`. */
export function statusAfterVideoStep(status: ReturnStatus): ReturnStatus {
  assertEditable(status);
  if (status === 'receiving') throw new AppError('RETURN_SAVE_FAILED', { reason: 'step_order' });
  return 'checking';
}

/** Lưu kiểm kê: như bước video (cần đã ghi tình trạng bên ngoài). */
export const statusAfterLines = statusAfterVideoStep;

/** Xác nhận: chỉ từ `checking` và có ít nhất một dòng kiểm kê. */
export function assertCanConfirm(status: ReturnStatus, lineCount: number): void {
  assertEditable(status);
  if (status !== 'checking' || lineCount < 1) {
    throw new AppError('RETURN_SAVE_FAILED', { reason: 'not_ready_to_confirm' });
  }
}

/**
 * Ghi nhận video mở kiện đã quay: chỉ khi hồ sơ CHƯA có kết luận về video (`openingVideo === null`) hoặc
 * ghi lại đúng video đã có (idempotent). Trả `'same'` nếu đã ghi đúng video này (không đổi gì), `'new'`
 * nếu cần ghi. Đã có video khác hoặc đã ghi "không có video" thì ném lỗi: không thay thế (bất biến 4, 6, 7).
 */
export function checkOpeningVideoRecordable(
  current: OpeningVideo,
  mediaId: string,
): 'new' | 'same' {
  if (current === null) return 'new';
  if (current.kind === 'recorded' && current.mediaId === mediaId) return 'same';
  throw new AppError('RETURN_SAVE_FAILED', { reason: 'video_already_set' });
}

/** Ghi "không có video" khi đã có video quay xong thì từ chối: không xóa dấu vết video đã quay. */
export function assertNoRecordedVideo(current: OpeningVideo): void {
  if (current?.kind === 'recorded') {
    throw new AppError('RETURN_SAVE_FAILED', { reason: 'video_already_set' });
  }
}
