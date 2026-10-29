import type { ReturnCaseId, ShopId } from '@/core/ids';
import { FILE_STATES, transition, type FileEvent, type FileState } from '@/features/evidence';

/**
 * Ảnh/video của MỘT hồ sơ hàng hoàn (R2). Tách khỏi `evidence_files` vì bảng đó bắt buộc đơn + kiện +
 * phiên đóng gói, còn hồ sơ hoàn có thể chưa liên kết đơn (Q-26). Dùng CHUNG máy trạng thái tệp
 * (`transition`): `state` là trạng thái TỆP, tách khỏi trạng thái hồ sơ (bất biến 3). Bản ghi được tạo
 * TRƯỚC khi chụp (bất biến 2). R2a chỉ có ảnh; hàng đợi tải lên chưa phục vụ bảng này nên tệp dừng ở
 * `queued` ("đã lưu trên máy"), chưa bao giờ tới `uploaded`/`verified` (chỉ sự kiện `origin: 'server'`).
 */
export interface ReturnMedia {
  readonly id: string;
  readonly shopId: ShopId;
  readonly returnId: ReturnCaseId;
  readonly kind: 'photo';
  readonly state: FileState;
  /** Đường dẫn tương đối của tệp bền (xem `platform/recording-files.ts`); `null` khi chưa đóng tệp. */
  readonly localPath: string | null;
  readonly sizeBytes: number | null;
  /** SHA-256 do thiết bị tính; chỉ chứng minh tệp không đổi kể từ lúc tính (CLAUDE.md #11). */
  readonly sha256Client: string | null;
  readonly createdAtDevice: number;
  readonly updatedAtDevice: number;
  readonly createdBy?: string;
}

export interface NewReturnMedia {
  readonly id: string;
  readonly shopId: ShopId;
  readonly returnId: ReturnCaseId;
  readonly kind: 'photo';
  readonly atDevice: number;
}

export interface ReturnMediaPatch {
  readonly localPath?: string;
  readonly sizeBytes?: number;
  readonly sha256Client?: string;
}

export type MediaEventError =
  | 'ILLEGAL_TRANSITION'
  | 'ORIGIN_NOT_ALLOWED'
  | 'MISSING_FILE_DETAILS'
  | 'IMMUTABLE_FIELD'
  | 'MEDIA_NOT_FOUND';

export type MediaEventResult =
  | { readonly ok: true; readonly media: ReturnMedia }
  | { readonly ok: false; readonly error: MediaEventError };

/**
 * Áp một sự kiện lên bản ghi (thuần, không I/O), dùng chung cho kho bộ nhớ và SQLite. Bản gốc bất biến
 * (bất biến 4): mã băm và kích thước chỉ đặt MỘT lần; vị trí chỉ đổi khi tệp chưa đóng (chưa có mã băm).
 * Vào `queued` bắt buộc đủ đường dẫn, kích thước > 0 và mã băm.
 */
export function applyMediaEvent(
  media: ReturnMedia,
  event: FileEvent,
  atDevice: number,
  patch: ReturnMediaPatch = {},
): MediaEventResult {
  const result = transition(media.state, event);
  if (!result.ok) return { ok: false, error: result.error };
  const frozen =
    (patch.sha256Client !== undefined &&
      media.sha256Client !== null &&
      patch.sha256Client !== media.sha256Client) ||
    (patch.sizeBytes !== undefined &&
      media.sizeBytes !== null &&
      patch.sizeBytes !== media.sizeBytes) ||
    (patch.localPath !== undefined &&
      media.localPath !== null &&
      patch.localPath !== media.localPath &&
      media.sha256Client !== null);
  if (frozen) return { ok: false, error: 'IMMUTABLE_FIELD' };
  const next: ReturnMedia = {
    ...media,
    state: result.state,
    localPath: patch.localPath ?? media.localPath,
    sizeBytes: patch.sizeBytes ?? media.sizeBytes,
    sha256Client: patch.sha256Client ?? media.sha256Client,
    updatedAtDevice: atDevice,
  };
  if (
    result.state === FILE_STATES.QUEUED &&
    (!next.localPath || next.sizeBytes === null || next.sizeBytes <= 0 || !next.sha256Client)
  ) {
    return { ok: false, error: 'MISSING_FILE_DETAILS' };
  }
  return { ok: true, media: next };
}

/** Số ảnh tối đa cho một hồ sơ hàng hoàn (R2a): đủ các góc cần thiết, tránh đầy bộ nhớ vì ảnh thừa. */
export const MAX_RETURN_PHOTOS = 5;

/**
 * Ảnh đã nằm bền trên máy (tệp đóng, có mã băm): từ `queued` trở đi. Ảnh còn `recording`/`saving_local`,
 * hoặc lưu lỗi/không khôi phục được thì KHÔNG tính là "đã có ảnh" và không chiếm chỗ trong giới hạn.
 */
export function isMediaSavedLocally(media: Pick<ReturnMedia, 'state'>): boolean {
  return (
    media.state !== FILE_STATES.RECORDING &&
    media.state !== FILE_STATES.SAVING_LOCAL &&
    media.state !== FILE_STATES.LOCAL_SAVE_FAILED &&
    media.state !== FILE_STATES.UNRECOVERABLE
  );
}
