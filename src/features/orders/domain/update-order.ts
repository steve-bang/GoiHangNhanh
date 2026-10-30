import type { OrderLineId } from '@/core/ids';
import type { OrderSource } from '@/core/orders/order-source';

import { checkLine, type DraftError } from './build-order';
import { validateTrackingCode } from './codes';
import type { OrderDetails, OrderLine } from './types';

/** Dòng trong form sửa: `id` có = dòng đã lưu (giữ ID), `null` = dòng mới thêm. */
export interface EditLineDraft {
  readonly id: OrderLineId | null;
  readonly name: string;
  readonly variant: string;
  readonly quantity: number;
}

export interface OrderEditDraft {
  readonly source: OrderSource;
  readonly trackingCode: string;
  readonly lines: readonly EditLineDraft[];
}

/** Bản đã chuẩn hóa để ghi: mã đơn KHÔNG nằm ở đây (mã đơn khóa, không đổi được sau khi tạo). */
export interface OrderEdit {
  readonly source: OrderSource;
  readonly trackingCode: string | null;
  readonly lines: readonly OrderLine[];
}

export type EditBuildResult =
  | { ok: true; edit: OrderEdit }
  | { ok: false; error: Exclude<DraftError, { kind: 'invalid_code' }> };

/**
 * Dựng bản sửa từ form. Cùng quy tắc với `buildOrder`: dòng trống hoàn toàn bị bỏ; có variant mà thiếu
 * tên là lỗi; tên/variant tối đa 200 ký tự, mã vận đơn tối đa 64 (khớp Rules, V1-04); số lượng nguyên 1..99.999; không gộp dòng cùng tên khác variant (bất biến 10). Dòng đã
 * lưu giữ ID, nguồn dữ liệu và thời điểm tạo; dòng mới nhận ID từ `lineId()`. Xóa hết dòng hợp lệ
 * (đơn *Chưa khai báo sản phẩm*, không chặn quay).
 */
export function buildOrderEdit(
  details: OrderDetails,
  draft: OrderEditDraft,
  context: { lineId: () => OrderLineId; nowDevice: number },
): EditBuildResult {
  const existing = new Map(details.lines.map((l) => [l.id, l]));
  const lines: OrderLine[] = [];
  for (const [lineIndex, line] of draft.lines.entries()) {
    const name = line.name.trim();
    const variant = line.variant.trim();
    if (name.length === 0 && variant.length === 0) continue;
    const checked = checkLine(name, variant, line.quantity, lineIndex);
    if ('kind' in checked) return { ok: false, error: checked };
    const kept = line.id ? existing.get(line.id) : undefined;
    lines.push({
      id: kept ? kept.id : context.lineId(),
      orderId: details.order.id,
      name,
      variant: variant.length > 0 ? variant : null,
      quantity: checked.quantity,
      position: lines.length,
      dataOrigin: 'entered_by_user',
      createdAtDevice: kept ? kept.createdAtDevice : context.nowDevice,
    });
  }
  const tracking = validateTrackingCode(draft.trackingCode);
  if (!tracking.ok) return { ok: false, error: { kind: 'invalid_tracking_code' } };
  return { ok: true, edit: { source: draft.source, trackingCode: tracking.code, lines } };
}

/** Bản sửa có giống đơn hiện tại không (để tắt nút Lưu / không ghi gì khi không đổi). */
export function isEditUnchanged(details: OrderDetails, edit: OrderEdit): boolean {
  return (
    details.order.source === edit.source &&
    details.order.trackingCode === edit.trackingCode &&
    details.lines.length === edit.lines.length &&
    details.lines.every((l, i) => {
      const e = edit.lines[i];
      return (
        e &&
        l.id === e.id &&
        l.name === e.name &&
        l.variant === e.variant &&
        l.quantity === e.quantity
      );
    })
  );
}
