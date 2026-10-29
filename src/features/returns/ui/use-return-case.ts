import { useCallback, useEffect, useState } from 'react';

import type { ReturnCaseId, ShopId } from '@/core/ids';
import { useCurrentShopId } from '@/features/orders';
import { logger } from '@/core/logging/logger';

import { useReturnStore } from '../data';
import type { ReturnDetails } from '../domain';

export type ReturnCaseState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; details: ReturnDetails };

type Tagged = { key: string; state: ReturnCaseState };

/**
 * Nạp MỘT hồ sơ hàng hoàn theo ID (tham số route) của shop hiện tại. Không có ID hoặc không thấy hồ
 * sơ (kể cả hồ sơ của shop khác, bất biến 8) là `missing`; lỗi đọc là `error` (có `reload`). Kết quả
 * của yêu cầu cũ hoặc của shop khác bị bỏ.
 */
export function useReturnCase(returnId: string | undefined): {
  state: ReturnCaseState;
  reload: () => void;
  /** Đặt hồ sơ vừa lưu (kết quả của thao tác ghi) để màn khác cập nhật ngay, không đọc lại. */
  setDetails: (details: ReturnDetails) => void;
  shopId: ShopId;
} {
  const store = useReturnStore();
  const shopId = useCurrentShopId();
  const key = `${shopId}:${returnId ?? ''}`;
  const [tagged, setTagged] = useState<Tagged>({ key, state: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!returnId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tham số route thiếu: báo không thấy hồ sơ
      setTagged({ key, state: { kind: 'missing' } });
      return undefined;
    }
    let cancelled = false;
    setTagged({ key, state: { kind: 'loading' } });
    store
      .getReturn(shopId, returnId as ReturnCaseId)
      .then((details) => {
        if (cancelled) return;
        setTagged({ key, state: details ? { kind: 'ready', details } : { kind: 'missing' } });
      })
      .catch((error: unknown) => {
        logger.warn('returns.load_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        if (!cancelled) setTagged({ key, state: { kind: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [store, shopId, returnId, key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setDetails = useCallback(
    (details: ReturnDetails) => setTagged({ key, state: { kind: 'ready', details } }),
    [key],
  );
  const state: ReturnCaseState = tagged.key === key ? tagged.state : { kind: 'loading' };
  return { state, reload, setDetails, shopId };
}
