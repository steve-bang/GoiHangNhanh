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

/**
 * Trạng thái "đang ghi video" của phiên. TÊN TẠM: chưa có recorder nên chưa phiên nào mang trạng thái
 * này (kiểu `PackingSession.sessionStatus` mới chỉ có `created`); recorder phải đặt tên chính thức và
 * ghi trạng thái này khi tệp bắt đầu được ghi. Đăng xuất (PER-21) dựa vào đây để chặn khi đang quay.
 * `created` (đã mở màn quay, chưa ghi tệp) KHÔNG phải đang quay: chưa có dữ liệu video để mất.
 */
export const RECORDING_SESSION_STATUS = 'recording';

export const isSessionStatusRecording = (status: string): boolean =>
  status === RECORDING_SESSION_STATUS;

/**
 * Phiên còn đang thực hiện (chưa kết thúc): `created` hoặc đang ghi. Nhận `string` vì giá trị đọc từ
 * kho có thể lạ (bản app khác ghi): trạng thái lạ KHÔNG coi là đang thực hiện, để không gắn nhầm
 * "Xác nhận đơn" vào phiên không rõ. Thêm trạng thái kết thúc cùng recorder.
 */
export const isSessionStatusActive = (status: string): boolean =>
  status === 'created' || isSessionStatusRecording(status);

export const isSessionActive = (session: Pick<PackingSession, 'sessionStatus'>): boolean =>
  isSessionStatusActive(session.sessionStatus);

/** Phiên đang thực hiện của một kiện, nếu có (một kiện chỉ có một phiên đang thực hiện; A03). */
export function findActiveSession(
  sessions: readonly PackingSession[],
  packageId: PackageId,
): PackingSession | null {
  return sessions.find((s) => s.packageId === packageId && isSessionActive(s)) ?? null;
}
