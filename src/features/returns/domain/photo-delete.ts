import { isAppError } from '@/core/errors/app-error';
import type { ShopId } from '@/core/ids';

import type { ReturnStore } from './return-store';

export type RemoveFileOutcome = { readonly ok: true } | { readonly ok: false };

export interface PhotoDeletePorts {
  readonly store: Pick<ReturnStore, 'checkMediaDeletable' | 'deleteMedia'>;
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
  /** Không xóa được tệp: dữ liệu giữ nguyên. */
  | 'FILE_DELETE_FAILED'
  /** Đã xóa tệp nhưng chưa ghi được lịch sử/xóa dòng: thử lại được (xóa lặp lại an toàn). */
  | 'RECORD_DELETE_FAILED'
  | 'NOT_FOUND';

export type PhotoDeleteOutcome =
  | { readonly kind: 'deleted'; readonly mediaId: string }
  | { readonly kind: 'failed'; readonly reason: PhotoDeleteFailure };

/**
 * NGOẠI LỆ CÓ CHỦ ĐÍCH so với bất biến 4 (Q-26j, người dùng đã duyệt): xóa THẬT một ảnh hàng hoàn chụp
 * nhầm. Trình tự: (1) kiểm điều kiện (hồ sơ chưa xác nhận, ảnh chưa trong tranh chấp, chưa lên máy chủ);
 * (2) xóa tệp, lỗi thì DỪNG và KHÔNG đụng dữ liệu; (3) xóa dòng + ghi sự kiện lịch sử `photo_deleted`
 * (chỉ giờ + uid) trong một giao dịch. Không bao giờ ném lỗi. Xóa lại sau lỗi bước 3 an toàn vì tệp không
 * còn thì bước 2 vẫn `ok`.
 */
export async function deletePhoto(
  ports: PhotoDeletePorts,
  target: { readonly shopId: ShopId; readonly mediaId: string },
): Promise<PhotoDeleteOutcome> {
  const { store, removeFile, now, newId } = ports;
  const { shopId, mediaId } = target;
  const failed = (reason: PhotoDeleteFailure): PhotoDeleteOutcome => ({ kind: 'failed', reason });
  const classify = (error: unknown): PhotoDeleteFailure => {
    if (isAppError(error)) {
      if (error.code === 'RETURN_ALREADY_CONFIRMED') return 'ALREADY_CONFIRMED';
      if (error.code === 'RETURN_PHOTO_IN_USE') return 'IN_USE';
    }
    return 'RECORD_DELETE_FAILED';
  };

  let localPath: string | null;
  try {
    const checked = await store.checkMediaDeletable(shopId, mediaId);
    if (!checked.ok) return failed('NOT_FOUND');
    localPath = checked.media.localPath;
  } catch (error) {
    const reason = classify(error);
    return failed(reason === 'RECORD_DELETE_FAILED' ? 'FILE_DELETE_FAILED' : reason);
  }

  if (localPath !== null) {
    let removed: RemoveFileOutcome;
    try {
      removed = removeFile(localPath);
    } catch {
      removed = { ok: false };
    }
    if (!removed.ok) return failed('FILE_DELETE_FAILED');
  }

  try {
    const result = await store.deleteMedia(shopId, mediaId, now(), newId());
    return result.ok ? { kind: 'deleted', mediaId } : failed('NOT_FOUND');
  } catch (error) {
    return failed(classify(error));
  }
}
