/**
 * Phiên tải GCS đang dở của một bằng chứng, lưu bền để lượt tải sau (kể cả sau khi app mở lại) hỏi máy
 * chủ đã nhận tới đâu và gửi tiếp thay vì từ đầu. Chỉ là KIỂU: hiện thực SQLite/bộ nhớ nằm ở
 * `features/orders/data` (cùng kết nối với các kho khác); `platform` không import `features`.
 *
 * `location` là URL phiên có quyền ghi tới khi phiên hết hạn: KHÔNG log, không đưa vào kiểm toán hay báo lỗi.
 */
export interface StoredUploadSession {
  readonly location: string;
  /** Kích thước tệp lúc mở phiên; khác kích thước tệp hiện tại thì phiên không dùng được nữa. */
  readonly sizeBytes: number;
}

export interface UploadSessionStore {
  /** Phiên đang dở của bằng chứng thuộc shop; `null` nếu không có. */
  get(shopId: string, evidenceId: string): Promise<StoredUploadSession | null>;
  /** Lưu (ghi đè phiên cũ của cùng bằng chứng và cùng shop). */
  save(shopId: string, evidenceId: string, session: StoredUploadSession): Promise<void>;
  /** Xóa phiên (tải xong, phiên hết hạn, đổi cỡ tệp). Không có thì không làm gì. */
  clear(shopId: string, evidenceId: string): Promise<void>;
}
