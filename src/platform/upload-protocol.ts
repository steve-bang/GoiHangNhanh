/**
 * Phần thuần của giao thức tải có thể tiếp tục của Google Cloud Storage (GCS), không đụng mạng hay hệ tệp
 * nên test được không cần thiết bị. Dùng bởi `resumable-upload.ts`.
 *
 * Giao thức (tài liệu GCS "resumable uploads"): sau khi mở phiên (POST tới URL ký) nhận `Location` của phiên,
 * - hỏi đã nhận tới đâu: `PUT <Location>` rỗng với `Content-Range` có dấu sao thay dải (xem `statusQueryContentRange`) -> 308 kèm
 *   `Range: bytes=0-<byte cuối đã nhận>` (vắng `Range` = chưa nhận byte nào), hoặc 200/201 nếu đã xong;
 * - gửi một khối: `PUT <Location>` với `Content-Range: bytes <a>-<b>/<tổng>`; kích thước khối phải là bội
 *   của 256 KiB, trừ khối cuối; 308 = nhận tiếp, 200/201 = xong.
 * Chưa chạy trên thiết bị.
 */

/** GCS chỉ lưu bền theo bội số của 256 KiB; mọi khối trừ khối cuối phải là bội của giá trị này. */
export const GCS_CHUNK_ALIGNMENT = 256 * 1024;

/** Kích thước khối gửi (8 MiB = 32 x 256 KiB). GIÁ TRỊ TẠM, chỉnh sau khi đo trên máy thật (G-3). */
export const UPLOAD_CHUNK_BYTES = 32 * GCS_CHUNK_ALIGNMENT;

/**
 * Số byte máy chủ đã nhận, từ tiêu đề `Range` của phản hồi 308: `bytes=0-<cuối>` (cuối tính cả) -> cuối + 1;
 * vắng `Range` -> 0. `null` = không hiểu được hoặc vô lý (lớn hơn tổng): bên gọi không được đoán, phải coi
 * là lỗi tạm và thử lại sau.
 */
export function parseReceivedBytes(range: string | null | undefined, total: number): number | null {
  if (range === null || range === undefined || range.trim() === '') return 0;
  const match = /^bytes=0-(\d+)$/i.exec(range.trim());
  if (!match) return null;
  const received = Number(match[1]) + 1;
  if (!Number.isSafeInteger(received) || received > total) return null;
  return received;
}

export interface ChunkPlan {
  /** Byte đầu (tính cả). */
  readonly start: number;
  /** Byte cuối (tính cả). */
  readonly end: number;
  readonly isLast: boolean;
}

/**
 * Khối kế tiếp cần gửi khi máy chủ đã có `received` byte của tệp `total` byte. `null` khi không còn gì để
 * gửi (`received >= total`) hoặc tham số vô lý. Khối không vượt `chunkBytes`; `chunkBytes` phải là bội của
 * `GCS_CHUNK_ALIGNMENT` (khối cuối là phần còn lại, tùy ý).
 */
export function nextChunk(
  received: number,
  total: number,
  chunkBytes: number = UPLOAD_CHUNK_BYTES,
): ChunkPlan | null {
  if (!Number.isSafeInteger(received) || !Number.isSafeInteger(total)) return null;
  if (received < 0 || total <= 0 || received >= total) return null;
  if (chunkBytes <= 0 || chunkBytes % GCS_CHUNK_ALIGNMENT !== 0) return null;
  const end = Math.min(received + chunkBytes, total) - 1;
  return { start: received, end, isLast: end === total - 1 };
}

/** `Content-Range` của một khối. */
export const chunkContentRange = (plan: ChunkPlan, total: number): string =>
  `bytes ${plan.start}-${plan.end}/${total}`;

/** `Content-Range` của lệnh hỏi đã nhận tới đâu (thân rỗng). */
export const statusQueryContentRange = (total: number): string => `bytes */${total}`;
