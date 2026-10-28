import type { EvidenceId, ShopId } from '@/core/ids';

import type { ServerFileState, UploadGateway, UploadOutcome, UploadRequest } from './ports';

/** Lỗi do các cổng con ném ra, đã phân loại để hàng đợi biết thử lại hay cần người dùng xử lý. */
export class UploadPortError extends Error {
  constructor(
    readonly kind: 'retryable' | 'attention',
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
 * Ghép các cổng con thành `UploadGateway` cho hàng đợi: khai báo bằng chứng -> xin phiên tải -> gửi
 * tệp. Máy chủ đã có bản gốc (`already_received`) thì coi là đã nhận, không gửi lại. Lỗi không phân
 * loại được coi là lỗi tạm; loại tệp lạ cần người dùng xử lý (thử lại cũng không đổi).
 */
export function createUploadGateway(ports: {
  readonly declarer: EvidenceDeclarer;
  readonly sessions: UploadSessionApi;
  readonly bytes: BytesUploader;
  readonly serverStates: ServerStateReader;
}): UploadGateway {
  return {
    async upload(request): Promise<UploadOutcome> {
      const mimeType = mimeTypeOf(request.localPath, request.kind);
      if (!mimeType) return { kind: 'attention', code: 'UNSUPPORTED_FILE_TYPE' };
      try {
        await ports.declarer.declare({ ...request, mimeType });
        const session = await ports.sessions.create(request.shopId, request.evidenceId);
        if (session.status === 'ready') {
          await ports.bytes.send(session, request.localPath, request.sizeBytes);
        }
        return { kind: 'received' };
      } catch (error) {
        if (error instanceof UploadPortError) return { kind: error.kind, code: error.code };
        return { kind: 'retryable', code: 'UPLOAD_EXCEPTION' };
      }
    },
    fetchServerStates: (shopId, ids) => ports.serverStates.read(shopId, ids),
  };
}
