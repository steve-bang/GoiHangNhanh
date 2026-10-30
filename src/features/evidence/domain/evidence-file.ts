import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';

import {
  ALL_FILE_STATES,
  FILE_STATES,
  transition,
  type FileEvent,
  type FileState,
  type TransitionError,
} from './file-state';

/**
 * Bản ghi MỘT tệp bằng chứng trên máy này (video/ảnh). Gắn với ID phiên + kiện + đơn được tạo TRƯỚC
 * khi quay, không suy ra từ mã đơn (CLAUDE.md bất biến 1, 2). `state` là trạng thái TỆP, tách khỏi
 * trạng thái phiên/đơn (bất biến 3). Thời gian là thời gian THIẾT BỊ (ms), không phải máy chủ.
 */
export interface EvidenceFile {
  readonly id: EvidenceId;
  readonly shopId: ShopId;
  readonly orderId: OrderId;
  readonly packageId: PackageId;
  readonly sessionId: SessionId;
  /** Nhóm của màn: bằng chứng đóng gói hoặc hàng hoàn. */
  readonly group: 'pack' | 'return';
  readonly kind: 'video' | 'photo';
  readonly state: FileState;
  /** Đường dẫn tệp gốc trên máy; chỉ có khi tệp đã đóng (bản gốc bất biến, bất biến 4). */
  readonly localPath: string | null;
  readonly sizeBytes: number | null;
  readonly durationMs: number | null;
  /** Mã băm SHA-256 do thiết bị tính lúc đóng tệp; máy chủ tính lại và không tin giá trị này. */
  readonly sha256Client: string | null;
  /** Số lần đã thử tải lên (hàng đợi tải lên; bền qua lần mở lại app). */
  readonly attemptCount: number;
  /** Thời điểm THIẾT BỊ sớm nhất được thử lại; `null` = không chờ. */
  readonly nextAttemptAtDevice: number | null;
  /** Mã lỗi gần nhất của lần tải lên (mã nghiệp vụ, không chứa đường dẫn/PII). */
  readonly lastErrorCode: string | null;
  readonly createdAtDevice: number;
  readonly updatedAtDevice: number;
}

/** Dữ liệu tạo tệp mới: luôn bắt đầu ở trạng thái `recording`, chưa có đường dẫn/mã băm. */
export type NewEvidenceFile = Pick<
  EvidenceFile,
  'id' | 'shopId' | 'orderId' | 'packageId' | 'sessionId' | 'group' | 'kind' | 'createdAtDevice'
>;

/** Chi tiết tệp cập nhật cùng một sự kiện (chỉ trường có giá trị mới được ghi). */
export interface EvidenceFilePatch {
  readonly localPath?: string;
  readonly sizeBytes?: number;
  readonly durationMs?: number;
  readonly sha256Client?: string;
  readonly attemptCount?: number;
  /** `null` xóa thời điểm chờ. */
  readonly nextAttemptAtDevice?: number | null;
  /** `null` xóa mã lỗi. */
  readonly lastErrorCode?: string | null;
}

export type ApplyEventError =
  | TransitionError
  | 'FILE_NOT_FOUND'
  | 'MISSING_FILE_DETAILS'
  /** Patch cố đổi chi tiết đã chốt của tệp đã đóng (mã băm, kích thước, thời lượng, vị trí). */
  | 'IMMUTABLE_FIELD';

export type ApplyEventResult =
  | { readonly ok: true; readonly file: EvidenceFile }
  | { readonly ok: false; readonly error: ApplyEventError };

/** Trạng thái mà máy chủ CHƯA xác nhận nhưng vẫn còn việc đồng bộ (loại `unrecoverable`: hết cách). */
const SYNCED_OR_FINAL: readonly FileState[] = [
  FILE_STATES.UPLOADED,
  FILE_STATES.VERIFIED,
  FILE_STATES.UNRECOVERABLE,
];

/** Mọi trạng thái còn việc đồng bộ (`isUnsynced`). */
export const UNSYNCED_STATES: readonly FileState[] = ALL_FILE_STATES.filter(
  (s) => !SYNCED_OR_FINAL.includes(s),
);

/** Tệp còn việc đồng bộ: chưa tới `uploaded`/`verified` và chưa mất hẳn (docs/06). */
export const isUnsynced = (state: FileState): boolean => !SYNCED_OR_FINAL.includes(state);

