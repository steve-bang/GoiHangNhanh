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

/** Phân loại lỗi SDK theo `code` (bỏ tiền tố `functions/`). Không đọc `message` (có thể chứa dữ liệu). */
export function toPortError(error: unknown): UploadPortError {
  if (error instanceof UploadPortError) return error;
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^(functions|firestore)\//, '') : 'unknown';
  return new UploadPortError(
    ATTENTION_CODES.includes(code) ? 'attention' : 'retryable',
    code.toUpperCase().replace(/-/g, '_'),
  );
}

const SERVER_STATES: readonly string[] = ['uploaded', 'verified', 'hash_mismatch'];

/**
 * Các cổng tải lên qua Firebase: khai báo bằng chứng (Firestore), xin URL ký (callable
 * `createUploadSession`), đọc `server.state` do Cloud Function ghi. Lỗi Firestore `permission-denied`
 * khi khai báo thường là phiên chưa kịp đăng lên máy chủ (đồng bộ đơn/phiên đang chờ) nên coi là lỗi
 * tạm; vẫn có giới hạn số lần thử của hàng đợi.
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
      for (const id of ids) {
        const fields = await docs.getFields(`shops/${shopId}/evidence/${id}`);
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
