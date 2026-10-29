import { isAppError } from '@/core/errors/app-error';
import type { ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';

import type { ReturnStore } from './return-store';

export type RemoveFileOutcome = { readonly ok: true } | { readonly ok: false };

export interface PhotoDeletePorts {
  readonly store: Pick<ReturnStore, 'deleteMedia'>;
  /** Xóa tệp bền; tệp không còn thì `ok`. Không ném lỗi (xem `platform/recording-files.ts`). */
  removeFile(localPath: string): RemoveFileOutcome;
  /** Giờ THIẾT BỊ (ms). */
  now(): number;
  newId(): string;
}

export type PhotoDeleteFailure =
  | 'ALREADY_CONFIRMED'
  /** Ảnh đang nằm trong hồ sơ tranh chấp hoặc đã lên máy chủ (bất biến 9). */
  | 'IN_USE'
  /** Không xóa được dòng/lịch sử: dữ liệu và tệp giữ nguyên, thử lại được. */
  | 'RECORD_DELETE_FAILED'
  | 'NOT_FOUND';

export type PhotoDeleteOutcome =
  | { readonly kind: 'deleted'; readonly mediaId: string }
  | { readonly kind: 'failed'; readonly reason: PhotoDeleteFailure };

/**
 * NGOẠI LỆ CÓ CHỦ ĐÍCH so với bất biến 4 (Q-26j, người dùng đã duyệt): xóa THẬT một ảnh hàng hoàn chụp
 * nhầm. Trình tự: (1) `deleteMedia` kiểm LẠI điều kiện (hồ sơ chưa xác nhận, ảnh chưa trong tranh chấp,
 * chưa lên máy chủ), xóa dòng và ghi sự kiện `photo_deleted` (chỉ giờ + uid) trong MỘT giao dịch; bị từ
 * chối hay lỗi thì tệp còn nguyên; (2) chỉ SAU khi dòng đã xóa mới xóa tệp vật lý. Nhờ vậy trạng thái đổi
 * giữa chừng (đang tải lên, vừa vào tranh chấp) không bao giờ để lại bản ghi mất tệp. Xóa tệp lỗi ở bước
 * (2) chỉ để lại tệp mồ côi (không dòng nào tham chiếu): vẫn báo thành công, ghi log không PII. Không bao
 * giờ ném lỗi.
 */
export async function deletePhoto(
  ports: PhotoDeletePorts,
  target: { readonly shopId: ShopId; readonly mediaId: string },
): Promise<PhotoDeleteOutcome> {
  const { store, removeFile, now, newId } = ports;
  const { shopId, mediaId } = target;
  const failed = (reason: PhotoDeleteFailure): PhotoDeleteOutcome => ({ kind: 'failed', reason });

  let localPath: string | null;
  try {
    const result = await store.deleteMedia(shopId, mediaId, now(), newId());
    if (!result.ok) return failed('NOT_FOUND');
    localPath = result.media.localPath;
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === 'RETURN_ALREADY_CONFIRMED') return failed('ALREADY_CONFIRMED');
      if (error.code === 'RETURN_PHOTO_IN_USE') return failed('IN_USE');
    }
    return failed('RECORD_DELETE_FAILED');
  }

  if (localPath !== null) {
    let removed: RemoveFileOutcome;
    try {
      removed = removeFile(localPath);
    } catch {
      removed = { ok: false };
    }
    if (!removed.ok) logger.warn('returns.photo_delete.orphan_file', { kind: 'photo' });
  }
  return { kind: 'deleted', mediaId };
}
