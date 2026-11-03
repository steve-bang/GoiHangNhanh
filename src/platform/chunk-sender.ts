import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';

/** Một khối cần gửi lên phiên tải GCS. */
export interface ChunkSendRequest {
  /** `Location` của phiên tải (URL có quyền ghi): không log. */
  readonly url: string;
  /** Đường dẫn tệp gốc (đã giải thành URI tuyệt đối). Chỉ ĐỌC. */
  readonly localUri: string;
  readonly start: number;
  /** Byte cuối, tính cả. */
  readonly end: number;
  readonly contentRange: string;
  /** Dùng đặt tên tệp tạm để các lần gửi không đè nhau. */
  readonly evidenceId: string;
  readonly signal?: AbortSignal;
}

export interface ChunkSendResponse {
  readonly status: number;
  /** Tiêu đề `Range` của phản hồi (308: byte máy chủ đã nhận); `null` nếu vắng. */
  readonly range: string | null;
}

/**
 * Gửi MỘT khối. Ném lỗi khi mất mạng hoặc bị hủy bằng `signal` (bên gọi phân loại là lỗi mạng); phản hồi
 * HTTP bất kỳ (kể cả 308/4xx/5xx) trả về nguyên trạng để bên gọi phân loại.
 */
export interface ChunkSender {
  send(request: ChunkSendRequest): Promise<ChunkSendResponse>;
}

const TEMP_PREFIX = 'upload-chunk-';
const TEMP_SUFFIX = '.part';

const tempName = (evidenceId: string): string =>
  `${TEMP_PREFIX}${evidenceId.replace(/[^A-Za-z0-9_-]/g, '_')}${TEMP_SUFFIX}`;

const headerValue = (headers: Record<string, string> | undefined, name: string): string | null => {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key] ?? null;
  }
  return null;
};

/**
 * Bộ gửi khối mặc định: đọc đúng dải byte từ tệp gốc (`FileHandle.offset` + `readBytes`), ghi ra tệp tạm
 * trong cache, rồi `uploadAsync` PUT tệp tạm kèm `Content-Range` (lớp native đọc tệp theo luồng, không đẩy
 * byte qua cầu JS). Tệp tạm xóa ngay sau khi gửi (kể cả khi lỗi). KHÔNG sửa tệp gốc (bất biến 4).
 *
 * CHƯA KIỂM CHỨNG TRÊN THIẾT BỊ: (1) `uploadAsync` có gửi đúng `Content-Range` và trả `Range` của 308 không,
 * (2) hệ điều hành có xử 308 như chuyển hướng không, (3) thông lượng và bộ nhớ với khối 8 MiB. Đây là mục
 * spike của kế hoạch tải tiếp được; nếu hỏng thì thay bằng bộ gửi khác qua giao diện `ChunkSender`.
 */
export function createTempFileChunkSender(): ChunkSender {
  return {
    async send(request) {
      const length = request.end - request.start + 1;
      const temp = new File(Paths.cache, tempName(request.evidenceId));
      let handle: ReturnType<File['open']> | null = null;
      try {
        handle = new File(request.localUri).open(FileMode.ReadOnly);
        handle.offset = request.start;
        const bytes = await handle.readBytes(length);
        if (bytes.length !== length) throw new Error('short_read');
        handle.close();
        handle = null;
        if (temp.exists) temp.delete();
        temp.create();
        await temp.write(bytes);
        const task = createUploadTask(request.url, temp.uri, {
          httpMethod: 'PUT',
          uploadType: FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Range': request.contentRange },
        });
        const cancel = () => {
          void task.cancelAsync().catch(() => undefined);
        };
        request.signal?.addEventListener('abort', cancel);
        try {
          const response = await task.uploadAsync();
          if (!response) throw new Error('cancelled');
          return { status: response.status, range: headerValue(response.headers, 'range') };
        } finally {
          request.signal?.removeEventListener('abort', cancel);
        }
      } finally {
        try {
          handle?.close();
        } catch {
          // đã đóng
        }
        try {
          if (temp.exists) temp.delete();
        } catch {
          // dọn không được: lần khởi động sau `removeOrphanChunkFiles` xử lý
        }
      }
    },
  };
}

/**
 * Xóa tệp khối mồ côi trong cache (app bị tắt giữa lúc gửi khối). Chỉ động tới tệp mang tiền tố/đuôi của
 * mình. Không ném lỗi; trả số tệp đã xóa.
 */
export function removeOrphanChunkFiles(): number {
  let removed = 0;
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (
        entry instanceof File &&
        entry.name.startsWith(TEMP_PREFIX) &&
        entry.name.endsWith(TEMP_SUFFIX)
      ) {
        try {
          entry.delete();
          removed += 1;
        } catch {
          // bỏ qua tệp không xóa được
        }
      }
    }
  } catch {
    // không liệt kê được cache: bỏ qua
  }
  return removed;
}
