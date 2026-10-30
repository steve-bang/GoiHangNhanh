import type { ShopId } from '@/core/ids';
import type { EvidenceStatusLabel } from '@/core/theme';
import {
  FILE_STATES,
  foreignUploadNote,
  isUserRetryableAttention,
  toDisplayStatus,
  type FileEvent,
  type FileState,
  type UploaderRelation,
} from '@/features/evidence';

import { ambiguousStreakOf, NETWORK_ERROR_CODES } from './upload-queue';
import type { ReturnStatus } from '@/features/returns';

import type { UploadItemPatch } from './ports';

/**
 * Trung tâm đồng bộ (UI-F01/F02, V1-08): mô tả MỘT tệp bằng chứng trên máy theo trạng thái TỆP thật
 * (bất biến 3). Hàm thuần: không I/O, không đồng hồ (giờ truyền vào). Nhãn đi qua `toDisplayStatus`
 * (docs/09 mục 3); "Đã tải lên"/"Đã xác minh" chỉ khi trạng thái tệp là `uploaded`/`verified` (do máy chủ
 * xác lập). Không thêm nhãn thứ 7: "đang chờ mạng", "tài khoản khác"... chỉ là LÝ DO cạnh nhãn.
 */

/** Bốn bộ lọc của UI-F01 (docs/09). */
export type SyncFilter = 'uploading' | 'waiting_upload' | 'error' | 'uploaded';
export const SYNC_FILTERS: readonly SyncFilter[] = [
  'uploading',
  'waiting_upload',
  'error',
  'uploaded',
];

/** Hồ sơ chứa tệp: đơn + kiện (đóng gói) hoặc hồ sơ hàng hoàn. `null` = không đọc được trên máy. */
export type SyncRecord =
  | {
      readonly kind: 'pack';
      readonly orderId: string;
      readonly orderCode: string | null;
      readonly packageIndex: number | null;
    }
  | {
      readonly kind: 'return';
      readonly returnId: string;
      readonly caseCode: string | null;
      /** Trạng thái hồ sơ (để mở đúng màn); `null` = không đọc được. */
      readonly caseStatus: ReturnStatus | null;
    };

export interface SyncJob {
  /** Khóa duy nhất trên màn (`pack:<id>` / `return:<id>`), dùng làm tham số route UI-F02. */
  readonly key: string;
  readonly id: string;
  readonly shopId: ShopId;
  readonly kind: 'video' | 'photo';
  readonly state: FileState;
  readonly sizeBytes: number | null;
  readonly attemptCount: number;
  readonly lastErrorCode: string | null;
  /** Giờ THIẾT BỊ lần đổi trạng thái gần nhất (với `uploaded`: lúc máy chủ báo đã nhận). */
  readonly updatedAtDevice: number;
  readonly createdAtDevice: number;
  readonly record: SyncRecord;
  /** Người tạo so với tài khoản đang đăng nhập (V1-07). */
  readonly uploader: UploaderRelation;
}

export const syncJobKey = (source: SyncRecord['kind'], id: string): string => `${source}:${id}`;

/** Tách khóa route; khóa lạ trả `null` (không đoán). */
export function parseSyncJobKey(
  key: string | undefined,
): { readonly source: SyncRecord['kind']; readonly id: string } | null {
  const match = key ? /^(pack|return):(.+)$/.exec(key) : null;
  if (!match) return null;
  return { source: match[1] as SyncRecord['kind'], id: match[2] as string };
}

/** Trạng thái còn việc đồng bộ hoặc lỗi cần biết (không gồm đang ghi/đang lưu: chưa phải việc tải). */
export const PENDING_SYNC_STATES: readonly FileState[] = [
  FILE_STATES.QUEUED,
  FILE_STATES.UPLOADING,
  FILE_STATES.UPLOAD_FAILED,
  FILE_STATES.NEEDS_ATTENTION,
  FILE_STATES.HASH_MISMATCH,
  FILE_STATES.LOCAL_SAVE_FAILED,
  FILE_STATES.UNRECOVERABLE,
];

/** Trạng thái máy chủ đã xác lập (bộ lọc "Đã tải lên"). */
export const DONE_SYNC_STATES: readonly FileState[] = [FILE_STATES.UPLOADED, FILE_STATES.VERIFIED];

/** Bộ lọc "Đã tải lên" chỉ hiện chừng này tệp mới nhất (đọc trên máy, không gọi mạng). */
export const DONE_LIST_LIMIT = 50;

/**
 * Sau chừng này kể từ khi máy chủ báo đã nhận mà chưa xác minh, cho người dùng bấm "Kiểm tra lại". Khớp
 * `REVERIFY_AFTER_MS` của `firebase/functions/src/reverify.ts` (máy chủ chỉ đặt yêu cầu xác minh lại khi
 * đã nhận quá 15 phút); giờ ở đây là giờ thiết bị nên có thể lệch, máy chủ vẫn tự kiểm.
 */
export const RECHECK_AFTER_MS = 15 * 60_000;

