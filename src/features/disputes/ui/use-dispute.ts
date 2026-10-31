import { useCallback, useEffect, useState } from 'react';

import type { DisputeId, ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useCurrentShopId } from '@/features/orders';

import { useDisputeStore } from '../data';
import type { DisputeDetails } from '../domain';

export type DisputeState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; details: DisputeDetails };

type Tagged = { key: string; state: DisputeState };

/**
 * Nạp MỘT hồ sơ tranh chấp theo ID (tham số route) của shop hiện tại. Không thấy (kể cả hồ sơ của shop
 * khác, bất biến 8) là `missing`; lỗi đọc là `error`. `setDetails` đặt kết quả của thao tác ghi.
 */
export function useDispute(disputeId: string | undefined): {
  state: DisputeState;
  reload: () => void;
  setDetails: (details: DisputeDetails) => void;
  shopId: ShopId;
} {
  const store = useDisputeStore();
  const shopId = useCurrentShopId();
  const key = `${shopId}:${disputeId ?? ''}`;
  const [tagged, setTagged] = useState<Tagged>({ key, state: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!disputeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tham số route thiếu: báo không thấy
      setTagged({ key, state: { kind: 'missing' } });
      return undefined;
    }
    let cancelled = false;
    setTagged({ key, state: { kind: 'loading' } });
    store
      .getDispute(shopId, disputeId as DisputeId)
      .then((details) => {
        if (cancelled) return;
        setTagged({ key, state: details ? { kind: 'ready', details } : { kind: 'missing' } });
      })
      .catch((error: unknown) => {
        logger.warn('disputes.load_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        if (!cancelled) setTagged({ key, state: { kind: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [store, shopId, disputeId, key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setDetails = useCallback(
    (details: DisputeDetails) => setTagged({ key, state: { kind: 'ready', details } }),
    [key],
  );
  return {
    state: tagged.key === key ? tagged.state : { kind: 'loading' },
    reload,
    setDetails,
    shopId,
  };
}
