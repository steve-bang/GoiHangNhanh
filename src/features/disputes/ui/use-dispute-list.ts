import { useCallback, useEffect, useState } from 'react';

import type { ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useCurrentShopId } from '@/features/orders';

import { useDisputeStore } from '../data';
import type { DisputeSummary } from '../domain';

export type DisputeListState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: readonly DisputeSummary[] };

type Tagged = { shopId: ShopId; state: DisputeListState };

/** Nạp danh sách hồ sơ tranh chấp của shop hiện tại (mới cập nhật trước). */
export function useDisputeList(): { state: DisputeListState; reload: () => void } {
  const store = useDisputeStore();
  const shopId = useCurrentShopId();
  const [tagged, setTagged] = useState<Tagged>({ shopId, state: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/đổi shop/thử lại
    setTagged({ shopId, state: { kind: 'loading' } });
    store
      .listDisputes(shopId)
      .then((items) => {
        if (!cancelled) setTagged({ shopId, state: { kind: 'ready', items } });
      })
      .catch((error: unknown) => {
        logger.warn('disputes.list_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        if (!cancelled) setTagged({ shopId, state: { kind: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [store, shopId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state: tagged.shopId === shopId ? tagged.state : { kind: 'loading' }, reload };
}
