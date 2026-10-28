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
 * Trạng thái "đang ghi video" của phiên: luồng ghi video (khi bật cờ `RECORDER_ENABLED`) đặt khi tệp bắt
 * đầu được ghi. TÊN CÒN TẠM (chờ BA đặt tên chính thức). Đăng xuất (PER-21) dựa vào đây để chặn khi đang quay.
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

/**
 * Phiên đã khép lại (hoặc dừng giữa chừng) của một kiện, chặn việc tạo phiên đóng gói MỚI cho kiện đó
 * (docs/04 A01: phiên đã hoàn tất thì "không tự bắt đầu quay mới"; ADR-020 R-11, phương án a theo khuyến nghị
 * reviewer, chờ BA xác nhận). `recorded` = `ended`/`confirmed` (kiện đã quay xong); `unfinished` =
 * `interrupted`/`needs_attention` (lần quay dở: luồng "tiếp tục" chưa được BA chốt, Q-23j, nên cũng chặn,
 * thận trọng). Trạng thái lạ KHÔNG chặn (cùng lý do với `isSessionStatusActive`). Chỉ cho luồng đóng gói;
 * quay hàng hoàn không dùng hàm này.
 */
export type BlockingSession = { kind: 'recorded' | 'unfinished'; session: PackingSession };

export function findBlockingSession(
  sessions: readonly PackingSession[],
  packageId: PackageId,
): BlockingSession | null {
  const ofPackage = sessions.filter((s) => s.packageId === packageId);
  const recorded = ofPackage.find((s) => ['ended', 'confirmed'].includes(s.sessionStatus));
  if (recorded) return { kind: 'recorded', session: recorded };
  const unfinished = ofPackage.find((s) =>
    ['interrupted', 'needs_attention'].includes(s.sessionStatus),
  );
  return unfinished ? { kind: 'unfinished', session: unfinished } : null;
}
