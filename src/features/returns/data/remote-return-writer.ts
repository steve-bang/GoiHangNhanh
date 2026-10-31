import type { RemoteDocuments } from '@/api/contract';

import { returnAnchorWrite } from '../domain/remote-documents';
import type { RemoteReturnWriter } from '../domain/return-sync';

/** Chưa đăng nhập (hoặc phiên hết): không ghi được gì. Bên gọi coi là lỗi tạm. */
export class RemoteReturnNotSignedInError extends Error {
  constructor() {
    super('REMOTE_NOT_SIGNED_IN');
  }
}

/**
 * Hồ sơ không do tài khoản đang đăng nhập tạo (máy dùng chung, đổi tài khoản giữa lượt): Rules ép
 * `createdBy == auth.uid` nên KHÔNG đăng thay người khác. Bên gọi coi là lỗi tạm; hồ sơ chờ chính
 * người tạo đăng nhập (Q-23g).
 */
export class RemoteReturnCreatorMismatchError extends Error {
  constructor() {
    super('REMOTE_CREATOR_MISMATCH');
  }
}

/**
 * Ghép mapper bản neo với cổng ghi: `createMissing` kiểm tra tồn tại rồi chỉ tạo phần thiếu (tài liệu
 * đã có thì giữ nguyên, không ghi đè), nên đăng lại sau khi mất phản hồi là an toàn.
 */
export function createRemoteReturnWriter(
  docs: RemoteDocuments,
  appVersion?: string,
): RemoteReturnWriter {
  return {
    async publishReturn(returnCase) {
      const me = docs.currentUid();
      if (!me) throw new RemoteReturnNotSignedInError();
      if (returnCase.createdBy !== me) throw new RemoteReturnCreatorMismatchError();
      await docs.createMissing([returnAnchorWrite(returnCase, me, docs.values, appVersion)]);
    },
  };
}
