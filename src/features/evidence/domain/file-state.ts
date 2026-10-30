/**
 * Máy trạng thái TỆP bằng chứng (docs/02 "Vòng đời tệp bằng chứng"; docs/06; CLAUDE.md bất biến #3).
 *
 * - Độc lập với trạng thái phiên và đơn: module này không biết gì về chúng.
 * - Hàm thuần: không I/O, không đồng hồ, không React/Firebase.
 * - Chỉ cho phép chuyển hợp lệ. Mọi chuyển khác trả về lỗi, không ném và không "đoán".
 * - Client KHÔNG BAO GIỜ tự đưa tệp tới `uploaded` / `verified` / `hash_mismatch`. Ba trạng thái
 *   này chỉ đạt được bằng sự kiện có `origin: 'server'`, được lớp data tạo ra từ dữ liệu máy chủ
 *   xác nhận (map `server` trong Firestore, do Cloud Function ghi). Đây là lớp phòng thủ thứ hai;
 *   lớp thứ nhất là Security Rules (firebase/firestore.rules) cấm client ghi các giá trị đó.
 */

export const FILE_STATES = {
  /** 1. Camera đang ghi. */
  RECORDING: 'recording',
  /** 2. Đang hoàn tất ghi thành tệp cục bộ (chưa chắc đọc được). */
  SAVING_LOCAL: 'saving_local',
  /** 3. Tệp đã đóng, đọc được, đã tính mã băm; chờ mạng/lượt xử lý. */
  QUEUED: 'queued',
  /** 4. Đang truyền tới máy chủ. */
  UPLOADING: 'uploading',
  /** 5. Máy chủ xác nhận đã nhận đủ tệp (chưa kiểm tra mã băm). */
  UPLOADED: 'uploaded',
  /** 6. Máy chủ tính lại mã băm và khớp bản gốc. */
  VERIFIED: 'verified',
  // --- Trạng thái lỗi (docs/02) ---
  /** Lỗi lưu cục bộ (hết dung lượng, ghi lỗi...). */
  LOCAL_SAVE_FAILED: 'local_save_failed',
  /** Tải lên thất bại, có thể thử lại. */
  UPLOAD_FAILED: 'upload_failed',
  /** Tệp không khớp mã băm: cách ly, không bao giờ coi là đã xác minh. */
  HASH_MISMATCH: 'hash_mismatch',
  /** Cần người dùng xử lý (lỗi xác thực, hết hạn mức, tệp nghi hỏng...). */
  NEEDS_ATTENTION: 'needs_attention',
  /** Không thể khôi phục (tệp mất/hỏng và không còn bản nào). */
  UNRECOVERABLE: 'unrecoverable',
} as const;

export type FileState = (typeof FILE_STATES)[keyof typeof FILE_STATES];

export const ALL_FILE_STATES: readonly FileState[] = Object.values(FILE_STATES);

/** Nguồn của sự kiện. Chỉ lớp data đọc từ máy chủ mới được tạo `origin: 'server'`. */
export type EventOrigin = 'device' | 'server';

export type FileEventType =
  // Sự kiện từ thiết bị
  | 'STOP_RECORDING'
  | 'LOCAL_FILE_READABLE'
  | 'LOCAL_FILE_MOVED'
  | 'LOCAL_WRITE_FAILED'
  | 'RECOVERY_FOUND_FILE'
  | 'RETRY_LOCAL_SAVE'
  | 'UPLOAD_STARTED'
  | 'UPLOAD_FAILED'
  | 'RETRY_UPLOAD'
  | 'NEEDS_ATTENTION'
  | 'ATTENTION_RESOLVED'
  | 'USER_RETRY_ATTENTION'
  | 'MARK_UNRECOVERABLE'
  // Sự kiện từ máy chủ
  | 'SERVER_RECEIVED'
  | 'SERVER_VERIFIED'
  | 'SERVER_HASH_MISMATCH';

export interface FileEvent {
  readonly type: FileEventType;
  readonly origin: EventOrigin;
}

const S = FILE_STATES;

interface Rule {
  readonly origin: EventOrigin;
  readonly from: readonly FileState[];
  readonly to: FileState;
}

