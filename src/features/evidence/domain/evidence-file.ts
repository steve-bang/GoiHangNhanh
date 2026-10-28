import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';

import {
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
}

export type ApplyEventError = TransitionError | 'FILE_NOT_FOUND' | 'MISSING_FILE_DETAILS';

export type ApplyEventResult =
  | { readonly ok: true; readonly file: EvidenceFile }
  | { readonly ok: false; readonly error: ApplyEventError };

/** Trạng thái mà máy chủ CHƯA xác nhận nhưng vẫn còn việc đồng bộ (loại `unrecoverable`: hết cách). */
const SYNCED_OR_FINAL: readonly FileState[] = [
  FILE_STATES.UPLOADED,
  FILE_STATES.VERIFIED,
  FILE_STATES.UNRECOVERABLE,
];

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
 * Hàm thuần dùng chung cho mọi cài đặt kho: áp dụng một sự kiện lên bản ghi qua máy trạng thái
 * (`transition`), kiểm điều kiện chi tiết, rồi trả bản ghi mới. Không I/O.
 */
export function applyEventToFile(
  file: EvidenceFile,
  event: FileEvent,
  nowDevice: number,
  patch: EvidenceFilePatch = {},
): ApplyEventResult {
  const result = transition(file.state, event);
  if (!result.ok) return { ok: false, error: result.error };
  const next: EvidenceFile = {
    ...file,
    state: result.state,
    localPath: patch.localPath ?? file.localPath,
    sizeBytes: patch.sizeBytes ?? file.sizeBytes,
    durationMs: patch.durationMs ?? file.durationMs,
    sha256Client: patch.sha256Client ?? file.sha256Client,
    updatedAtDevice: nowDevice,
  };
  if (result.state === FILE_STATES.QUEUED && !hasQueueDetails(file, patch)) {
    return { ok: false, error: 'MISSING_FILE_DETAILS' };
  }
  return { ok: true, file: next };
}

/** Kho tệp bằng chứng cục bộ. Mọi truy vấn có `shopId` (cô lập shop, bất biến 8). */
export interface EvidenceFileStore {
  /** Tạo tệp ở `recording`. Cùng `id` đã có thì trả bản đã có, không ghi đè (an toàn khi thử lại). */
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
  /** Mọi tệp của một đơn, cũ nhất trước. */
  listByOrder(shopId: ShopId, orderId: OrderId): Promise<readonly EvidenceFile[]>;
  listBySession(shopId: ShopId, sessionId: SessionId): Promise<readonly EvidenceFile[]>;
  /** Số tệp còn việc đồng bộ của shop (`isUnsynced`). */
  countUnsynced(shopId: ShopId): Promise<number>;
  /** Như `countUnsynced` nhưng mọi shop trên máy; chỉ để bảo vệ dữ liệu khi đăng xuất. */
  countUnsyncedOnDevice(): Promise<number>;
}
