import { useEffect, useState } from 'react';

import type { OrderId, ReturnCaseId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useCurrentShopId, useOrderStore } from '@/features/orders';
import { hasOpeningEvidenceLimit, useReturnStore } from '@/features/returns';

import type { DisputeSubject } from '../domain';

export type SubjectState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; subject: DisputeSubject };

/**
 * Đối tượng tranh chấp từ tham số route (`orderId` hoặc `returnId`), đọc từ kho của shop hiện tại.
 * Không có tham số = `none` (người dùng sẽ chọn). ID sai/của shop khác = `missing`. Nhãn là mã chụp lại
 * để hiển thị; liên kết luôn bằng ID (bất biến 1).
 */
export function useDisputeSubject(params: {
  orderId: string | undefined;
  returnId: string | undefined;
}): SubjectState {
  const orders = useOrderStore();
  const returns = useReturnStore();
  const shopId = useCurrentShopId();
  const { orderId, returnId } = params;
  const wanted = Boolean(orderId || returnId);
  const [state, setState] = useState<SubjectState>(wanted ? { kind: 'loading' } : { kind: 'none' });

  useEffect(() => {
    if (!orderId && !returnId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- không có tham số route: để người dùng chọn
      setState({ kind: 'none' });
      return undefined;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    (async (): Promise<SubjectState> => {
      if (returnId) {
        const found = await returns.getReturn(shopId, returnId as ReturnCaseId);
        if (!found) return { kind: 'missing' };
        const rc = found.returnCase;
        return {
          kind: 'ready',
          subject: {
            kind: 'return',
            returnId: rc.id,
            label: rc.code,
            orderId: rc.sourceOrderId,
            openingEvidenceLimit: hasOpeningEvidenceLimit(rc),
          },
        };
      }
      const found = await orders.getOrder(shopId, orderId as OrderId);
      return found
        ? {
            kind: 'ready',
            subject: { kind: 'order', orderId: found.order.id, label: found.order.orderCode },
          }
        : { kind: 'missing' };
    })()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((error: unknown) => {
        logger.warn('disputes.subject_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [orders, returns, shopId, orderId, returnId]);

  return state;
}