/** Lý do hiển thị cạnh nhãn (khóa i18n `screens:sync.reason.<khóa>` hoặc `evidence:uploaderNote.*`). */
export type SyncReason =
  | 'queued'
  | 'offline'
  | 'waitingWifi'
  | 'waitingNetwork'
  | 'willRetry'
  | 'serverRejected'
  | 'signInAgain'
  | 'tooLarge'
  | 'fileChanged'
  | 'fileMissing'
  | 'fileUnreadable'
  | 'unsupportedType'
  | 'unknownAttention'
  | 'hashMismatch'
  | 'localSaveFailed'
  | 'unrecoverable'
  | 'verifying'
  | 'verifyStuck';

/** Hành động người dùng làm được với tệp: thử tải lại, nhờ máy chủ kiểm tra lại, hoặc không gì. */
export type SyncAction = 'retry' | 'recheck' | null;

export interface SyncJobView {
  readonly filter: SyncFilter;
  readonly label: EvidenceStatusLabel;
  /** Có giá trị = tệp do tài khoản khác/không rõ tạo, máy này không tải (nhóm riêng, không nút). */
  readonly foreign: Exclude<UploaderRelation, 'current'> | null;
  readonly reason: SyncReason | null;
  readonly action: SyncAction;
}

const FILTER_OF: Readonly<Record<EvidenceStatusLabel, SyncFilter>> = {
  uploading: 'uploading',
  waiting_upload: 'waiting_upload',
  saved_on_device: 'waiting_upload',
  error: 'error',
  uploaded: 'uploaded',
  verified: 'uploaded',
};

const SIGN_IN_CODES: readonly string[] = ['AUTH_REQUIRED', 'UNAUTHENTICATED'];

const ATTENTION_REASON: Readonly<Record<string, SyncReason>> = {
  UPLOAD_FILE_TOO_LARGE: 'tooLarge',
  LOCAL_HASH_CHANGED: 'fileChanged',
  FILE_MISSING: 'fileMissing',
  FILE_UNREADABLE: 'fileUnreadable',
  UNSUPPORTED_FILE_TYPE: 'unsupportedType',
};

/** Tệp `upload_failed` vì mạng (không tính lượt, Q-24h) hay vì máy chủ từ chối. */
export function failedByNetwork(lastErrorCode: string | null): boolean {
  return (
    lastErrorCode !== null &&
    (NETWORK_ERROR_CODES.includes(lastErrorCode) || ambiguousStreakOf(lastErrorCode) > 0)
  );
}

function attentionReason(code: string | null): SyncReason {
  if (!code) return 'unknownAttention';
  if (SIGN_IN_CODES.includes(code)) return 'signInAgain';
  return ATTENTION_REASON[code] ?? 'serverRejected';
}

/** Ngữ cảnh hiển thị của Trung tâm đồng bộ (giờ truyền vào, không đọc đồng hồ). */
export interface SyncContext {
  readonly online: boolean;
  readonly now: number;
  /**
   * Đã bật "Chỉ tải khi có Wi‑Fi" mà mạng hiện tại không phải Wi‑Fi (V1-09): hàng đợi không chạy, nên tệp
   * còn chờ gửi hiện lý do "Đang chờ Wi‑Fi." (lý do hiển thị, KHÔNG phải trạng thái tệp mới).
   */
  readonly waitingWifi?: boolean;
}

function ownReason(job: SyncJob, context: SyncContext, stuck: boolean): SyncReason | null {
  const { online, waitingWifi = false } = context;
  switch (job.state) {
    case FILE_STATES.QUEUED:
      if (!online) return 'offline';
      return waitingWifi ? 'waitingWifi' : 'queued';
    case FILE_STATES.UPLOADING:
      // Chờ Wi‑Fi thì không có lần gửi nào chạy (tệp `uploading` còn lại từ lần tắt app trước chờ đối
      // soát khi có Wi‑Fi): nói đúng là đang chờ, không để người dùng tưởng đang tải.
      return online && waitingWifi ? 'waitingWifi' : null;
    case FILE_STATES.UPLOAD_FAILED:
      if (!online) return 'offline';
      if (waitingWifi) return 'waitingWifi';
      return failedByNetwork(job.lastErrorCode) ? 'waitingNetwork' : 'willRetry';
    case FILE_STATES.NEEDS_ATTENTION:
      return attentionReason(job.lastErrorCode);
    case FILE_STATES.HASH_MISMATCH:
      return 'hashMismatch';
    case FILE_STATES.LOCAL_SAVE_FAILED:
      return 'localSaveFailed';
    case FILE_STATES.UNRECOVERABLE:
      return 'unrecoverable';
    case FILE_STATES.UPLOADED:
      // Chờ Wi‑Fi thì không đối soát: kết quả xác minh chưa về được tới khi có Wi‑Fi (review PR #57).
      // Chỉ tệp của chính tài khoản (hàng đợi không đối soát tệp của tài khoản khác dù có Wi‑Fi).
      if (online && waitingWifi && job.uploader === 'current') return 'waitingWifi';
      return stuck ? 'verifyStuck' : 'verifying';
    default:
      return null;
  }
}

