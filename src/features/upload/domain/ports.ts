import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import type { FileEvent, FileState } from '@/features/evidence';

/** Kết quả tính mã băm tệp cục bộ. Không ném lỗi: tệp mất/không đọc được là kết quả bình thường. */
export type HashResult =
  | { readonly ok: true; readonly sha256: string }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

/** Tính SHA-256 theo luồng của tệp gốc (không nạp cả video vào bộ nhớ). Hiện thực thật ở `platform`. */
export interface LocalFileHasher {
  sha256(localPath: string): Promise<HashResult>;
}

/**
 * Chủ sở hữu của tệp bằng chứng (Q-28): bằng chứng ĐÓNG GÓI gắn phiên + kiện + đơn (ID tạo trước khi
 * quay, bất biến 2); bằng chứng HÀNG HOÀN gắn hồ sơ hàng hoàn (hồ sơ có thể chưa liên kết đơn). Cùng
 * hàng đợi, cùng đường dẫn Storage `shops/{shopId}/evidence/{evidenceId}/original`.
 */
export type UploadOwner =
  | {
      readonly kind: 'packing';
      readonly orderId: OrderId;
      readonly sessionId: SessionId;
      readonly packageId: PackageId;
    }
  | { readonly kind: 'return'; readonly returnId: ReturnCaseId };

export interface UploadRequest {
  readonly evidenceId: EvidenceId;
  readonly shopId: ShopId;
  readonly owner: UploadOwner;
  /** Cần để suy ra loại tệp khi khai báo bằng chứng. */
  readonly kind: 'video' | 'photo';
  /** Giờ THIẾT BỊ lúc tạo tệp. */
  readonly createdAtDevice: number;
  readonly durationMs: number | null;
  readonly localPath: string;
  readonly sizeBytes: number;
  /** Mã băm thiết bị tính lúc đóng tệp; máy chủ tính lại và KHÔNG tin giá trị này. */
  readonly sha256Client: string;
}

/**
 * Kết quả một lần tải lên (chính sách thử lại Q-24h).
 * - `received`: máy chủ xác nhận đã nhận ĐỦ tệp (chưa kiểm tra mã băm).
 * - `network`: mất mạng, hết giờ, máy chủ tạm không sẵn sàng. KHÔNG tính lượt: thử lại mãi với giãn
 *   cách tăng dần (trần 15 phút), không bao giờ thành "cần xử lý" chỉ vì mất mạng.
 * - `retryable`: máy chủ từ chối hoặc lỗi không rõ; TÍNH lượt, quá `MAX_UPLOAD_ATTEMPTS` thì "cần xử lý".
 * - `attention`: cần người dùng xử lý ngay (đăng nhập hết hạn, loại tệp, tệp bị từ chối...).
 */
export type UploadOutcome =
  | { readonly kind: 'received' }
  | { readonly kind: 'network'; readonly code: string }
  | { readonly kind: 'retryable'; readonly code: string }
  | { readonly kind: 'attention'; readonly code: string };

/** Tùy chọn của một lần tải: `signal` hủy khi máy báo mất mạng (hàng đợi tự giải phóng lượt). */
export interface UploadAttemptOptions {
  readonly signal?: AbortSignal;
}

/** Trạng thái do MÁY CHỦ báo cho một tệp (map `server` trong Firestore, Cloud Function ghi). */
export type ServerFileState = 'uploaded' | 'verified' | 'hash_mismatch';

/** Cổng tới máy chủ. Hiện thực Firebase thật thuộc bước sau; hàng đợi chỉ phụ thuộc giao diện này. */
export interface UploadGateway {
  /**
   * Tải một tệp. Phải idempotent theo `evidenceId`: gọi lại sau khi mất phản hồi không nhân đôi. Bị
   * hủy qua `options.signal` thì trả `network` (`NETWORK_LOST`), không ném.
   */
  upload(request: UploadRequest, options?: UploadAttemptOptions): Promise<UploadOutcome>;
  /** Hỏi máy chủ trạng thái các tệp; tệp máy chủ chưa biết thì không có trong map. */
  fetchServerStates(
    shopId: ShopId,
    ids: readonly EvidenceId[],
  ): Promise<ReadonlyMap<EvidenceId, ServerFileState>>;
}

/**
 * Một tệp chờ tải, độc lập với nơi lưu (tệp đóng gói ở `evidence_files`, media hàng hoàn ở
 * `return_media`). Hàng đợi chỉ biết hình dạng này; nguồn dịch từ bản ghi của kho.
 */
export interface UploadItem {
  readonly id: EvidenceId;
  readonly shopId: ShopId;
  readonly owner: UploadOwner;
  readonly kind: 'video' | 'photo';
  readonly state: FileState;
  readonly localPath: string | null;
  readonly sizeBytes: number | null;
  readonly durationMs: number | null;
  readonly sha256Client: string | null;
  readonly attemptCount: number;
  readonly nextAttemptAtDevice: number | null;
  readonly lastErrorCode: string | null;
  readonly createdAtDevice: number;
}

/** Phần chi tiết hàng đợi được phép ghi cùng một sự kiện tệp. */
export interface UploadItemPatch {
  readonly attemptCount?: number;
  /** `null` xóa thời điểm chờ. */
  readonly nextAttemptAtDevice?: number | null;
  /** `null` xóa mã lỗi. */
  readonly lastErrorCode?: string | null;
}

export type UploadItemResult =
  { readonly ok: true; readonly item: UploadItem } | { readonly ok: false; readonly error: string };

/**
 * Cổng tới MỘT kho tệp mà hàng đợi tải lên phục vụ. Mọi đổi trạng thái đi qua máy trạng thái tệp
 * (`transition()`), nên client không tự tới `uploaded`/`verified` (chỉ sự kiện `origin: 'server'`).
 */
export interface UploadSource {
  listByStates(shopId: ShopId, states: readonly FileState[]): Promise<readonly UploadItem[]>;
  /**
   * Chủ sở hữu của tệp đã có trên máy chủ chưa (phiên đóng gói đã đăng; hồ sơ hoàn đã đăng bản neo)?
   * `false`: Rules sẽ từ chối khai báo, nên hàng đợi BỎ QUA tệp lượt này (không gọi máy chủ, không đổi
   * trạng thái, không tốn lượt). Không có hàm này = luôn sẵn sàng (nguồn tự lọc trong `listByStates`).
   */
  isReadyToDeclare?(item: UploadItem): Promise<boolean>;
  applyEvent(
    shopId: ShopId,
    id: EvidenceId,
    event: FileEvent,
    atDevice: number,
    patch?: UploadItemPatch,
  ): Promise<UploadItemResult>;
}
