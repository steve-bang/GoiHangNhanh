import type { RemoteDocuments } from '@/api/contract';

import type { RemoteOrderWriter } from '../domain/order-sync';
import { orderWrites, sessionWrite } from '../domain/remote-documents';

/** Lỗi khi không có tài khoản để ghi (chưa đăng nhập hoặc phiên hết). Bên gọi coi là lỗi tạm. */
export class RemoteNotSignedInError extends Error {
  constructor() {
    super('REMOTE_NOT_SIGNED_IN');
  }
}

/**
 * Ghép mapper tài liệu với cổng ghi: đơn = tạo phần còn thiếu (đơn + dòng + kiện); phiên = tạo phần
 * còn thiếu với trạng thái `recording` rồi đặt trạng thái hiện tại nếu khác. Idempotent theo thiết kế
 * của `createMissing` (tài liệu đã có thì giữ nguyên).
 */
export function createRemoteOrderWriter(
  docs: RemoteDocuments,
  appVersion?: string,
): RemoteOrderWriter {
  const uid = () => {
    const current = docs.currentUid();
    if (!current) throw new RemoteNotSignedInError();
    return current;
  };
  return {
    publishOrder: (details) => docs.createMissing(orderWrites(details, uid(), docs.values)),
    async publishSession(session, status) {
      const write = sessionWrite(session, uid(), docs.values, appVersion);
      await docs.createMissing([write]);
      if (status !== 'recording') await docs.updateFields(write.path, { status });
    },
  };
}
