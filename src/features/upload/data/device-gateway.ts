import type { RemoteDocuments } from '@/api/contract';
import {
  fileFingerprint,
  hashFile,
  uploadFileResumable,
  type UploadSessionStore,
} from '@/platform';

import {
  createUploadGateway,
  mimeTypeOf,
  UploadPortError,
  type BytesUploader,
} from '../domain/create-upload-gateway';
import type { LocalFileHasher, UploadGateway } from '../domain/ports';
import { createFirebaseUploadPorts } from './firebase-ports';

/** Bộ băm tệp thật (đọc theo khối, nhường luồng JS; V1-13) + dấu tệp rẻ để không băm lại tệp không đổi. */
export const deviceHasher: LocalFileHasher = {
  sha256: async (path) => {
    const result = await hashFile(path);
    return result.ok ? { ok: true, sha256: result.sha256 } : { ok: false, reason: result.reason };
  },
  fingerprint: async (path) => fileFingerprint(path),
};

/**
 * Gửi tệp qua phiên tải có thể tiếp tục; loại tệp suy từ đuôi tệp như lúc khai báo. `signal` hủy
 * (mất mạng) thì dừng lần gửi ở lớp native. Có `sessionStore` thì tải THEO KHỐI và tiếp tục phiên dở giữa
 * các lượt (và sau khi app mở lại); không có thì gửi nguyên tệp như trước.
 */
function createDeviceBytes(sessionStore: UploadSessionStore | undefined): BytesUploader {
  return {
    async send(session, localPath, sizeBytes, signal, context) {
      const contentType = mimeTypeOf(
        localPath,
        localPath.match(/\.(jpe?g|png)$/i) ? 'photo' : 'video',
      );
      if (!contentType) throw new UploadPortError('attention', 'UNSUPPORTED_FILE_TYPE');
      const resume =
        sessionStore && context
          ? {
              store: sessionStore,
              shopId: context.shopId,
              evidenceId: context.evidenceId,
              sizeBytes,
            }
          : undefined;
      const result = await uploadFileResumable(
        session,
        localPath,
        contentType,
        signal,
        undefined,
        resume,
      );
      if (!result.ok) throw new UploadPortError(result.kind, result.code);
    },
  };
}

/**
 * Cổng tải lên thật của thiết bị: Firebase + gửi tệp native. Chỉ dùng khi có `RemoteDocuments`.
 * `sessionStore` (tùy chọn) bật tải tiếp được; máy chủ báo `already_received` thì bỏ phiên dở của tệp đó.
 */
export function createDeviceUploadGateway(
  docs: RemoteDocuments,
  appVersion?: string,
  sessionStore?: UploadSessionStore,
): UploadGateway {
  const ports = createFirebaseUploadPorts(docs, appVersion);
  return createUploadGateway({
    ...ports,
    sessions: sessionStore
      ? {
          create: async (shopId, evidenceId) => {
            const session = await ports.sessions.create(shopId, evidenceId);
            if (session.status === 'already_received') {
              // Bản gốc đã ở máy chủ: phiên dở (nếu có) vô nghĩa; không để lại URL có quyền ghi.
              await sessionStore.clear(shopId, evidenceId).catch(() => undefined);
            }
            return session;
          },
        }
      : ports.sessions,
    bytes: createDeviceBytes(sessionStore),
  });
}
