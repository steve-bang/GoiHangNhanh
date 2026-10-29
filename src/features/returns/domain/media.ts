import { AppError } from '@/core/errors/app-error';
import type { ReturnCaseId, ShopId } from '@/core/ids';
import {
  FILE_STATES,
  mayHaveReachedServer,
  transition,
  type FileEvent,
  type FileState,
} from '@/features/evidence';

/**
 * Ảnh/video của MỘT hồ sơ hàng hoàn (R2). Tách khỏi `evidence_files` vì bảng đó bắt buộc đơn + kiện +
 * phiên đóng gói, còn hồ sơ hoàn có thể chưa liên kết đơn (Q-26). Dùng CHUNG máy trạng thái tệp
 * (`transition`): `state` là trạng thái TỆP, tách khỏi trạng thái hồ sơ (bất biến 3). Bản ghi được tạo
 * TRƯỚC khi chụp (bất biến 2). Hàng đợi tải lên (`features/upload`, Q-28) đưa tệp từ `queued` đi tiếp;
 * `uploaded`/`verified` chỉ tới bằng sự kiện `origin: 'server'` (client không tự quyết).
 */
export const LOCATION_STATUSES = ['ok', 'denied', 'unavailable', 'timeout', 'off'] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

/**
 * Vị trí thiết bị lúc chụp (Q-26k), ghi MỘT lần sau khi tệp đã đóng, bất biến như mã băm. Là số đọc của
 * máy, KHÔNG chứng minh nơi chụp thật (CLAUDE.md #11). `status !== 'ok'` thì không có tọa độ và
 * `status` là lý do không lấy được.
 */
export interface MediaLocation {
  readonly status: LocationStatus;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly accuracyM: number | null;
  /** Giờ THIẾT BỊ (ms) lúc nhận vị trí. */
  readonly atDevice: number | null;
}

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
  /** `null` = chưa ghi vị trí (ảnh cũ, hoặc app bị kill trước khi ghi). */
  readonly location: MediaLocation | null;
  /** Số lần đã thử tải lên (hàng đợi; bền qua lần mở lại app). */
  readonly attemptCount: number;
  /** Thời điểm THIẾT BỊ sớm nhất được thử tải lại; `null` = không chờ. */
  readonly nextAttemptAtDevice: number | null;
  /** Mã lỗi gần nhất của lần tải lên (mã nghiệp vụ, không chứa đường dẫn/PII). */
  readonly lastErrorCode: string | null;
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
  readonly attemptCount?: number;
  /** `null` xóa thời điểm chờ. */
  readonly nextAttemptAtDevice?: number | null;
  /** `null` xóa mã lỗi. */
  readonly lastErrorCode?: string | null;
}

export type MediaEventError =
  | 'ILLEGAL_TRANSITION'
  | 'ORIGIN_NOT_ALLOWED'
  | 'MISSING_FILE_DETAILS'
  | 'IMMUTABLE_FIELD'
  | 'MEDIA_NOT_FOUND'
  | 'INVALID_LOCATION';

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
    attemptCount: patch.attemptCount ?? media.attemptCount,
    nextAttemptAtDevice:
      patch.nextAttemptAtDevice === undefined
        ? media.nextAttemptAtDevice
        : patch.nextAttemptAtDevice,
    lastErrorCode: patch.lastErrorCode === undefined ? media.lastErrorCode : patch.lastErrorCode,
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

/**
 * Ghi vị trí MỘT lần (thuần, không I/O). Chỉ khi tệp đã đóng và lưu bền (như mã băm); đã có vị trí thì
 * `IMMUTABLE_FIELD` (không ghi đè). `ok` bắt buộc có tọa độ hợp lệ; trạng thái khác thì bỏ tọa độ.
 */
export function applyMediaLocation(media: ReturnMedia, location: MediaLocation): MediaEventResult {
  if (!isMediaSavedLocally(media)) return { ok: false, error: 'ILLEGAL_TRANSITION' };
  if (media.location !== null) return { ok: false, error: 'IMMUTABLE_FIELD' };
  if (location.status !== 'ok') {
    return {
      ok: true,
      media: {
        ...media,
        location: {
          status: location.status,
          lat: null,
          lng: null,
          accuracyM: null,
          atDevice: null,
        },
      },
    };
  }
  const { lat, lng, accuracyM } = location;
  const valid =
    lat !== null &&
    lng !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    (accuracyM === null || (Number.isFinite(accuracyM) && accuracyM >= 0)) &&
    location.atDevice !== null;
  if (!valid) return { ok: false, error: 'INVALID_LOCATION' };
  return { ok: true, media: { ...media, location: { ...location } } };
}

