import type { PackageId, SessionId } from '@/core/ids';

import type { OrderDetails, OrderSnapshot, PackingSession } from './types';

export type StartSessionResult =
  { ok: true; session: PackingSession } | { ok: false; reason: 'package_not_in_order' };

/**
 * Dựng phiên đóng gói (docs/04 A03) từ đơn và kiện ĐÃ CHỌN, trước khi mở camera: ID phiên mới, gắn
 * đúng đơn + kiện bằng ID nội bộ (không suy ra từ mã đơn đang hiển thị; bất biến 2), kèm ảnh chụp
 * dữ liệu đơn. Ảnh chụp là bản sao sâu: sửa đơn sau đó không đổi nó. Kiện không thuộc đơn là lỗi.
 *
 * Chưa kiểm tra dung lượng/micro (A04: `INSUFFICIENT_STORAGE`, `MIC_PERMISSION_DENIED`) vì chưa
 * ghi video thật; việc đó làm cùng recorder.
 */
export function buildPackingSession(
  details: OrderDetails,
  packageId: PackageId,
  context: { sessionId: SessionId; nowDevice: number },
): StartSessionResult {
  const pkg = details.packages.find((p) => p.id === packageId);
  if (!pkg) return { ok: false, reason: 'package_not_in_order' };
  const snapshot: OrderSnapshot = {
    orderCode: details.order.orderCode,
    source: details.order.source,
    trackingCode: details.order.trackingCode,
    lines: details.lines.map((l) => ({ name: l.name, variant: l.variant, quantity: l.quantity })),
    packageIndex: pkg.index,
    packageCount: details.packages.length,
    takenAtDevice: context.nowDevice,
  };
  return {
    ok: true,
    session: {
      id: context.sessionId,
      shopId: details.order.shopId,
      orderId: details.order.id,
      packageId: pkg.id,
      startedAtDevice: context.nowDevice,
      snapshot,
      sessionStatus: 'created',
    },
  };
}

/** Phiên còn đang thực hiện (chưa kết thúc). Hiện chỉ có `created`; thêm trạng thái kết thúc cùng recorder. */
export const isSessionActive = (session: PackingSession): boolean =>
  session.sessionStatus === 'created';

/** Phiên đang thực hiện của một kiện, nếu có (một kiện chỉ có một phiên đang thực hiện; A03). */
export function findActiveSession(
  sessions: readonly PackingSession[],
  packageId: PackageId,
): PackingSession | null {
  return sessions.find((s) => s.packageId === packageId && isSessionActive(s)) ?? null;
}
