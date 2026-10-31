import { AbortedError, TimeoutError, withTimeout } from '@/core/async';
import type { EvidenceId, ShopId } from '@/core/ids';

import type { ServerFileState, UploadGateway, UploadOutcome, UploadRequest } from './ports';

/**
 * Lỗi do các cổng con ném ra, đã phân loại để hàng đợi biết chờ mạng (`network`, không tính lượt),
 * thử lại có giới hạn (`retryable`) hay cần người dùng xử lý (`attention`). Xem `UploadOutcome`.
 */
export class UploadPortError extends Error {
  constructor(
    readonly kind: 'network' | 'retryable' | 'attention',
    readonly code: string,
  ) {
    super(code);
  }
}

/** Khai báo bằng chứng lên máy chủ (Firestore, Rules đã kiểm phiên/đơn/kiện). Phải idempotent theo id. */
export interface EvidenceDeclarer {
  declare(request: UploadRequest & { readonly mimeType: string }): Promise<void>;
}

/** Phiên tải do Function `createUploadSession` cấp. */
export type UploadSession =
  | {
      readonly status: 'ready';
      readonly url: string;
      readonly method: 'POST';
      readonly headers: Readonly<Record<string, string>>;
    }
  | { readonly status: 'already_received' };

export interface UploadSessionApi {
  create(shopId: ShopId, evidenceId: EvidenceId): Promise<UploadSession>;
}

/**
 * Gửi tệp gốc theo luồng qua phiên tải có thể tiếp tục (native, không nạp cả video vào bộ nhớ).
 * Chỉ trả về khi máy chủ đã nhận ĐỦ tệp.
 *
 * `signal` hủy (máy báo mất mạng): hiện thực NÊN dừng gửi ở lớp native; cổng không chờ nó dừng.
 *
 * Hiện thực PHẢI mở phiên bằng `session.method` + `session.url` và gửi NGUYÊN `session.headers` (kể
 * cả `x-goog-if-generation-match: 0` nằm trong chữ ký URL: thiếu/khác thì Storage từ chối, và bản
 * gốc đã có không bị ghi đè). Phản hồi 412 (đối tượng đã tồn tại) KHÔNG phải lỗi cần thử lại mù:
 * ném `UploadPortError('retryable', ...)` để vòng sau đối soát trạng thái máy chủ.
 */
export interface BytesUploader {
  send(
    session: Extract<UploadSession, { status: 'ready' }>,
    localPath: string,
    sizeBytes: number,
    signal?: AbortSignal,
  ): Promise<void>;
}

export interface ServerStateReader {
  read(
    shopId: ShopId,
    ids: readonly EvidenceId[],
  ): Promise<ReadonlyMap<EvidenceId, ServerFileState>>;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** Loại tệp theo đuôi và loại bằng chứng; `null` nếu không nhận (khớp danh sách của Function). */
export function mimeTypeOf(localPath: string, kind: 'video' | 'photo'): string | null {
  const extension = localPath.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) return null;
  return mime.startsWith(kind === 'video' ? 'video/' : 'image/') ? mime : null;
}

/**
 * Thời hạn cho các lệnh ngắn (khai báo, xin phiên tải, hỏi trạng thái): quá hạn = lỗi mạng (R4), lượt
 * được giải phóng. Bước GỬI TỆP không có hạn cứng (tệp 2 GB trên mạng yếu có thể mất hàng giờ): chỉ
 * dừng khi `signal` hủy (máy báo mất mạng) hoặc lớp mạng native báo lỗi.
 */
export const UPLOAD_CALL_TIMEOUT_MS = 30_000;

/** Mã lỗi lưu ở `lastErrorCode` khi hết giờ/mất mạng giữa chừng (không phải chữ hiển thị). */
export const NETWORK_TIMEOUT_CODE = 'TIMEOUT';
export const NETWORK_LOST_CODE = 'NETWORK_LOST';

function fromError(error: unknown): UploadOutcome {
  if (error instanceof UploadPortError) return { kind: error.kind, code: error.code };
  if (error instanceof TimeoutError) return { kind: 'network', code: NETWORK_TIMEOUT_CODE };
  if (error instanceof AbortedError) return { kind: 'network', code: NETWORK_LOST_CODE };
  return { kind: 'retryable', code: 'UPLOAD_EXCEPTION' };
}

/**
 * Ghép các cổng con thành `UploadGateway` cho hàng đợi: khai báo bằng chứng -> xin phiên tải -> gửi
 * tệp. Máy chủ đã có bản gốc (`already_received`) thì coi là đã nhận, không gửi lại. Lỗi không phân
 * loại được tính lượt (`retryable`); hết giờ/hủy là lỗi mạng; loại tệp lạ cần người dùng xử lý.
 */
export function createUploadGateway(
  ports: {
    readonly declarer: EvidenceDeclarer;
    readonly sessions: UploadSessionApi;
    readonly bytes: BytesUploader;
    readonly serverStates: ServerStateReader;
  },
  timeoutMs: number = UPLOAD_CALL_TIMEOUT_MS,
): UploadGateway {
  return {
    async upload(request, options): Promise<UploadOutcome> {
      const signal = options?.signal;
      const mimeType = mimeTypeOf(request.localPath, request.kind);
      if (!mimeType) return { kind: 'attention', code: 'UNSUPPORTED_FILE_TYPE' };
      if (signal?.aborted) return { kind: 'network', code: NETWORK_LOST_CODE };
      try {
        await withTimeout(ports.declarer.declare({ ...request, mimeType }), timeoutMs, signal);
        const session = await withTimeout(
          ports.sessions.create(request.shopId, request.evidenceId),
          timeoutMs,
          signal,
        );
        if (session.status === 'ready') {
          await withTimeout(
            ports.bytes.send(session, request.localPath, request.sizeBytes, signal),
            null,
            signal,
          );
        }
        return { kind: 'received' };
      } catch (error) {
        return fromError(error);
      }
    },
    async requestServerCheck(shopId, evidenceId) {
      // Máy chủ đã có bản gốc: `createUploadSession` đặt yêu cầu xác minh lại rồi trả `already_received`.
      // Không bao giờ gửi tệp từ đây, kể cả khi máy chủ (bất thường) cấp URL.
      try {
        await withTimeout(ports.sessions.create(shopId, evidenceId), timeoutMs);
      } catch (error) {
        const outcome = fromError(error);
        throw new UploadPortError(
          outcome.kind === 'received' ? 'retryable' : outcome.kind,
          outcome.kind === 'received' ? 'UPLOAD_EXCEPTION' : outcome.code,
        );
      }
    },
    fetchServerStates: (shopId, ids) =>
      withTimeout(ports.serverStates.read(shopId, ids), timeoutMs),
  };
}
