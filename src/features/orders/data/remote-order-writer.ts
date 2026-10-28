import type { RemoteDocuments } from '@/api/contract';

import type { RemoteOrderWriter } from '../domain/order-sync';
import { orderWrites, packageWrite, sessionWrite } from '../domain/remote-documents';

/** Lỗi khi không có tài khoản để ghi (chưa đăng nhập hoặc phiên hết). Bên gọi coi là lỗi tạm. */
export class RemoteNotSignedInError extends Error {
  constructor() {
    super('REMOTE_NOT_SIGNED_IN');
  }
}

/**
 * Bản ghi không do tài khoản đang đăng nhập tạo (máy dùng chung, đổi tài khoản giữa lượt đồng bộ):
 * Rules ép `createdBy == auth.uid` nên KHÔNG đăng thay người khác và không ghi nhầm người tạo. Bên
 * gọi coi là lỗi tạm; bản ghi chờ đến khi chính người tạo đăng nhập.
 */
export class RemoteCreatorMismatchError extends Error {
  constructor() {
    super('REMOTE_CREATOR_MISMATCH');
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
    async publishOrder(details) {
      const me = uid();
      if (details.order.createdBy !== me) throw new RemoteCreatorMismatchError();
      // Kiện do người khác thêm vào đơn của mình chờ chính họ đăng (createdBy của kiện phải là họ).
      const own = { ...details, packages: details.packages.filter((p) => p.createdBy === me) };
      await docs.createMissing(orderWrites(own, me, docs.values));
    },
    async publishPackage(order, pkg) {
      const me = uid();
      if (pkg.createdBy !== me) throw new RemoteCreatorMismatchError();
      await docs.createMissing([packageWrite(order, pkg, me, docs.values)]);
    },
    async publishSession(session, status) {
      const me = uid();
      if (session.createdBy !== me) throw new RemoteCreatorMismatchError();
      const write = sessionWrite(session, me, docs.values, appVersion);
      await docs.createMissing([write]);
      if (status !== 'recording') await docs.updateFields(write.path, { status });
    },
  };
}
