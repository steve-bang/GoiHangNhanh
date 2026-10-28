import { useCallback, useRef, useState } from 'react';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';

import { loadEvidenceStates, useCurrentShopId, useOrderStore } from '../data';
import {
  classifyLookup,
  summarizeOrderEvidence,
  toCodeKey,
  type MatchReason,
  type Order,
  type OrderEvidenceSummary,
} from '../domain';

/** Một đơn khớp mã, kèm thông tin để phân biệt (sản phẩm đầu, nhãn bằng chứng mức đơn). */
export interface LookupRow {
  readonly order: Order;
  readonly reasons: readonly MatchReason[];
  readonly firstLine: { name: string; variant: string | null; quantity: number } | null;
  readonly lineCount: number;
  readonly evidence: OrderEvidenceSummary;
}

export type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading'; code: string }
  | { kind: 'none'; code: string }
  | { kind: 'one'; code: string; row: LookupRow }
  | { kind: 'many'; code: string; rows: readonly LookupRow[] }
  | { kind: 'error'; code: string; errorCode: ErrorCode };

type Tagged = { shopId: ShopId; state: LookupState };

/**
 * Tra cứu MỘT mã (quét, nhập tay, tìm) trong kho cục bộ của shop hiện tại bằng MỘT truy vấn
 * `findOrdersByCodes` (mã có thể là mã đơn hoặc mã vận đơn). Không tạo đơn, không chọn hộ: kết quả chỉ
 * là `none | one | many` (đặc tả A02). Yêu cầu cũ bị bỏ (số thế hệ), kết quả của shop khác không hiện
 * (bất biến 8), lỗi đọc giữ nguyên mã để Thử lại.
 */
export function useOrderLookup(): {
  state: LookupState;
  lookup: (code: string) => Promise<LookupState>;
  reset: () => void;
} {
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const [tagged, setTagged] = useState<Tagged>({ shopId, state: { kind: 'idle' } });
  const generation = useRef(0);

  const lookup = useCallback(
    async (rawCode: string): Promise<LookupState> => {
      generation.current += 1;
      const mine = generation.current;
      const code = rawCode.trim();
      const set = (state: LookupState) => {
        if (mine === generation.current) setTagged({ shopId, state });
        return state;
      };
      set({ kind: 'loading', code });
      try {
        const key = toCodeKey(code);
        const found = await store.findOrdersByCodes(shopId, {
          orderCodeKey: key,
          trackingCodeKey: key,
        });
        const result = classifyLookup(found, code);
        if (result.kind === 'none') return set({ kind: 'none', code });
        const matches = result.kind === 'one' ? [result.match] : result.matches;
        const states = await loadEvidenceStates(
          shopId,
          matches.map((m) => m.order.id),
        );
        const rows: LookupRow[] = [];
        for (const match of matches) {
          const details = await store.getOrder(shopId, match.order.id);
          const first = details?.lines[0];
          rows.push({
            order: match.order,
            reasons: match.reasons,
            firstLine: first
              ? { name: first.name, variant: first.variant, quantity: first.quantity }
              : null,
            lineCount: details?.lines.length ?? 0,
            evidence: summarizeOrderEvidence(states.get(match.order.id) ?? []),
          });
        }
        const [only] = rows;
        return set(
          rows.length === 1 && only
            ? { kind: 'one', code, row: only }
            : { kind: 'many', code, rows },
        );
      } catch (caught) {
        logger.warn('orders.lookup_failed', {
          reason: isAppError(caught) ? caught.code : 'unknown',
        });
        return set({ kind: 'error', code, errorCode: 'SEARCH_UNAVAILABLE' });
      }
    },
    [shopId, store],
  );

  const reset = useCallback(() => {
    generation.current += 1;
    setTagged({ shopId, state: { kind: 'idle' } });
  }, [shopId]);

  // Kết quả của shop khác coi như chưa có.
  const state: LookupState = tagged.shopId === shopId ? tagged.state : { kind: 'idle' };
  return { state, lookup, reset };
}
