import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ShopId } from '@/core/ids';
import {
  useCurrentShopId,
  useCurrentUid,
  useEvidenceFileStore,
  useOrderStore,
} from '@/features/orders';
import { useReturnStore } from '@/features/returns';
import { useScreenFocused } from '@/platform';

import {
  loadEvidenceTotals,
  loadTodayStats,
  type EvidenceStatsStores,
  type EvidenceTotals,
  type TodayStats,
} from '../domain';
import { useUploadQueueControl } from '../data';

export type StatsState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly data: T };

function useEvidenceStatsStores(): EvidenceStatsStores {
  const files = useEvidenceFileStore();
  const orders = useOrderStore();
  const returns = useReturnStore();
  return useMemo(() => ({ files, orders, returns }), [files, orders, returns]);
}

/**
 * Nạp số liệu trên máy khi màn được focus và sau mỗi lượt hàng đợi tải lên (trạng thái tệp đổi). KHÔNG
 * nạp định kỳ (V1-10: tiết kiệm đọc SQLite). Đổi shop thì nạp lại; kết quả về muộn của lần cũ bị bỏ.
 * Lỗi khi đã có số: giữ số cũ (không nháy về lỗi).
 */
function useLocalStats<T>(
  load: (stores: EvidenceStatsStores, shopId: ShopId, uid: string | null) => Promise<T>,
): { readonly state: StatsState<T>; readonly reload: () => Promise<void> } {
  const stores = useEvidenceStatsStores();
  const shopId = useCurrentShopId();
  const uid = useCurrentUid();
  const focused = useScreenFocused();
  const control = useUploadQueueControl();
  const [slot, setSlot] = useState<{ key: string; state: StatsState<T> }>({
    key: shopId,
    state: { kind: 'loading' },
  });
  const request = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const data = await loadRef.current(stores, shopId, uid);
      if (ticket !== request.current) return;
      setSlot({ key: shopId, state: { kind: 'ready', data } });
    } catch {
      if (ticket !== request.current) return;
      setSlot((prev) =>
        prev.key === shopId && prev.state.kind === 'ready'
          ? prev
          : { key: shopId, state: { kind: 'error' } },
      );
    }
  }, [stores, shopId, uid]);

  useEffect(() => {
    if (!focused) return undefined;
    void reload();
    return control.subscribe(() => void reload());
  }, [focused, reload, control]);

  // Số của shop cũ không bao giờ hiện cho shop mới (bất biến 8).
  const state: StatsState<T> = slot.key === shopId ? slot.state : { kind: 'loading' };
  return { state, reload };
}

/** Ba ô "Thống kê hôm nay" của Trang chủ (giờ thiết bị). */
export function useTodayEvidenceStats() {
  return useLocalStats<TodayStats>((stores, shopId, uid) =>
    loadTodayStats(stores, shopId, uid, Date.now()),
  );
}

/** Số tệp bằng chứng của shop trên máy: tổng / trên máy / đang chờ / trên đám mây. */
export function useEvidenceTotals() {
  return useLocalStats<EvidenceTotals>((stores, shopId) => loadEvidenceTotals(stores, shopId));
}
