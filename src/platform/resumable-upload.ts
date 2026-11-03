import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';

import { createTempFileChunkSender, type ChunkSender } from './chunk-sender';
import { resolveRecordingUri } from './recording-files';
import {
  chunkContentRange,
  nextChunk,
  parseReceivedBytes,
  statusQueryContentRange,
  UPLOAD_CHUNK_BYTES,
} from './upload-protocol';
import type { UploadSessionStore } from './upload-session-store';

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

/**
 * Hạn cho bước MỞ PHIÊN (POST tới URL ký, không có thân): quá hạn = lỗi mạng `TIMEOUT`, không tốn lượt.
 * Bước PUT tệp không có hạn cứng (tệp lớn trên mạng yếu); chỉ dừng khi `signal` hủy hoặc lớp mạng lỗi.
 */
export const SESSION_OPEN_TIMEOUT_MS = 30_000;

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
 * Hạn cho MỘT khối hoặc lệnh hỏi trạng thái. Khối 8 MiB trên mạng yếu (~50 KB/s) cần ~3 phút; quá hạn thì
 * hủy lần gửi và coi là lỗi mạng `TIMEOUT` (không tốn lượt), lượt sau hỏi lại đã nhận tới đâu. GIÁ TRỊ TẠM.
 */
export const CHUNK_TIMEOUT_MS = 5 * 60_000;

/** Số lần liên tiếp máy chủ báo 308 mà không nhận thêm byte nào thì bỏ cuộc lượt này (tránh vòng lặp vô hạn). */
const MAX_STALLED_CHUNKS = 2;

/** Bối cảnh để tiếp tục phiên tải giữa các lượt (tải tiếp được). */
export interface ResumeOptions {
  readonly store: UploadSessionStore;
  readonly shopId: string;
  readonly evidenceId: string;
  /** Kích thước tệp (byte) đã khai báo lúc tải; phiên lưu với kích thước khác bị bỏ. */
  readonly sizeBytes: number;
  /** Mặc định: ghi khối ra tệp tạm rồi `uploadAsync` (chưa kiểm chứng trên máy). Tiêm khi test. */
  readonly sender?: ChunkSender;
  readonly chunkBytes?: number;
  readonly chunkTimeoutMs?: number;
}

type Opened =
  | { readonly ok: true; readonly location: string }
  | { readonly ok: false; readonly result: UploadFileResult };

