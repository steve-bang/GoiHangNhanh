import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';

/** Kết quả tính mã băm tệp cục bộ. Không ném lỗi: tệp mất/không đọc được là kết quả bình thường. */
export type HashResult =
  | { readonly ok: true; readonly sha256: string }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

/** Tính SHA-256 theo luồng của tệp gốc (không nạp cả video vào bộ nhớ). Hiện thực thật ở `platform`. */
export interface LocalFileHasher {
  sha256(localPath: string): Promise<HashResult>;
}

export interface UploadRequest {
  readonly evidenceId: EvidenceId;
  readonly shopId: ShopId;
  readonly orderId: OrderId;
  readonly sessionId: SessionId;
  readonly packageId: PackageId;
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
 * Kết quả một lần tải lên.
 * - `received`: máy chủ xác nhận đã nhận ĐỦ tệp (chưa kiểm tra mã băm).
 * - `retryable`: lỗi tạm (mạng, máy chủ bận); thử lại sau với giãn cách tăng dần.
 * - `attention`: cần người dùng xử lý (đăng nhập hết hạn, hết hạn mức, tệp bị từ chối...).
 */
export type UploadOutcome =
  | { readonly kind: 'received' }
  | { readonly kind: 'retryable'; readonly code: string }
  | { readonly kind: 'attention'; readonly code: string };

/** Trạng thái do MÁY CHỦ báo cho một tệp (map `server` trong Firestore, Cloud Function ghi). */
export type ServerFileState = 'uploaded' | 'verified' | 'hash_mismatch';

/** Cổng tới máy chủ. Hiện thực Firebase thật thuộc bước sau; hàng đợi chỉ phụ thuộc giao diện này. */
export interface UploadGateway {
  /** Tải một tệp. Phải idempotent theo `evidenceId`: gọi lại sau khi mất phản hồi không nhân đôi. */
  upload(request: UploadRequest): Promise<UploadOutcome>;
  /** Hỏi máy chủ trạng thái các tệp; tệp máy chủ chưa biết thì không có trong map. */
  fetchServerStates(
    shopId: ShopId,
    ids: readonly EvidenceId[],
  ): Promise<ReadonlyMap<EvidenceId, ServerFileState>>;
}