/** Tệp đã đóng phải có đủ đường dẫn, kích thước và mã băm trước khi vào hàng đợi (file-state.ts). */
function hasQueueDetails(file: EvidenceFile, patch: EvidenceFilePatch): boolean {
  const path = patch.localPath ?? file.localPath;
  const size = patch.sizeBytes ?? file.sizeBytes;
  const hash = patch.sha256Client ?? file.sha256Client;
  return !!path && size !== null && size > 0 && !!hash;
}

/**
 * Hai bản ghi có cùng liên kết đơn + kiện + phiên + shop + nhóm + loại không. Dùng khi `create` gặp
 * `id` đã có: cùng liên kết thì là lần thử lại (trả bản cũ), khác thì là gọi sai, KHÔNG được trả bản
 * cũ trong im lặng (bất biến 2).
 */
export function hasSameBinding(
  existing: Pick<EvidenceFile, 'shopId' | 'orderId' | 'packageId' | 'sessionId' | 'group' | 'kind'>,
  input: Pick<NewEvidenceFile, 'shopId' | 'orderId' | 'packageId' | 'sessionId' | 'group' | 'kind'>,
): boolean {
  return (
    existing.shopId === input.shopId &&
    existing.orderId === input.orderId &&
    existing.packageId === input.packageId &&
    existing.sessionId === input.sessionId &&
    existing.group === input.group &&
    existing.kind === input.kind
  );
}

/** Sự kiện được phép ghi VỊ TRÍ THẬT của tệp khi chuyển từ thư mục tạm sang thư mục bền. */
const RELOCATION_EVENTS: readonly FileEvent['type'][] = [
  'LOCAL_FILE_READABLE',
  'LOCAL_FILE_MOVED',
  'LOCAL_WRITE_FAILED',
  'RECOVERY_FOUND_FILE',
];

/**
 * Bản gốc bất biến (bất biến 4) nên chi tiết của tệp đã đóng không đổi được qua `patch`:
 * - `sha256Client`, `sizeBytes`, `durationMs`: chỉ đặt ở sự kiện đóng tệp (`LOCAL_FILE_READABLE`) và
 *   chỉ MỘT lần (đặt lại đúng giá trị cũ là hợp lệ, để thử lại an toàn). Mã băm gốc dùng để so sánh
 *   trước khi tải nên không đổi được về sau.
 * - `localPath`: đặt được khi chưa có; đổi từ giá trị cũ sang giá trị khác chỉ ở sự kiện chuyển tệp
 *   (`RELOCATION_EVENTS`) và chỉ khi tệp CHƯA đóng (chưa có mã băm).
 * Vi phạm thì từ chối cả sự kiện (không im lặng bỏ qua phần patch), kho không đổi gì.
 */
function violatesImmutability(
  file: EvidenceFile,
  event: FileEvent,
  patch: EvidenceFilePatch,
): boolean {
  const closing = event.type === 'LOCAL_FILE_READABLE';
  const frozen = [
    [patch.sha256Client, file.sha256Client],
    [patch.sizeBytes, file.sizeBytes],
    [patch.durationMs, file.durationMs],
  ] as const;
  for (const [incoming, current] of frozen) {
    if (incoming === undefined) continue;
    if (!closing) return true;
    if (current !== null && current !== incoming) return true;
  }
  if (
    patch.localPath !== undefined &&
    file.localPath !== null &&
    patch.localPath !== file.localPath
  ) {
    return file.sha256Client !== null || !RELOCATION_EVENTS.includes(event.type);
  }
  return false;
}

/**
 * Hàm thuần dùng chung cho mọi cài đặt kho: áp dụng một sự kiện lên bản ghi qua máy trạng thái
 * (`transition`), kiểm điều kiện chi tiết, rồi trả bản ghi mới. Không I/O.
 */