/** Mở phiên tải (POST tới URL ký) và lấy `Location`; hạn riêng, hủy theo `signal`. Không log URL. */
async function openSession(
  session: UploadSessionRequest,
  signal: AbortSignal | undefined,
  openTimeoutMs: number,
): Promise<Opened> {
  const lost = network('NETWORK_LOST');
  const open = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    open.abort();
  }, openTimeoutMs);
  const forward = () => open.abort();
  signal?.addEventListener('abort', forward);
  try {
    const start = await fetch(session.url, {
      method: session.method,
      headers: { ...session.headers },
      signal: open.signal,
    });
    if (!start.ok) return { ok: false, result: classifyUploadStatus(start.status) };
    const location = start.headers.get('location');
    if (!location) return { ok: false, result: retryable('NO_SESSION_LOCATION') };
    return { ok: true, location };
  } catch {
    if (signal?.aborted) return { ok: false, result: lost };
    return { ok: false, result: timedOut ? network('TIMEOUT') : network('NETWORK') };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

/** Gửi tệp nguyên khối (không tiếp tục được): đường lui khi chưa có kho phiên hoặc kích thước không rõ. */
async function uploadWholeFile(
  location: string,
  localUri: string,
  contentType: string,
  signal: AbortSignal | undefined,
): Promise<UploadFileResult> {
  const lost = network('NETWORK_LOST');
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

/** Một thao tác mạng có hạn thời gian riêng và hủy theo `signal` ngoài. */
function withDeadline(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const forward = () => controller.abort();
  signal?.addEventListener('abort', forward);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}

type Progress =
  | { readonly kind: 'done' }
  | { readonly kind: 'received'; readonly bytes: number }
  | { readonly kind: 'expired' }
  | { readonly kind: 'fail'; readonly result: UploadFileResult };

/** Hỏi máy chủ đã nhận tới đâu: `PUT` rỗng với `Content-Range` dạng dấu sao (`statusQueryContentRange`). */
async function queryProgress(
  location: string,
  total: number,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Progress> {
  const deadline = withDeadline(signal, timeoutMs);
  try {
    const response = await fetch(location, {
      method: 'PUT',
      headers: { 'Content-Range': statusQueryContentRange(total) },
      signal: deadline.signal,
    });
    if (response.status === 200 || response.status === 201) return { kind: 'done' };
    if (response.status === 308) {
      const bytes = parseReceivedBytes(response.headers.get('range'), total);
      return bytes === null
        ? { kind: 'fail', result: retryable('BAD_RANGE') }
        : { kind: 'received', bytes };
    }
    if (response.status === 404 || response.status === 410) return { kind: 'expired' };
    return { kind: 'fail', result: classifyUploadStatus(response.status) };
  } catch {
    if (signal?.aborted) return { kind: 'fail', result: network('NETWORK_LOST') };
    return { kind: 'fail', result: network(deadline.timedOut() ? 'TIMEOUT' : 'NETWORK') };
  } finally {
    deadline.done();
  }
}

/** Gọi kho phiên mà không để lỗi kho làm hỏng việc tải (không có kho thì tải từ đầu như cũ). */
async function safely<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

/**
 * Tải theo khối và TIẾP TỤC giữa các lượt: dùng lại `Location` đã lưu (nếu kích thước tệp không đổi), hỏi
 * máy chủ đã nhận tới đâu rồi gửi phần còn lại theo khối 8 MiB (`Content-Range`). Phiên hết hạn (404/410)
 * hoặc đổi cỡ tệp thì bỏ phiên và mở phiên mới (đúng một lần mỗi lượt). Lỗi giữa chừng GIỮ phiên để lượt sau
 * tiếp tục; xong (200/201) thì xóa phiên. Máy chủ vẫn băm lại độc lập nên ghép sai khối chỉ ra
 * `hash_mismatch`, không bao giờ `verified` sai. Chỉ ĐỌC tệp gốc (bất biến 4).
 */
async function uploadInChunks(
  session: UploadSessionRequest,
  localUri: string,
  signal: AbortSignal | undefined,
  openTimeoutMs: number,
  resume: ResumeOptions,
): Promise<UploadFileResult> {
  const lost = network('NETWORK_LOST');
  const { store, shopId, evidenceId, sizeBytes } = resume;
  const sender = resume.sender ?? createTempFileChunkSender();
  const chunkBytes = resume.chunkBytes ?? UPLOAD_CHUNK_BYTES;
  const chunkTimeoutMs = resume.chunkTimeoutMs ?? CHUNK_TIMEOUT_MS;
  const clear = () => safely(() => store.clear(shopId, evidenceId), undefined);

  const stored = await safely(() => store.get(shopId, evidenceId), null);
  let location: string | null = null;
  if (stored && stored.sizeBytes === sizeBytes) location = stored.location;
  else if (stored) await clear(); // tệp đổi cỡ: phiên cũ vô nghĩa

  let received = 0;
  let reopened = false;
  for (;;) {
    if (signal?.aborted) return lost;
    if (!location) {
      const opened = await openSession(session, signal, openTimeoutMs);
      if (!opened.ok) return opened.result;
      location = opened.location;
      await safely(
        () => store.save(shopId, evidenceId, { location: opened.location, sizeBytes }),
        undefined,
      );
    }
    const progress = await queryProgress(location, sizeBytes, signal, chunkTimeoutMs);
    if (progress.kind === 'done') {
      await clear();
      return { ok: true };
    }
    if (progress.kind === 'fail') return progress.result;
    if (progress.kind === 'expired') {
      await clear();
      location = null;
      if (reopened) return network('SESSION_EXPIRED');
      reopened = true;
      continue;
    }
    received = progress.bytes;
    break;
  }

  const sourceUri = resolveRecordingUri(localUri);
  let stalled = 0;
  for (;;) {
    const plan = nextChunk(received, sizeBytes, chunkBytes);
    // Máy chủ báo đã nhận đủ byte mà chưa chốt tệp (không nên xảy ra): không đoán, lượt sau hỏi lại.
    if (!plan) return retryable('NO_CHUNK_TO_SEND');
    if (signal?.aborted) return lost;
    const deadline = withDeadline(signal, chunkTimeoutMs);
    let response;
    try {
      response = await sender.send({
        url: location as string,
        localUri: sourceUri,
        start: plan.start,
        end: plan.end,
        contentRange: chunkContentRange(plan, sizeBytes),
        evidenceId,
        signal: deadline.signal,
      });
    } catch {
      if (signal?.aborted) return lost;
      return network(deadline.timedOut() ? 'TIMEOUT' : 'NETWORK');
    } finally {
      deadline.done();
    }
    if (signal?.aborted) return lost;
    if (response.status === 200 || response.status === 201) {
      await clear();
      return { ok: true };
    }
    if (response.status === 308) {
      const next = parseReceivedBytes(response.range, sizeBytes);
      if (next === null) return retryable('BAD_RANGE');
      stalled = next <= received ? stalled + 1 : 0;
      if (stalled >= MAX_STALLED_CHUNKS) return retryable('NO_PROGRESS');
      received = next;
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      await clear();
      return network('SESSION_EXPIRED');
    }
    return classifyUploadStatus(response.status);
  }
}

/**
 * Gửi tệp gốc lên Storage qua phiên tải có thể tiếp tục. Có `resume` thì tải THEO KHỐI và tiếp tục giữa
 * các lượt (xem `uploadInChunks`); không có thì mở phiên rồi PUT nguyên tệp như trước (đường lui). Không
 * log URL (có chữ ký) hay đường dẫn tệp. Chưa tải ở nền khi app bị đóng (iOS/Android giới hạn chạy nền; không
 * hứa tải nền luôn hoàn tất). Chưa chạy trên thiết bị.
 *
 * `signal` hủy (máy báo mất mạng): dừng lệnh đang chạy, trả `network`/`NETWORK_LOST`. Tệp cục bộ không bị
 * đụng tới.
 */
export async function uploadFileResumable(
  session: UploadSessionRequest,
  localUri: string,
  contentType: string,
  signal?: AbortSignal,
  openTimeoutMs: number = SESSION_OPEN_TIMEOUT_MS,
  resume?: ResumeOptions,
): Promise<UploadFileResult> {
  if (signal?.aborted) return network('NETWORK_LOST');
  if (resume && resume.sizeBytes > 0) {
    return uploadInChunks(session, localUri, signal, openTimeoutMs, resume);
  }
  const opened = await openSession(session, signal, openTimeoutMs);
  if (!opened.ok) return opened.result;
  return uploadWholeFile(opened.location, localUri, contentType, signal);
}