/**
 * Mô tả một tệp cho UI-F01/F02. `null` khi tệp chưa phải việc đồng bộ (đang ghi/đang lưu trên máy).
 * Hành động chỉ cho tệp của CHÍNH tài khoản (máy này không tải hộ, V1-07):
 * - `retry`: `upload_failed` (mọi lỗi), `needs_attention` với lỗi không phải lỗi tệp cục bộ (R-3).
 * - `recheck`: `uploaded` đã quá `RECHECK_AFTER_MS` mà máy chủ chưa xác minh.
 */
export function describeSyncJob(job: SyncJob, context: SyncContext): SyncJobView | null {
  const display = toDisplayStatus(job.state, {
    uploader: job.uploader,
    ...(job.state === FILE_STATES.QUEUED ? { waitingReason: 'queue' } : {}),
  });
  if (display.kind !== 'label') return null;
  const foreign = foreignUploadNote(job.state, job.uploader);
  const filter = FILTER_OF[display.label];
  if (foreign) {
    return { filter, label: display.label, foreign, reason: null, action: null };
  }
  const own = job.uploader === 'current';
  // Máy chủ chỉ nhận yêu cầu kiểm tra lại từ chính người đã khai báo tệp.
  const stuck =
    own &&
    job.state === FILE_STATES.UPLOADED &&
    context.now - job.updatedAtDevice >= RECHECK_AFTER_MS;
  let action: SyncAction = null;
  if (own && job.state === FILE_STATES.UPLOAD_FAILED) action = 'retry';
  if (
    own &&
    job.state === FILE_STATES.NEEDS_ATTENTION &&
    isUserRetryableAttention(job.lastErrorCode)
  ) {
    action = 'retry';
  }
  if (own && stuck) action = 'recheck';
  return {
    filter,
    label: display.label,
    foreign: null,
    reason: ownReason(job, context, stuck),
    action,
  };
}

/**
 * Sự kiện tệp khi người dùng bấm Thử lại (`origin: 'device'`, chỉ tới `queued`). `needs_attention`: đặt
 * lại số lượt (8 lượt mới) nhưng GIỮ mã lỗi để vẫn biết tệp từng được đưa cho máy chủ
 * (`mayHaveReachedServer`): hàng đợi đối soát trước khi gửi lại, ảnh hàng hoàn không xóa được (Q-26j).
 * Mã mơ hồ có bộ đếm (`INTERNAL@30`) được bỏ hậu tố (`INTERNAL`) để bộ đếm lỗi mơ hồ bắt đầu lại.
 * Trạng thái khác: `null`.
 */
export function userRetryEvent(
  state: FileState,
  lastErrorCode: string | null = null,
): { readonly event: FileEvent; readonly patch: UploadItemPatch } | null {
  if (state === FILE_STATES.UPLOAD_FAILED) {
    return {
      event: { type: 'RETRY_UPLOAD', origin: 'device' },
      patch: { nextAttemptAtDevice: null },
    };
  }
  if (state === FILE_STATES.NEEDS_ATTENTION) {
    const base = lastErrorCode?.replace(/@\d+$/, '') ?? null;
    return {
      event: { type: 'USER_RETRY_ATTENTION', origin: 'device' },
      patch: {
        attemptCount: 0,
        nextAttemptAtDevice: null,
        ...(base !== null && base !== lastErrorCode ? { lastErrorCode: base } : {}),
      },
    };
  }
  return null;
}

/** Lỗi cuối không thử lại được bởi bất kỳ ai (không phải chuyện "ai tải lên"). */
const FINAL_ERROR_STATES: readonly FileState[] = [
  FILE_STATES.HASH_MISMATCH,
  FILE_STATES.LOCAL_SAVE_FAILED,
  FILE_STATES.UNRECOVERABLE,
];

/**
 * Tệp do tài khoản khác/không rõ tạo (theo `job.uploader`, không theo trạng thái) ở các bộ lọc chưa xong:
 * hiện trong nhóm "Do tài khoản khác tạo trên máy này", không bao giờ có nút (review PR #56).
 */
export function inForeignGroup(job: SyncJob, view: SyncJobView): boolean {
  return job.uploader !== 'current' && view.filter !== 'uploaded';
}

/**
 * Câu giải thích khi KHÔNG có nút ở UI-F02: tệp của tài khoản khác còn chờ máy chủ -> chỉ người tạo tải
 * được (không nói "ứng dụng không thử lại được"); lỗi khác -> không thử lại được; còn lại không cần câu.
 */
export function noActionNote(job: SyncJob, view: SyncJobView): 'foreign' | 'cannotRetry' | null {
  if (view.action) return null;
  if (inForeignGroup(job, view) && !FINAL_ERROR_STATES.includes(job.state)) return 'foreign';
  return view.filter === 'error' ? 'cannotRetry' : null;
}