/**
 * Bảng chuyển hợp lệ - nguồn sự thật duy nhất. Giải thích các chuyển không hiển nhiên:
 * - RECOVERY_FOUND_FILE: app bị kill khi đang ghi; tìm thấy tệp dở dang -> phải qua SAVING_LOCAL
 *   để kiểm tra lại đọc được, KHÔNG đi thẳng tới QUEUED (A05: "không tự nhận là video đầy đủ";
 *   cờ "bị gián đoạn" nằm ở trạng thái phiên, không ở đây).
 * - LOCAL_FILE_MOVED: tệp vừa được chuyển từ thư mục tạm sang thư mục bền khi đang SAVING_LOCAL; chỉ
 *   ghi lại đường dẫn mới (bản ghi vẫn ở SAVING_LOCAL) để app bị kill trong lúc băm không mất dấu bản
 *   gốc. Không tới QUEUED được: phải qua LOCAL_FILE_READABLE (đã băm, có kích thước).
 * - SERVER_RECEIVED từ QUEUED/UPLOAD_FAILED/NEEDS_ATTENTION: máy chủ đã nhận nhưng app mất phản hồi
 *   (QA-05); đối soát với máy chủ phải đưa được tệp tới UPLOADED mà không tải lại.
 * - SERVER_HASH_MISMATCH chỉ từ UPLOADED: mã băm được so sau khi máy chủ nhận đủ tệp.
 * - USER_RETRY_ATTENTION (V1-08, R-3): người dùng bấm "Thử lại" ở Trung tâm đồng bộ cho tệp "cần xử lý".
 *   Có ĐIỀU KIỆN (`isUserRetryableAttention`): chỉ khi lỗi không phải lỗi của chính tệp trên máy (tệp
 *   mất/đổi/không đọc được, quá lớn, sai loại); thử lại những lỗi đó không bao giờ thành công. Chỉ tới
 *   QUEUED; `hash_mismatch` không có lối ra. Thiếu ngữ cảnh mã lỗi = từ chối (bảo thủ).
 * - ATTENTION_RESOLVED: giữ cho luồng "đã khắc phục nguyên nhân" sau này; hiện không mã nào phát ra.
 *   Cùng điều kiện với USER_RETRY_ATTENTION (review PR #56): không có lối vòng đưa tệp lỗi cục bộ về QUEUED.
 */
const RULES: Readonly<Record<FileEventType, Rule>> = {
  STOP_RECORDING: { origin: 'device', from: [S.RECORDING], to: S.SAVING_LOCAL },
  LOCAL_FILE_READABLE: { origin: 'device', from: [S.SAVING_LOCAL], to: S.QUEUED },
  LOCAL_FILE_MOVED: { origin: 'device', from: [S.SAVING_LOCAL], to: S.SAVING_LOCAL },
  LOCAL_WRITE_FAILED: {
    origin: 'device',
    from: [S.RECORDING, S.SAVING_LOCAL],
    to: S.LOCAL_SAVE_FAILED,
  },
  RECOVERY_FOUND_FILE: { origin: 'device', from: [S.RECORDING], to: S.SAVING_LOCAL },
  RETRY_LOCAL_SAVE: { origin: 'device', from: [S.LOCAL_SAVE_FAILED], to: S.SAVING_LOCAL },
  UPLOAD_STARTED: { origin: 'device', from: [S.QUEUED], to: S.UPLOADING },
  UPLOAD_FAILED: { origin: 'device', from: [S.UPLOADING], to: S.UPLOAD_FAILED },
  RETRY_UPLOAD: { origin: 'device', from: [S.UPLOAD_FAILED], to: S.QUEUED },
  NEEDS_ATTENTION: {
    origin: 'device',
    from: [S.QUEUED, S.UPLOADING, S.UPLOAD_FAILED],
    to: S.NEEDS_ATTENTION,
  },
  ATTENTION_RESOLVED: { origin: 'device', from: [S.NEEDS_ATTENTION], to: S.QUEUED },
  USER_RETRY_ATTENTION: { origin: 'device', from: [S.NEEDS_ATTENTION], to: S.QUEUED },
  MARK_UNRECOVERABLE: {
    origin: 'device',
    from: [S.RECORDING, S.SAVING_LOCAL, S.LOCAL_SAVE_FAILED, S.NEEDS_ATTENTION],
    to: S.UNRECOVERABLE,
  },
  SERVER_RECEIVED: {
    origin: 'server',
    from: [S.QUEUED, S.UPLOADING, S.UPLOAD_FAILED, S.NEEDS_ATTENTION],
    to: S.UPLOADED,
  },
  SERVER_VERIFIED: { origin: 'server', from: [S.UPLOADED], to: S.VERIFIED },
  SERVER_HASH_MISMATCH: { origin: 'server', from: [S.UPLOADED], to: S.HASH_MISMATCH },
};

export const FILE_EVENT_TYPES = Object.keys(RULES) as readonly FileEventType[];

