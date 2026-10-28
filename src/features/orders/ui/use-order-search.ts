import { useEffect, useRef, useState } from 'react';

import type { ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';

import { loadEvidenceStates, useCurrentShopId, useOrderStore } from '../data';
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_RESULT_LIMIT,
  normalizeSearchInput,
  summarizeOrderEvidence,
  type OrderEvidenceSummary,
  type OrderListItem,
} from '../domain';

export interface SearchRow {
  readonly item: OrderListItem;
  readonly evidence: OrderEvidenceSummary;
}

export type SearchState =
  | { kind: 'idle' } // chưa đủ ký tự: KHÔNG truy vấn
  | { kind: 'loading' }
  | { kind: 'results'; rows: readonly SearchRow[]; truncated: boolean }
  | { kind: 'empty' }
  | { kind: 'error' };

interface Tagged {
  shopId: ShopId;
  key: string;
  state: SearchState;
}

/**
 * Tìm đơn theo chuỗi con của mã đơn/mã vận đơn (UI-B03): chờ `SEARCH_DEBOUNCE_MS` sau lần gõ cuối, bỏ
 * kết quả của yêu cầu cũ (hủy theo khóa + cờ `cancelled`), không truy vấn chuỗi rỗng/quá ngắn. Kết quả
 * của shop khác hoặc của chuỗi khác không bao giờ hiện (suy ra lúc render).
 */
export function useOrderSearch(input: string, retryToken: number): SearchState {
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const normalized = normalizeSearchInput(input);
  const key = normalized?.key ?? null;
  const [tagged, setTagged] = useState<Tagged | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    seq.current += 1;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const page = await store.listOrders(
            shopId,
            { searchKey: key },
            { limit: SEARCH_RESULT_LIMIT + 1 },
          );
          const items = page.items.slice(0, SEARCH_RESULT_LIMIT);
          const states = await loadEvidenceStates(
            shopId,
            items.map((i) => i.order.id),
          );
          if (cancelled) return;
          const rows = items.map((item) => ({
            item,
            evidence: summarizeOrderEvidence(states.get(item.order.id) ?? []),
          }));
          setTagged({
            shopId,
            key,
            state:
              rows.length === 0
                ? { kind: 'empty' }
                : { kind: 'results', rows, truncated: page.items.length > SEARCH_RESULT_LIMIT },
          });
        } catch (caught) {
          logger.warn('orders.search_failed', {
            reason: caught instanceof Error ? 'error' : 'unknown',
          });
          if (!cancelled) setTagged({ shopId, key, state: { kind: 'error' } });
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, shopId, store, retryToken]);

  if (key === null) return { kind: 'idle' };
  if (tagged && tagged.shopId === shopId && tagged.key === key) return tagged.state;
  return { kind: 'loading' };
}
