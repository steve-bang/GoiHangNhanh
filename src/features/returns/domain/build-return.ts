import type { ReturnCaseId, ShopId } from '@/core/ids';
import type { OrderDetails } from '@/features/orders';

import type { LinkInput, NewReceivedLine, NewReturnInput } from './return-store';
import type { LinkBasis } from './types';

/** Sinh ID cho bản ghi con. Truyền vào để miền thuần TypeScript và test xác định được. */
export type RecordIdFactory = () => string;

/**
 * Nạp dòng dự kiến từ đơn gốc: mỗi dòng của đơn thành một dòng nhận về với BẢN SAO dữ liệu dự kiến
 * (sửa đơn sau đó không làm đổi) và số lượng thực nhận để TRỐNG (không mặc định bằng dự kiến; không
 * tự kết luận). Hai variant khác nhau là hai dòng riêng (docs/02).
 */
export function expectedLinesFromOrder(
  details: OrderDetails,
  newId: RecordIdFactory,
): NewReceivedLine[] {
  return [...details.lines]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      id: newId(),
      name: line.name,
      variant: line.variant,
      receivedQuantity: null,
      condition: null,
      note: '',
      expected: {
        orderLineId: line.id,
        name: line.name,
        variant: line.variant,
        quantity: line.quantity,
      },
    }));
}

/** Dòng trống do người dùng tự thêm (hàng ngoài dự kiến, hoặc hồ sơ chưa liên kết đơn). */
export function blankReceivedLine(newId: RecordIdFactory): NewReceivedLine {
  return {
    id: newId(),
    name: '',
    variant: null,
    receivedQuantity: null,
    condition: null,
    note: '',
    expected: null,
  };
}

export interface BuildNewReturnParams {
  readonly id: ReturnCaseId;
  readonly shopId: ShopId;
  readonly atDevice: number;
  readonly observedCode: string | null;
  readonly source: { details: OrderDetails; basis: Exclude<LinkBasis, 'linked_later'> } | null;
  readonly newId: RecordIdFactory;
}

export function buildNewReturn(params: BuildNewReturnParams): NewReturnInput {
  const { id, shopId, atDevice, observedCode, source, newId } = params;
  const link: LinkInput | null = source
    ? { linkId: newId(), orderId: source.details.order.id, basis: source.basis }
    : null;
  return {
    id,
    shopId,
    atDevice,
    eventId: newId(),
    observedCode,
    link,
    lines: source ? expectedLinesFromOrder(source.details, newId) : [],
  };
}