export type TransitionError = 'ILLEGAL_TRANSITION' | 'ORIGIN_NOT_ALLOWED' | 'NOT_USER_RETRYABLE';

export type TransitionResult =
  | { readonly ok: true; readonly state: FileState }
  | { readonly ok: false; readonly error: TransitionError; readonly state: FileState };

/** Dữ liệu của bản ghi mà chuyển có điều kiện cần (`USER_RETRY_ATTENTION`, `ATTENTION_RESOLVED`). */
export interface TransitionContext {
  /** Mã lỗi gần nhất của tệp (`lastErrorCode` của kho). */
  readonly lastErrorCode?: string | null;
}

/**
 * Mã lỗi "cần xử lý" mà người dùng KHÔNG thử lại được (V1-08, R-3): lỗi của chính tệp trên máy, phát hiện
 * trước khi gửi gì (tệp đổi/mất/không đọc được, vượt trần dung lượng, loại tệp không nhận). Thử lại không
 * đổi được kết quả; tệp gốc vẫn giữ nguyên (bất biến 4).
 */
export const NON_RETRYABLE_ATTENTION_CODES: readonly string[] = [
  'LOCAL_HASH_CHANGED',
  'FILE_MISSING',
  'FILE_UNREADABLE',
  'UPLOAD_FILE_TOO_LARGE',
  'UNSUPPORTED_FILE_TYPE',
];

/**
 * Tệp "cần xử lý" có được người dùng bấm Thử lại không: chỉ khi biết mã lỗi và mã đó không phải lỗi tệp
 * cục bộ (máy chủ từ chối nhiều lần, đăng nhập hết hạn...). Không có mã = không biết lý do = không cho.
 */
export function isUserRetryableAttention(lastErrorCode: string | null | undefined): boolean {
  return !!lastErrorCode && !NON_RETRYABLE_ATTENTION_CODES.includes(lastErrorCode);
}

/** Mọi lối ra `needs_attention -> queued` đều cần lỗi KHÔNG phải lỗi tệp cục bộ. */
const CONDITIONAL_ATTENTION_EXITS: readonly FileEventType[] = [
  'USER_RETRY_ATTENTION',
  'ATTENTION_RESOLVED',
];

export function transition(
  state: FileState,
  event: FileEvent,
  context: TransitionContext = {},
): TransitionResult {
  const rule = RULES[event.type];
  if (rule.origin !== event.origin) {
    return { ok: false, error: 'ORIGIN_NOT_ALLOWED', state };
  }
  if (!rule.from.includes(state)) {
    return { ok: false, error: 'ILLEGAL_TRANSITION', state };
  }
  if (
    CONDITIONAL_ATTENTION_EXITS.includes(event.type) &&
    !isUserRetryableAttention(context.lastErrorCode)
  ) {
    return { ok: false, error: 'NOT_USER_RETRYABLE', state };
  }
  return { ok: true, state: rule.to };
}

/** Sự kiện hợp lệ từ một trạng thái (dùng cho test và để UI chỉ hiện hành động có nghĩa). */
export function allowedEvents(state: FileState): readonly FileEventType[] {
  return (Object.keys(RULES) as FileEventType[]).filter((type) => RULES[type].from.includes(state));
}

export function originOf(type: FileEventType): EventOrigin {
  return RULES[type].origin;
}

/** Trạng thái chỉ máy chủ mới xác lập được. */
export const SERVER_ONLY_STATES: readonly FileState[] = [S.UPLOADED, S.VERIFIED, S.HASH_MISMATCH];

export const ERROR_STATES: readonly FileState[] = [
  S.LOCAL_SAVE_FAILED,
  S.UPLOAD_FAILED,
  S.HASH_MISMATCH,
  S.NEEDS_ATTENTION,
  S.UNRECOVERABLE,
];

/**
 * Điều kiện CẦN (chưa đủ) để được phép giải phóng bản cục bộ: máy chủ đã xác minh mã băm.
 * Mọi trạng thái khác -> bản cục bộ có thể là bản duy nhất, luồng dọn dẹp phải bỏ qua
 * (CLAUDE.md bất biến #4; docs/06 "Xóa bản cục bộ").
 * Còn phải thỏa chính sách an toàn và người dùng được thông báo (docs/06) - ngoài phạm vi module.
 * `hash_mismatch` KHÔNG đủ điều kiện: bản cục bộ có thể là bản đúng duy nhất.
 */
export function isLocalCopyReleasable(state: FileState): boolean {
  return state === S.VERIFIED;
}
