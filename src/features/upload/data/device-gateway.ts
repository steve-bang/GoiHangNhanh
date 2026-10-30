import type { RemoteDocuments } from '@/api/contract';
import { hashFile, uploadFileResumable } from '@/platform';

import {
  createUploadGateway,
  mimeTypeOf,
  UploadPortError,
  type BytesUploader,
} from '../domain/create-upload-gateway';
import type { LocalFileHasher, UploadGateway } from '../domain/ports';
import { createFirebaseUploadPorts } from './firebase-ports';

/** Bộ băm tệp thật (đọc theo khối, native). */
export const deviceHasher: LocalFileHasher = {
  sha256: async (path) => {
    const result = await hashFile(path);
    return result.ok ? { ok: true, sha256: result.sha256 } : { ok: false, reason: result.reason };
  },
};

/**
 * Gửi tệp qua phiên tải có thể tiếp tục; loại tệp suy từ đuôi tệp như lúc khai báo. `signal` hủy
 * (mất mạng) thì dừng lần gửi ở lớp native.
 */
const deviceBytes: BytesUploader = {
  async send(session, localPath, _sizeBytes, signal) {
    const contentType = mimeTypeOf(
      localPath,
      localPath.match(/\.(jpe?g|png)$/i) ? 'photo' : 'video',
    );
    if (!contentType) throw new UploadPortError('attention', 'UNSUPPORTED_FILE_TYPE');
    const result = await uploadFileResumable(session, localPath, contentType, signal);
    if (!result.ok) throw new UploadPortError(result.kind, result.code);
  },
};

/** Cổng tải lên thật của thiết bị: Firebase + gửi tệp native. Chỉ dùng khi có `RemoteDocuments`. */
export function createDeviceUploadGateway(
  docs: RemoteDocuments,
  appVersion?: string,
): UploadGateway {
  return createUploadGateway({
    ...createFirebaseUploadPorts(docs, appVersion),
    bytes: deviceBytes,
  });
}
