import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onObjectFinalized } from 'firebase-functions/v2/storage';

import { verifyEvidenceObject } from './evidence';
import {
  createUploadSessionForUser,
  parseUploadSessionInput,
  UploadError,
  type UploadUrlSigner,
} from './uploads';
import { createShopForUser, parseShopInput, ShopError, updateShopForUser } from './shop';

// Khu vực dữ liệu đã chốt: Singapore (decisions.md Q-08). Phải khớp getFunctions(app, region) ở app.
const REGION = 'asia-southeast1';

initializeApp();

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Cần đăng nhập.');
  return auth.uid;
}

function toHttpsError(error: unknown): never {
  if (error instanceof ShopError || error instanceof UploadError) {
    throw new HttpsError(error.code, error.message);
  }
  if (error instanceof HttpsError) throw error;
  throw new HttpsError('internal', 'Lỗi hệ thống.');
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
    const { shopId } = (request.data ?? {}) as { shopId?: unknown };
    if (typeof shopId !== 'string' || shopId.length === 0) {
      throw new ShopError('invalid-argument', 'Thiếu mã shop.');
    }
    return await updateShopForUser(getFirestore(), uid, shopId, parseShopInput(request.data));
  } catch (error) {
    return toHttpsError(error);
  }
});

/**
 * Khi bản gốc bằng chứng được tải lên Storage: máy chủ tính lại SHA-256 và ghi `server.*` + kiểm toán
 * (evidence.ts). Mọi đối tượng khác bị bỏ qua. Lỗi đọc thì ném để Cloud Functions thử lại.
 */
export const verifyEvidence = onObjectFinalized(
  { region: REGION, timeoutSeconds: 540, memory: '512MiB', retry: true },
  async (event) => {
    const { bucket, name } = event.data;
    await verifyEvidenceObject(
      getFirestore(),
      {
        // Ghim đúng generation đã finalize: nếu đối tượng bị thay giữa chừng thì lỗi, thử lại.
        open: (path) =>
          getStorage()
            .bucket(bucket)
            .file(path, event.data.generation ? { generation: event.data.generation } : undefined)
            .createReadStream(),
      },
      name,
      event.data.generation,
    );
  },
);

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

/** Cấp URL ký để tải bản gốc bằng chứng (uploads.ts). Client không có quyền Storage trực tiếp. */
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
