/**
 * Ghi tài liệu lên máy chủ cho đồng bộ đơn/phiên (ADR-019). Hợp đồng tối thiểu, không biết đơn hay
 * phiên là gì: feature dựng nội dung đúng Rules rồi nhờ cổng này ghi. Hiện thực thật ở
 * `api/firebase/remote-documents.ts`; chỉ có khi backend là Firebase thật (xem `createRemoteDocuments`).
 */
export interface RemoteWriteSpec {
  /** Đường dẫn tài liệu từ gốc, ví dụ `shops/{shopId}/orders/{orderId}`. */
  readonly path: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface RemoteDocuments {
  /** Giá trị đặc biệt của máy chủ để đặt vào nội dung tài liệu. */
  readonly values: {
    serverTimestamp(): unknown;
    timestamp(ms: number): unknown;
  };
  /** Tài khoản đang đăng nhập; `null` = chưa đăng nhập (không ghi được gì). */
  currentUid(): string | null;
  /**
   * Tạo các tài liệu CHƯA có (kiểm tra tồn tại từng tài liệu), tài liệu đã có thì giữ nguyên, không ghi
   * đè (Rules cấm sửa trường định danh). Phần thiếu được ghi trong một batch.
   */
  createMissing(writes: readonly RemoteWriteSpec[]): Promise<void>;
  /** Cập nhật một số trường của tài liệu đã có. */
  updateFields(path: string, fields: Readonly<Record<string, unknown>>): Promise<void>;
  /** Đọc các trường của một tài liệu; `null` nếu chưa có. */
  getFields(path: string): Promise<Readonly<Record<string, unknown>> | null>;
  /**
   * Đọc các trường của NHIỀU tài liệu theo lô (ít lượt đọc hơn gọi `getFields` từng cái). Chỉ trả tài
   * liệu CÓ; đường dẫn không có thì không nằm trong kết quả. Hiện thực gom theo bộ sưu tập cha và theo
   * giới hạn Firestore cho `in` (tối đa 10 mỗi truy vấn).
   */
  getManyFields(
    paths: readonly string[],
  ): Promise<ReadonlyMap<string, Readonly<Record<string, unknown>>>>;
  /** Gọi một Cloud Function dạng callable (ví dụ `createUploadSession`). Lỗi giữ nguyên `code` của SDK. */
  callFunction<T>(name: string, data: unknown): Promise<T>;
}