export function applyEventToFile(
  file: EvidenceFile,
  event: FileEvent,
  nowDevice: number,
  patch: EvidenceFilePatch = {},
): ApplyEventResult {
  const result = transition(file.state, event, { lastErrorCode: file.lastErrorCode });
  if (!result.ok) return { ok: false, error: result.error };
  if (violatesImmutability(file, event, patch)) return { ok: false, error: 'IMMUTABLE_FIELD' };
  const next: EvidenceFile = {
    ...file,
    state: result.state,
    localPath: patch.localPath ?? file.localPath,
    sizeBytes: patch.sizeBytes ?? file.sizeBytes,
    durationMs: patch.durationMs ?? file.durationMs,
    sha256Client: patch.sha256Client ?? file.sha256Client,
    attemptCount: patch.attemptCount ?? file.attemptCount,
    nextAttemptAtDevice:
      patch.nextAttemptAtDevice === undefined
        ? file.nextAttemptAtDevice
        : patch.nextAttemptAtDevice,
    lastErrorCode: patch.lastErrorCode === undefined ? file.lastErrorCode : patch.lastErrorCode,
    updatedAtDevice: nowDevice,
  };
  if (result.state === FILE_STATES.QUEUED && !hasQueueDetails(file, patch)) {
    return { ok: false, error: 'MISSING_FILE_DETAILS' };
  }
  return { ok: true, file: next };
}

/** Kho tệp bằng chứng cục bộ. Mọi truy vấn có `shopId` (cô lập shop, bất biến 8). */
export interface EvidenceFileStore {
  /**
   * Tạo tệp ở `recording`. Bộ ba kiện-phiên-đơn phải thuộc nhau và cùng shop với tệp (phiên có thật,
   * `session.orderId`/`packageId` khớp, kiện thuộc đơn): lệch thì ném `LOCAL_SAVE_UNAVAILABLE` và không
   * lưu gì. Cùng `id` đã có VÀ cùng liên kết thì trả bản đã có, không ghi đè (an toàn khi thử lại);
   * cùng `id` mà gắn phiên/đơn/kiện/shop khác thì ném `LOCAL_SAVE_UNAVAILABLE` (không trả bản cũ).
   */
  create(file: NewEvidenceFile): Promise<EvidenceFile>;
  get(shopId: ShopId, id: EvidenceId): Promise<EvidenceFile | null>;
  /** Áp sự kiện qua máy trạng thái; lỗi nghiệp vụ trả `ok: false`, lỗi lưu trữ ném `AppError`. */
  applyEvent(
    shopId: ShopId,
    id: EvidenceId,
    event: FileEvent,
    nowDevice: number,
    patch?: EvidenceFilePatch,
  ): Promise<ApplyEventResult>;
  /** Tệp của shop đang ở một trong các trạng thái, cũ nhất trước (hàng đợi tải lên). */
  listByStates(shopId: ShopId, states: readonly FileState[]): Promise<readonly EvidenceFile[]>;
  /**
   * Như `listByStates` nhưng CHỈ tệp thuộc phiên do CHÍNH `uid` tạo (`packing_sessions.created_by`; Q-24g,
   * V1-07): hàng đợi tải lên không khai báo hộ tệp của tài khoản khác dùng chung máy. Phiên không rõ người
   * tạo (`created_by` NULL) không bao giờ khớp; `uid` rỗng trả rỗng. Cũ nhất trước.
   */
  listForUpload(
    shopId: ShopId,
    states: readonly FileState[],
    uid: string,
  ): Promise<readonly EvidenceFile[]>;
  /**
   * Các shop trên máy này có tệp ở một trong các trạng thái. CHỈ để khôi phục sau khi app bị đóng giữa
   * chừng (phiên của shop khác/shop tạm không được treo mãi ở "đang quay"); không dùng để hiển thị dữ liệu.
   */
  listShopsWithStates(states: readonly FileState[]): Promise<readonly ShopId[]>;
  /** Tệp của nhiều đơn cùng lúc (danh sách đơn), cũ nhất trước. */
  listByOrders(shopId: ShopId, orderIds: readonly OrderId[]): Promise<readonly EvidenceFile[]>;
  /** Mọi tệp của một đơn, cũ nhất trước. */
  listByOrder(shopId: ShopId, orderId: OrderId): Promise<readonly EvidenceFile[]>;
  listBySession(shopId: ShopId, sessionId: SessionId): Promise<readonly EvidenceFile[]>;
  /** Số tệp còn việc đồng bộ của shop (`isUnsynced`). */
  countUnsynced(shopId: ShopId): Promise<number>;
  /** Như `countUnsynced` nhưng mọi shop trên máy; chỉ để bảo vệ dữ liệu khi đăng xuất. */
  countUnsyncedOnDevice(): Promise<number>;
}