/** Cách nói về vị trí của ảnh trên UI. KHÔNG trả tọa độ thô; không bao giờ nói "đã xác thực". */
export type LocationDisplay =
  | { readonly kind: 'has'; readonly accuracyM: number | null }
  | { readonly kind: 'none'; readonly reason: Exclude<LocationStatus, 'ok'> | 'unknown' };

export function describeLocation(media: Pick<ReturnMedia, 'location'>): LocationDisplay {
  const location = media.location;
  if (location === null) return { kind: 'none', reason: 'unknown' };
  if (location.status === 'ok') {
    return {
      kind: 'has',
      accuracyM: location.accuracyM === null ? null : Math.round(location.accuracyM),
    };
  }
  return { kind: 'none', reason: location.status };
}

/**
 * NGOẠI LỆ CÓ CHỦ ĐÍCH so với bất biến 4 (Q-26j): xóa ảnh hàng hoàn chụp nhầm. Chỉ khi (1) hồ sơ chưa
 * `confirmed`, (2) ảnh chưa nằm trong bất kỳ hồ sơ tranh chấp nào (bất biến 9), (3) ảnh CHƯA TỪNG được
 * đưa cho máy chủ (`mayHaveReachedServer`, Q-28): đang/đã tải, tải lỗi, cần xử lý do máy chủ, hoặc đã có
 * lần thử tải (`attemptCount > 0`) đều KHÔNG xóa được, vì máy chủ có thể đã nhận một phần hoặc đã nhận đủ
 * mà app mất phản hồi. Không áp dụng cho video đóng gói hay bằng chứng khác. Thuần, dùng chung cho hai
 * kho; ném `AppError`: `RETURN_ALREADY_CONFIRMED` / `RETURN_PHOTO_IN_USE`.
 */
export function assertMediaDeletable(input: {
  readonly returnConfirmed: boolean;
  readonly media: Pick<ReturnMedia, 'state' | 'attemptCount' | 'lastErrorCode'>;
  readonly inDispute: boolean;
}): void {
  if (input.returnConfirmed) throw new AppError('RETURN_ALREADY_CONFIRMED');
  if (input.inDispute) throw new AppError('RETURN_PHOTO_IN_USE', { reason: 'dispute' });
  if (mayHaveReachedServer(input.media)) {
    throw new AppError('RETURN_PHOTO_IN_USE', { reason: 'uploaded' });
  }
}

/** Tiến trình đồng bộ của các media đã lưu bền (không tính ảnh đang ghi/lưu lỗi). */
export interface MediaSyncSummary {
  /** Máy chủ đã tính lại mã băm và khớp. */
  readonly verified: number;
  /** Máy chủ đã nhận đủ, CHƯA xác minh mã băm. */
  readonly uploaded: number;
  readonly uploading: number;
  /** Mới lưu trên máy, chưa từng thử tải. */
  readonly onDevice: number;
  /** Tải chưa được (lỗi tạm hoặc đang chờ thử lại); hàng đợi sẽ tự thử lại khi app mở. */
  readonly retrying: number;
  /** Cần người dùng xử lý (máy chủ từ chối, tệp đổi/mất) hoặc mã băm máy chủ không khớp. */
  readonly attention: number;
}

/**
 * Đếm media đã lưu bền theo tiến trình đồng bộ, để UI nói ĐÚNG điều đã xảy ra (CLAUDE.md #3, #11):
 * chỉ `verified` mới được gọi là máy chủ đã xác minh; `uploaded` là đã nhận nhưng chưa xác minh.
 */
export function summarizeMediaSync(media: readonly Pick<ReturnMedia, 'state'>[]): MediaSyncSummary {
  const out = { verified: 0, uploaded: 0, uploading: 0, onDevice: 0, retrying: 0, attention: 0 };
  for (const m of media) {
    switch (m.state) {
      case FILE_STATES.VERIFIED:
        out.verified += 1;
        break;
      case FILE_STATES.UPLOADED:
        out.uploaded += 1;
        break;
      case FILE_STATES.UPLOADING:
        out.uploading += 1;
        break;
      case FILE_STATES.QUEUED:
        out.onDevice += 1;
        break;
      case FILE_STATES.UPLOAD_FAILED:
        out.retrying += 1;
        break;
      case FILE_STATES.NEEDS_ATTENTION:
      case FILE_STATES.HASH_MISMATCH:
        out.attention += 1;
        break;
      default:
        break; // chưa lưu bền hoặc mất hẳn: không tính vào tiến trình đồng bộ
    }
  }
  return out;
}

/** `ok: true` trả bản ghi vừa bị xóa (để bên gọi biết đường dẫn tệp). */
export type DeleteMediaResult =
  | { readonly ok: true; readonly media: ReturnMedia }
  | { readonly ok: false; readonly error: 'MEDIA_NOT_FOUND' };
