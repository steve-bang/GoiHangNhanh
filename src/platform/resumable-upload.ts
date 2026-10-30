import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';

import { resolveRecordingUri } from './recording-files';

export interface UploadSessionRequest {
  readonly url: string;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
}

export type UploadFileResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly kind: 'network' | 'retryable' | 'attention';
      readonly code: string;
    };

const network = (code: string): UploadFileResult => ({ ok: false, kind: 'network', code });
const retryable = (code: string): UploadFileResult => ({ ok: false, kind: 'retryable', code });

/** Máy chủ/đường truyền tạm không sẵn sàng: người dùng không làm gì được, không tính lượt (Q-24h). */
const TRANSIENT_STATUSES = [408, 429, 502, 503, 504];

/**
 * Mã HTTP -> chờ mạng, thử lại có giới hạn hay cần xử lý. 403 khi PUT thường là URL ký hết hạn: xin
 * phiên mới là xong. 412 (đối tượng đã có, URL tạo-một-lần): KHÔNG cần người dùng xử lý, thử lại để
 * lượt sau đối soát trạng thái máy chủ (`fetchServerStates`) thay vì gửi mù.
 */
export function classifyUploadStatus(status: number): UploadFileResult {
  if (status >= 200 && status < 300) return { ok: true };
  if (TRANSIENT_STATUSES.includes(status)) return network(`HTTP_${status}`);
  if (status >= 500) return retryable(`HTTP_${status}`);
  if (status === 401 || status === 403) return retryable('SESSION_REJECTED');
  if (status === 412) return retryable('HTTP_412');
  return { ok: false, kind: 'attention', code: `UPLOAD_REJECTED_${status}` };
}

/**
 * Gửi tệp gốc lên Storage qua phiên tải có thể tiếp tục: (1) POST tới URL ký để mở phiên và nhận
 * `Location`, (2) PUT nguyên tệp tới phiên đó, `uploadAsync` đọc tệp theo luồng ở lớp native (không
 * nạp video vào bộ nhớ JS). GIỚI HẠN hiện tại: mỗi lần thử gửi lại từ đầu (chưa tiếp tục giữa chừng
 * bằng `Content-Range`), chưa tải ở nền khi app bị đóng (iOS/Android giới hạn chạy nền; không hứa
 * tải nền luôn hoàn tất). Không log URL (có chữ ký) hay đường dẫn tệp. Chưa chạy trên thiết bị.
 *
 * `signal` hủy (máy báo mất mạng): dừng lệnh mở phiên hoặc hủy lần gửi ở lớp native
 * (`UploadTask.cancelAsync`), trả `network`/`NETWORK_LOST`. Tệp cục bộ không bị đụng tới.
 */
export async function uploadFileResumable(
  session: UploadSessionRequest,
  localUri: string,
  contentType: string,
  signal?: AbortSignal,
): Promise<UploadFileResult> {
  const lost = network('NETWORK_LOST');
  if (signal?.aborted) return lost;
  let location: string | null;
  try {
    const start = await fetch(session.url, {
      method: session.method,
      headers: { ...session.headers },
      ...(signal ? { signal } : {}),
    });
    if (!start.ok) return classifyUploadStatus(start.status);
    location = start.headers.get('location');
  } catch {
    return signal?.aborted ? lost : network('NETWORK');
  }
  if (!location) return retryable('NO_SESSION_LOCATION');
  if (signal?.aborted) return lost;
  const task = createUploadTask(location, resolveRecordingUri(localUri), {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  const cancel = () => {
    void task.cancelAsync().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancel);
  try {
    const response = await task.uploadAsync();
    if (signal?.aborted || !response) return lost;
    return classifyUploadStatus(response.status);
  } catch {
    return signal?.aborted ? lost : network('NETWORK');
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
