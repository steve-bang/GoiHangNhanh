import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import {
  onDocumentWritten,
  onDocumentWrittenWithAuthContext,
} from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onObjectFinalized } from 'firebase-functions/v2/storage';

import { AUDITED_ENTITIES, entityLocation, recordAuditForWrite, type AuditedEntity } from './audit';
import { handleEvidenceFinalized } from './evidence';
import { toHttpsError } from './http-errors';
import { isEventTooOld } from './limits';
import {
  handleReverifyRequest,
  isNewReverifyRequest,
  reverifyRequestPath,
  type EvidenceReverifier,
} from './reverify';
import {
  createUploadSessionForUser,
  parseUploadSessionInput,
  type UploadUrlSigner,
} from './uploads';
import { createShopForUser, parseShopId, parseShopInput, updateShopForUser } from './shop';

// Khu vực dữ liệu đã chốt: Singapore (decisions.md Q-08). Phải khớp getFunctions(app, region) ở app.
const REGION = 'asia-southeast1';

initializeApp();

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Cần đăng nhập.');
  return auth.uid;
}

export const createShop = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  try {
    return await createShopForUser(getFirestore(), uid, parseShopInput(request.data));
  } catch (error) {
    return toHttpsError(error);
  }
});

export const updateShop = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  try {
    const shopId = parseShopId(request.data);
    return await updateShopForUser(getFirestore(), uid, shopId, parseShopInput(request.data));
  } catch (error) {
    return toHttpsError(error);
  }
});

/**
 * Khi bản gốc bằng chứng được tải lên Storage: máy chủ tính lại SHA-256 và ghi `server.*` + kiểm toán
 * (evidence.ts). Mọi đối tượng khác bị bỏ qua. Thử lại CÓ TRẦN (`handleEvidenceFinalized`): lỗi tạm
 * ném để Cloud Functions thử lại; lỗi bền (đối tượng không còn) hoặc sự kiện quá 24 giờ thì ghi kiểm
 * toán rồi kết thúc, không thử lại vô hạn.
 */
export const verifyEvidence = onObjectFinalized(
  { region: REGION, timeoutSeconds: 540, memory: '512MiB', retry: true },
  async (event) => {
    const { bucket, name, generation, size } = event.data;
    const result = await handleEvidenceFinalized(
      getFirestore(),
      {
        // Ghim đúng generation đã finalize: nếu đối tượng bị thay giữa chừng thì lỗi, thử lại.
        open: (path) =>
          getStorage()
            .bucket(bucket)
            .file(path, generation ? { generation } : undefined)
            .createReadStream(),
      },
      { name, generation, size },
      event.time,
    );
    if (result.outcome === 'abandoned_too_old' || result.outcome === 'object_missing') {
      // Không ghi đường dẫn/mã đơn: chỉ kết quả (đã có sự kiện kiểm toán theo bằng chứng).
      logger.warn('verifyEvidence stopped', { outcome: result.outcome });
    }
  },
);

/**
 * Trigger kiểm toán cho mọi collection client ghi được (audit.ts; bất biến 7). `retry: true` vì sự
 * kiện id cố định nên thử lại không nhân đôi; quá 24 giờ thì dừng (log không PII) để không thử vô hạn.
 */
function auditTrigger(entity: AuditedEntity) {
  return onDocumentWrittenWithAuthContext(
    { document: AUDITED_ENTITIES[entity], region: REGION, retry: true },
    async (event) => {
      const params = event.params as Record<string, string>;
      if (isEventTooOld(event.time, Date.now())) {
        logger.error('audit event dropped: too old', { entity });
        return;
      }
      const shopId = params.shopId;
      if (!shopId) return;
      await recordAuditForWrite(getFirestore(), {
        entity,
        shopId,
        ...entityLocation(entity, params),
        before: event.data?.before,
        after: event.data?.after,
        authType: event.authType,
        authId: event.authId,
      });
    },
  );
}

export const auditOrderWrite = auditTrigger('order');
export const auditOrderLineWrite = auditTrigger('order_line');
export const auditPackageWrite = auditTrigger('package');
export const auditSessionWrite = auditTrigger('session');
export const auditEvidenceWrite = auditTrigger('evidence');
export const auditReturnWrite = auditTrigger('return');

const storageSigner = (bucketName?: string): UploadUrlSigner => {
  const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
  return {
    objectExists: async (path) => (await bucket.file(path).exists())[0],
    signResumableStart: async (path, contentType, expiresAtMs, extensionHeaders) =>
      (
        await bucket.file(path).getSignedUrl({
          version: 'v4',
          action: 'resumable',
          expires: expiresAtMs,
          contentType,
          extensionHeaders: { ...extensionHeaders },
        })
      )[0],
  };
};

const storageReverifier = (): EvidenceReverifier => {
  const bucket = getStorage().bucket();
  return {
    objectInfo: async (path) => {
      try {
        const [meta] = await bucket.file(path).getMetadata();
        const size = Number(meta.size);
        const updated = Date.parse(String(meta.updated ?? meta.timeCreated ?? ''));
        return {
          ...(meta.generation !== undefined ? { generation: String(meta.generation) } : {}),
          ...(Number.isFinite(size) ? { sizeBytes: size } : {}),
          ...(Number.isFinite(updated) ? { updatedAtMs: updated } : {}),
        };
      } catch (error) {
        if ((error as { code?: unknown } | null)?.code === 404) return null;
        throw error;
      }
    },
    // Ghim đúng generation đã đọc metadata: đối tượng bị thay giữa chừng thì lỗi, không băm nhầm bản.
    open: (path, generation) =>
      bucket.file(path, generation ? { generation } : undefined).createReadStream(),
  };
};

/**
 * Xác minh lại bằng chứng kẹt (reverify.ts): chạy khi `createUploadSession` đặt yêu cầu mới. Thời gian
 * và bộ nhớ đủ để băm theo luồng video 2 GB. Không thử lại tự động: yêu cầu hết hạn sau 30 phút và app
 * gọi lại được; nhờ vậy không có nhiều lần băm song song cùng một tệp.
 */
export const reverifyEvidence = onDocumentWritten(
  {
    document: reverifyRequestPath('{shopId}', '{evidenceId}'),
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
    retry: false,
  },
  async (event) => {
    const { shopId, evidenceId } = event.params as Record<string, string>;
    if (!shopId || !evidenceId) return;
    if (!isNewReverifyRequest(event.data?.before?.data(), event.data?.after?.data())) return;
    const result = await handleReverifyRequest(
      getFirestore(),
      storageReverifier(),
      shopId,
      evidenceId,
      Date.now(),
    );
    logger.info('reverifyEvidence done', { outcome: result.outcome });
  },
);

/**
 * Cấp URL ký để tải bản gốc bằng chứng (uploads.ts). Client không có quyền Storage trực tiếp. Bằng
 * chứng kẹt chỉ được ĐẶT YÊU CẦU xác minh lại ở đây (không băm), nên cấu hình thường là đủ.
 */
export const createUploadSession = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  try {
    return await createUploadSessionForUser(
      getFirestore(),
      storageSigner(),
      uid,
      parseUploadSessionInput(request.data),
    );
  } catch (error) {
    return toHttpsError(error);
  }
});
