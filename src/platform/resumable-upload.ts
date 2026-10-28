import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

import { resolveRecordingUri } from './recording-files';

export interface UploadSessionRequest {
  readonly url: string;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
}

export type UploadFileResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: 'retryable' | 'attention'; readonly code: string };

const retryable = (code: string): UploadFileResult => ({ ok: false, kind: 'retryable', code });

/** Mã HTTP -> thử lại hay cần xử lý. 403 khi PUT thường là URL ký hết hạn: xin phiên mới là xong. */
export function classifyUploadStatus(status: number): UploadFileResult {
  if (status >= 200 && status < 300) return { ok: true };
  if (status === 408 || status === 429 || status >= 500) return retryable(`HTTP_${status}`);
  if (status === 401 || status === 403) return retryable('SESSION_REJECTED');
  return { ok: false, kind: 'attention', code: `UPLOAD_REJECTED_${status}` };
}

/**
 * Gửi tệp gốc lên Storage qua phiên tải có thể tiếp tục: (1) POST tới URL ký để mở phiên và nhận
 * `Location`, (2) PUT nguyên tệp tới phiên đó, `uploadAsync` đọc tệp theo luồng ở lớp native (không
 * nạp video vào bộ nhớ JS). GIỚI HẠN hiện tại: mỗi lần thử gửi lại từ đầu (chưa tiếp tục giữa chừng
 * bằng `Content-Range`), chưa tải ở nền khi app bị đóng (iOS/Android giới hạn chạy nền; không hứa
 * tải nền luôn hoàn tất). Không log URL (có chữ ký) hay đường dẫn tệp. Chưa chạy trên thiết bị.
 */
export async function uploadFileResumable(
  session: UploadSessionRequest,
  localUri: string,
  contentType: string,
): Promise<UploadFileResult> {
  let location: string | null;
  try {
    const start = await fetch(session.url, {
      method: session.method,
      headers: { ...session.headers },
    });
    if (!start.ok) return classifyUploadStatus(start.status);
    location = start.headers.get('location');
  } catch {
    return retryable('NETWORK');
  }
  if (!location) return retryable('NO_SESSION_LOCATION');
  try {
    const response = await uploadAsync(location, resolveRecordingUri(localUri), {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    });
    return classifyUploadStatus(response.status);
  } catch {
    return retryable('NETWORK');
  }
}
