import { useMemo } from 'react';

import type { OrderId, ReturnCaseId } from '@/core/ids';
import {
  classifyLookup,
  toCodeKey,
  useCurrentShopId,
  useOrderStore,
  validateCode,
  type MatchReason,
  type OrderDetails,
} from '@/features/orders';
import { newReturnCaseId, newReturnRecordId } from '@/platform';

import { useReturnStore } from '../data';
import {
  buildNewReturn,
  expectedLinesFromOrder,
  type Discrepancy,
  type DiscrepancyKind,
  type ExteriorSign,
  type ExpectedLine,
  type LineCondition,
  type LinkBasis,
  type MissingVideoReason,
  type NewDiscrepancy,
  type NewReceivedLine,
  type ReturnDetails,
} from '../domain';

/** Dòng đang sửa ở màn kiểm hàng (D05): giữ chuỗi nhập thô, chuyển sang bản ghi khi lưu. */
export interface EditableLine {
  readonly id: string;
  readonly name: string;
  readonly variant: string;
  readonly quantity: number | null;
  readonly condition: LineCondition | null;
  readonly note: string;
  readonly expected: ExpectedLine | null;
  readonly kinds: readonly DiscrepancyKind[];
  readonly discrepancyNote: string;
}

/** Một đơn khớp mã đang tìm, kèm lý do khớp (chỉ để người dùng phân biệt, không phải kết luận). */
export interface OrderCandidate {
  readonly details: OrderDetails;
  readonly reasons: readonly MatchReason[];
}

export type OrderLookupResult =
  | { kind: 'invalid' }
  | { kind: 'none'; code: string }
  | { kind: 'found'; code: string; candidates: readonly OrderCandidate[] };

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');

/** Chuyển các dòng đang sửa thành dòng + sai lệch để lưu (mỗi loại sai lệch đã chọn là một bản ghi). */
export function toNewLines(lines: readonly EditableLine[]): {
  lines: NewReceivedLine[];
  discrepancies: NewDiscrepancy[];
} {
  return {
    lines: lines.map((l) => ({
      id: l.id,
      name: clean(l.name),
      variant: clean(l.variant) === '' ? null : clean(l.variant),
      receivedQuantity: l.quantity,
      condition: l.condition,
      note: l.note.trim(),
      expected: l.expected,
    })),
    discrepancies: lines.flatMap((l) =>
      l.kinds.map((kind) => ({
        id: newReturnRecordId(),
        lineId: l.id,
        kind,
        note: l.discrepancyNote.trim(),
      })),
    ),
  };
}

/** Dựng dòng đang sửa từ hồ sơ đã lưu (gom sai lệch theo dòng). */
export function toEditableLines(details: ReturnDetails): EditableLine[] {
  const byLine = new Map<string, Discrepancy[]>();
  for (const d of details.discrepancies) {
    if (d.lineId === null) continue;
    byLine.set(d.lineId, [...(byLine.get(d.lineId) ?? []), d]);
  }
  return details.lines.map((l) => {
    const found = byLine.get(l.id) ?? [];
    return {
      id: l.id,
      name: l.name,
      variant: l.variant ?? '',
      quantity: l.receivedQuantity,
      condition: l.condition,
      note: l.note,
      expected: l.expected,
      kinds: found.map((d) => d.kind),
      discrepancyNote: found[0]?.note ?? '',
    };
  });
}

/**
 * Thao tác ghi của luồng hàng hoàn: gắn shop hiện tại, sinh ID, lấy giờ thiết bị. Lỗi ném `AppError`
 * (bên gọi hiển thị qua i18n `errors:`). Mọi lần ghi đều thêm lịch sử ở kho.
 */
export function useReturnOps() {
  const store = useReturnStore();
  const orderStore = useOrderStore();
  const shopId = useCurrentShopId();

  return useMemo(() => {
    const now = () => Date.now();
    return {
      loadOrder: (orderId: OrderId) => orderStore.getOrder(shopId, orderId),
      /**
       * Tra MỘT mã (mã đơn hoặc mã vận đơn) trong đơn của shop hiện tại: không có / một / nhiều. Chỉ
       * phân loại, không chọn hộ (bất biến 5): `found` luôn để người dùng xác nhận.
       */
      lookupOrders: async (rawCode: string): Promise<OrderLookupResult> => {
        const checked = validateCode(rawCode);
        if (!checked.ok) return { kind: 'invalid' };
        const key = toCodeKey(checked.code);
        const found = await orderStore.findOrdersByCodes(shopId, {
          orderCodeKey: key,
          trackingCodeKey: key,
        });
        const result = classifyLookup(found, checked.code);
        if (result.kind === 'none') return { kind: 'none', code: checked.code };
        const matches = result.kind === 'one' ? [result.match] : result.matches;
        const candidates: OrderCandidate[] = [];
        for (const match of matches) {
          const details = await orderStore.getOrder(shopId, match.order.id);
          if (details) candidates.push({ details, reasons: match.reasons });
        }
        return candidates.length === 0
          ? { kind: 'none', code: checked.code }
          : { kind: 'found', code: checked.code, candidates };
      },
      findOpenReturns: (query: { orderId?: OrderId; observedCodeKey?: string }) =>
        store.findReturns(shopId, query),
      createReturn: (params: {
        observedCode: string | null;
        source: { details: OrderDetails; basis: Exclude<LinkBasis, 'linked_later'> } | null;
      }) =>
        store.createReturn(
          buildNewReturn({
            id: newReturnCaseId(),
            shopId,
            atDevice: now(),
            observedCode: params.observedCode,
            source: params.source,
            newId: newReturnRecordId,
          }),
        ),
      linkLater: (id: ReturnCaseId, details: OrderDetails) =>
        store.linkSourceOrder(shopId, id, {
          linkId: newReturnRecordId(),
          orderId: details.order.id,
          basis: 'linked_later',
          atDevice: now(),
          eventId: newReturnRecordId(),
          expectedLines: expectedLinesFromOrder(details, newReturnRecordId),
        }),
      saveExterior: (
        id: ReturnCaseId,
        input: { signs: readonly ExteriorSign[]; note: string; openedBeforeReason: string | null },
      ) => {
        const at = now();
        return store.saveExterior(shopId, id, {
          exterior: { signs: input.signs, note: input.note.trim(), recordedAtDevice: at },
          openedBefore:
            input.openedBeforeReason === null
              ? null
              : { reason: input.openedBeforeReason.trim(), markedAtDevice: at },
          eventId: newReturnRecordId(),
          openedEventId: newReturnRecordId(),
        });
      },
      skipOpeningVideo: (id: ReturnCaseId, reason: MissingVideoReason) =>
        store.saveOpeningVideoMissing(shopId, id, {
          reason,
          atDevice: now(),
          eventId: newReturnRecordId(),
        }),
      saveLines: (id: ReturnCaseId, lines: readonly EditableLine[]) => {
        const next = toNewLines(lines);
        return store.saveLines(shopId, id, {
          ...next,
          atDevice: now(),
          eventId: newReturnRecordId(),
        });
      },
      confirm: (id: ReturnCaseId, finalNote: string) =>
        store.confirmReturn(shopId, id, {
          finalNote: finalNote.trim(),
          atDevice: now(),
          eventId: newReturnRecordId(),
        }),
    };
  }, [store, orderStore, shopId]);
}
