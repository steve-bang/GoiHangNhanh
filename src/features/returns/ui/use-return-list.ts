import { useCallback, useEffect, useState } from 'react';

import type { OrderId, ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useCurrentShopId, useOrderStore } from '@/features/orders';

import { useReturnStore } from '../data';
import type { ReturnSummary } from '../domain';

export const RETURN_LIST_LIMIT = 200;

/** Mã đơn gốc (và mã vận đơn) của các hồ sơ đã liên kết, để hiện và để tìm theo mã đơn. */
export interface LinkedOrderInfo {
  readonly orderCode: string;
  readonly trackingCode: string | null;
}

export type ReturnListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      items: readonly ReturnSummary[];
      orders: ReadonlyMap<OrderId, LinkedOrderInfo>;
    };

type Tagged = { shopId: ShopId; state: ReturnListState };

/** Nạp danh sách hồ sơ hàng hoàn của shop hiện tại (mới cập nhật trước). Lỗi đọc là `error` (có `reload`). */
export function useReturnList(): { state: ReturnListState; reload: () => void } {
  const store = useReturnStore();
  const orderStore = useOrderStore();
  const shopId = useCurrentShopId();
  const [tagged, setTagged] = useState<Tagged>({ shopId, state: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/đổi shop/thử lại
    setTagged({ shopId, state: { kind: 'loading' } });
    (async () => {
      const items = await store.listReturns(shopId, RETURN_LIST_LIMIT);
      const ids = [
        ...new Set(
          items.map((i) => i.returnCase.sourceOrderId).filter((id): id is OrderId => !!id),
        ),
      ];
      const orders = new Map<OrderId, LinkedOrderInfo>();
      for (const id of ids) {
        const found = await orderStore.getOrder(shopId, id);
        if (found) {
          orders.set(id, {
            orderCode: found.order.orderCode,
            trackingCode: found.order.trackingCode,
          });
        }
      }
      if (!cancelled) setTagged({ shopId, state: { kind: 'ready', items, orders } });
    })().catch((error: unknown) => {
      logger.warn('returns.list_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      if (!cancelled) setTagged({ shopId, state: { kind: 'error' } });
    });
    return () => {
      cancelled = true;
    };
  }, [store, orderStore, shopId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const state: ReturnListState = tagged.shopId === shopId ? tagged.state : { kind: 'loading' };
  return { state, reload };
}
