import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, ShopId } from '@/core/ids';

import { evidenceWrite } from '../domain/evidence-document';
import {
  UploadPortError,
  type EvidenceDeclarer,
  type ServerStateReader,
  type UploadSession,
  type UploadSessionApi,
} from '../domain/create-upload-gateway';
import type { ServerFileState } from '../domain/ports';

/** Mã lỗi callable cần người dùng xử lý (thử lại cũng không đổi); các mã khác là lỗi tạm. */
const ATTENTION_CODES = [
  'unauthenticated',
  'permission-denied',
  'failed-precondition',
  'invalid-argument',
];

/**
 * Mã lỗi SDK nghĩa là mất mạng/máy chủ tạm không sẵn sàng (gồm hết giờ của `RemoteDocuments`, mã
 * `deadline-exceeded`): không tính lượt (Q-24h).
 */
const NETWORK_CODES = ['unavailable', 'deadline-exceeded'];

/**
 * Mã mơ hồ: SDK callable trả `internal`/`unknown` cả khi KHÔNG tới được máy chủ (mất mạng, lỗi tầng
 * HTTP). Không có `details` (máy chủ không gửi gì) -> lỗi mạng; có `details` (Function ném lỗi có nội
 * dung) -> lỗi máy chủ, tính lượt. Mã thật trên thiết bị chưa đo (release-checklist G, V1-02).
 */
const AMBIGUOUS_CODES = ['internal', 'unknown'];

function hasServerDetails(error: unknown): boolean {
  const details = (error as { details?: unknown } | null)?.details;
  return details !== undefined && details !== null;
}

/** Phân loại lỗi SDK theo `code` (bỏ tiền tố `functions/`). Không đọc `message` (có thể chứa dữ liệu). */
export function toPortError(error: unknown): UploadPortError {
  if (error instanceof UploadPortError) return error;
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^(functions|firestore)\//, '') : 'unknown';
  const kind = ATTENTION_CODES.includes(code)
    ? 'attention'
    : NETWORK_CODES.includes(code) || (AMBIGUOUS_CODES.includes(code) && !hasServerDetails(error))
      ? 'network'
      : 'retryable';
  return new UploadPortError(kind, code.toUpperCase().replace(/-/g, '_'));
}

const SERVER_STATES: readonly string[] = ['uploaded', 'verified', 'hash_mismatch'];

/**
 * Các cổng tải lên qua Firebase: khai báo bằng chứng (Firestore), xin URL ký (callable
 * `createUploadSession`), đọc `server.state` do Cloud Function ghi. Hàng đợi chỉ khai báo khi phiên/hồ
 * sơ đã đăng (`UploadSource.isReadyToDeclare`), nên Firestore `permission-denied` khi khai báo là máy
 * chủ TỪ CHỐI thật (hoặc đăng chậm hơn dấu cục bộ): tính lượt (`retryable`), không phải lỗi mạng, và
 * không thành "cần xử lý" ngay (V1-02).
 */
export function createFirebaseUploadPorts(docs: RemoteDocuments, appVersion?: string) {
  const declarer: EvidenceDeclarer = {
    async declare(request) {
      const uid = docs.currentUid();
      if (!uid) throw new UploadPortError('attention', 'AUTH_REQUIRED');
      try {
        await docs.createMissing([evidenceWrite(request, uid, docs.values, appVersion)]);
      } catch (error) {
        const mapped = toPortError(error);
        throw mapped.code === 'PERMISSION_DENIED'
          ? new UploadPortError('retryable', mapped.code)
          : mapped;
      }
    },
  };
  const sessions: UploadSessionApi = {
    async create(shopId, evidenceId) {
      try {
        return await docs.callFunction<UploadSession & { storagePath?: string }>(
          'createUploadSession',
          {
            shopId,
            evidenceId,
          },
        );
      } catch (error) {
        throw toPortError(error);
      }
    },
  };
  const serverStates: ServerStateReader = {
    async read(shopId: ShopId, ids: readonly EvidenceId[]) {
      const result = new Map<EvidenceId, ServerFileState>();
      if (ids.length === 0) return result;
      // Một lượt đọc theo lô (không đọc tuần tự từng tài liệu mỗi 60 giây).
      const path = (id: EvidenceId) => `shops/${shopId}/evidence/${id}`;
      const documents = await docs.getManyFields(ids.map(path));
      for (const id of ids) {
        const fields = documents.get(path(id));
        const state = (fields?.server as { state?: unknown } | undefined)?.state;
        if (typeof state === 'string' && SERVER_STATES.includes(state)) {
          result.set(id, state as ServerFileState);
        }
      }
      return result;
    },
  };
  return { declarer, sessions, serverStates };
}
