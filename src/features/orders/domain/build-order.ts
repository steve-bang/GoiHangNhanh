import type { OrderId, OrderLineId, PackageId, ShopId } from '@/core/ids';
import type { OrderSource } from '@/core/orders/order-source';

import {
  MAX_LINE_NAME_LENGTH,
  MAX_LINE_VARIANT_LENGTH,
  validateCode,
  validateQuantity,
  validateTrackingCode,
} from './codes';
import type { OrderDetails, OrderLine, OrderPackage } from './types';

export interface LineDraft {
  readonly name: string;
  readonly variant: string;
  readonly quantity: number;
}

export interface OrderDraft {
  readonly orderCode: string;
  readonly source: OrderSource;
  readonly trackingCode: string;
  readonly lines: readonly LineDraft[];
}

/** Bộ sinh ID đưa từ ngoài vào (domain thuần, không ngẫu nhiên). */
export interface IdFactory {
  orderId: () => OrderId;
  lineId: () => OrderLineId;
  packageId: () => PackageId;
}

export type DraftError =
  | { kind: 'invalid_code' }
  | { kind: 'invalid_tracking_code' }
  | { kind: 'invalid_quantity'; lineIndex: number }
  | { kind: 'name_required'; lineIndex: number }
  | { kind: 'name_too_long'; lineIndex: number }
  | { kind: 'variant_too_long'; lineIndex: number };

export type LineError = Extract<DraftError, { lineIndex: number }>;

/**
 * Kiểm một dòng đã cắt khoảng trắng: thiếu tên khi có variant, tên/variant quá dài (trần khớp Rules,
 * V1-04), số lượng ngoài 1..99.999. Dùng chung cho tạo và sửa đơn.
 */
export function checkLine(
  name: string,
  variant: string,
  quantity: number,
  lineIndex: number,
): LineError | { quantity: number } {
  if (name.length === 0) return { kind: 'name_required', lineIndex };
  if (name.length > MAX_LINE_NAME_LENGTH) return { kind: 'name_too_long', lineIndex };
  if (variant.length > MAX_LINE_VARIANT_LENGTH) return { kind: 'variant_too_long', lineIndex };
  const checked = validateQuantity(quantity);
  if (!checked.ok) return { kind: 'invalid_quantity', lineIndex };
  return { quantity: checked.quantity };
}

export type BuildResult = { ok: true; details: OrderDetails } | { ok: false; error: DraftError };

/**
 * Dựng đơn + dòng + kiện 1 từ bản nhập. Dòng trống hoàn toàn (không tên, không variant) bị bỏ qua;
 * dòng có variant mà không có tên là lỗi (không âm thầm bỏ dữ liệu người dùng nhập). Mỗi dòng giữ
 * nguyên, KHÔNG gộp dòng cùng tên khác variant (bất biến 10). Không có dòng nào -> đơn "Chưa khai
 * báo sản phẩm", vẫn hợp lệ (không chặn quay).
 */
export function buildOrder(
  draft: OrderDraft,
  context: { shopId: ShopId; ids: IdFactory; nowDevice: number },
): BuildResult {
  const code = validateCode(draft.orderCode);
  if (!code.ok) return { ok: false, error: { kind: 'invalid_code' } };
  const tracking = validateTrackingCode(draft.trackingCode);
  if (!tracking.ok) return { ok: false, error: { kind: 'invalid_tracking_code' } };
  const orderId = context.ids.orderId();

  const lines: OrderLine[] = [];
  for (const [lineIndex, line] of draft.lines.entries()) {
    const name = line.name.trim();
    const variant = line.variant.trim();
    if (name.length === 0 && variant.length === 0) continue;
    const checked = checkLine(name, variant, line.quantity, lineIndex);
    if ('kind' in checked) return { ok: false, error: checked };
    lines.push({
      id: context.ids.lineId(),
      orderId,
      name,
      variant: variant.length > 0 ? variant : null,
      quantity: checked.quantity,
      position: lines.length,
      dataOrigin: 'entered_by_user',
      createdAtDevice: context.nowDevice,
    });
  }

  const pkg: OrderPackage = {
    id: context.ids.packageId(),
    orderId,
    index: 1,
    createdAtDevice: context.nowDevice,
  };
  return {
    ok: true,
    details: {
      order: {
        id: orderId,
        shopId: context.shopId,
        orderCode: code.code,
        source: draft.source,
        trackingCode: tracking.code,
        dataOrigin: 'entered_by_user',
        createdAtDevice: context.nowDevice,
      },
      lines,
      packages: [pkg],
    },
  };
}

/** Kiện kế tiếp của đơn (index = lớn nhất + 1), ID riêng. */
export function buildNextPackage(
  details: OrderDetails,
  context: { ids: Pick<IdFactory, 'packageId'>; nowDevice: number },
): OrderPackage {
  const next = details.packages.reduce((max, p) => Math.max(max, p.index), 0) + 1;
  return {
    id: context.ids.packageId(),
    orderId: details.order.id,
    index: next,
    createdAtDevice: context.nowDevice,
  };
}
