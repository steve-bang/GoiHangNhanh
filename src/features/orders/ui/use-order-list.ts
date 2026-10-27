import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ErrorCode } from '@/core/errors/codes';
import type { ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useScreenFocused } from '@/platform';

import { loadEvidenceStates, useCurrentShopId, useOrderStore } from '../data';
import {
  ORDER_LIST_PAGE_SIZE,
  summarizeOrderEvidence,
  toListQuery,
  type OrderEvidenceSummary,
  type OrderListCursor,
  type OrderListFilters,
  type OrderListItem,
  type OrderListQuery,
} from '../domain';

export interface OrderListRow {
  readonly item: OrderListItem;
  readonly evidence: OrderEvidenceSummary;
}

export interface OrderListState {
  rows: readonly OrderListRow[];
  /** Số đơn khớp bộ lọc (null khi chưa biết). */
  total: number | null;
  /** `loading`: chưa có dữ liệu lần đầu (skeleton); `error`: không có gì để hiện vì lỗi. */
  status: 'loading' | 'ready' | 'error';
  /** Đang kéo làm mới (giữ dữ liệu cũ). */
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Mã lỗi của lần nạp gần nhất; khi vẫn còn `rows` thì chỉ báo bằng dải lỗi, không xóa danh sách. */
  error: ErrorCode | null;
  /** Tải trang tiếp lỗi (danh sách đã có vẫn giữ). */
  moreError: boolean;
  refresh: () => void;
  retry: () => void;
  loadMore: () => void;
}

interface Loaded {
  items: readonly OrderListItem[];
  nextCursor: OrderListCursor | null;
  evidence: ReadonlyMap<string, OrderEvidenceSummary>;
  total: number | null;
  /** Khóa bộ lọc của dữ liệu này, để biết danh sách đang hiện có còn đúng bộ lọc hiện tại không. */
  filtersKey: string;
  /** Shop của dữ liệu này: đổi shop thì dữ liệu cũ KHÔNG được hiện (bất biến 8). */
  shopId: ShopId;
}

const READ_FAILED: ErrorCode = 'SEARCH_UNAVAILABLE';

/**
 * Nạp danh sách đơn (UI-E01) từ kho cục bộ, luôn theo shop hiện tại (bất biến 8):
 * - nạp lần đầu / đổi bộ lọc / từ khóa -> nạp lại từ trang đầu; phản hồi lỗi muộn của yêu cầu cũ bị bỏ;
 * - màn lấy lại focus (quay về từ Tạo đơn, chi tiết...) -> nạp lại ĐÚNG số thẻ đang hiện để đơn mới
 *   xuất hiện mà không đẩy người dùng về đầu danh sách;
 * - kéo làm mới -> về trang đầu, giữ dữ liệu cũ trong lúc chờ;
 * - cuộn gần cuối -> trang kế bằng con trỏ keyset; thẻ trùng ID bị loại.
 * Lỗi đọc báo `SEARCH_UNAVAILABLE`. Trạng thái bằng chứng lấy từ `loadEvidenceStates` (hiện luôn rỗng).
 */
export function useOrderList(
  filters: OrderListFilters,
  options: { pageSize?: number } = {},
): OrderListState {
  const pageSize = options.pageSize ?? ORDER_LIST_PAGE_SIZE;
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const focused = useScreenFocused();
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const [loadedAny, setLoaded] = useState<Loaded | null>(null);
  // Dữ liệu của shop khác coi như chưa có: suy ra khi render nên không có khung hình nào lộ thẻ của shop cũ.
  const loaded = loadedAny?.shopId === shopId ? loadedAny : null;
  const [failed, setFailed] = useState<ErrorCode | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const loadedRef = useRef<Loaded | null>(null);
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);
  /** Mỗi lần nạp lại tăng số này; kết quả của yêu cầu cũ hơn bị bỏ. */
  const generation = useRef(0);
  /** Truy vấn của lần nạp đầu trang hiện tại: các trang sau dùng lại đúng nó (mốc thời gian không trôi). */
  const queryRef = useRef<OrderListQuery>({});
  const moreInFlight = useRef(false);

  const reload = useCallback(
    async (mode: 'filters' | 'focus' | 'pull' | 'retry', current: OrderListFilters) => {
      generation.current += 1;
      const mine = generation.current;
      const key = JSON.stringify(current);
      const query = toListQuery(current, Date.now());
      // Quay lại màn: nạp lại đúng số thẻ đang hiện (nếu bộ lọc không đổi) để không mất vị trí cuộn.
      const shown = loadedRef.current;
      const keep = mode === 'focus' && shown && shown.filtersKey === key ? shown.items.length : 0;
      const limit = Math.max(pageSize, keep);
      moreInFlight.current = false; // một lần tải trang tiếp đang bay sẽ bị bỏ (generation đã đổi)
      setLoadingMore(false);
      if (mode === 'pull') setRefreshing(true);
      try {
        const [page, total] = await Promise.all([
          store.listOrders(shopId, query, { limit }),
          store.countOrders(shopId, query),
        ]);
        const states = await loadEvidenceStates(
          shopId,
          page.items.map((i) => i.order.id),
        );
        if (mine !== generation.current) return;
        queryRef.current = query;
        setMoreError(false);
        setFailed(null);
        setLoaded({
          items: page.items,
          nextCursor: page.nextCursor,
          evidence: new Map(
            page.items.map((i) => [
              i.order.id,
              summarizeOrderEvidence(states.get(i.order.id) ?? []),
            ]),
          ),
          total,
          filtersKey: key,
          shopId,
        });
      } catch (caught) {
        if (mine !== generation.current) return;
        logger.warn('orders.list_failed', {
          reason: caught instanceof Error ? caught.name : 'unknown',
        });
        // Danh sách đang hiện thuộc bộ lọc khác thì bỏ đi: không để thẻ cũ nằm dưới bộ lọc mới.
        if (loadedRef.current && loadedRef.current.filtersKey !== key) {
          loadedRef.current = null;
          setLoaded(null);
        }
        setFailed(READ_FAILED);
      } finally {
        if (mine === generation.current) setRefreshing(false);
      }
    },
    [pageSize, shopId, store],
  );

  // Nạp khi mở màn, khi đổi bộ lọc/từ khóa, và mỗi khi màn lấy lại focus.
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!focused) return;
    const mode = lastKey.current === null || lastKey.current !== filtersKey ? 'filters' : 'focus';
    lastKey.current = filtersKey;
    void reload(mode, filters);
    // `filters` đi cùng `filtersKey`: chỉ nạp lại khi nội dung bộ lọc đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, focused, reload]);

  const loadMore = useCallback(() => {
    const current = loadedRef.current;
    if (!current?.nextCursor || moreInFlight.current || current.filtersKey !== filtersKey) {
      return;
    }
    moreInFlight.current = true;
    setLoadingMore(true);
    setMoreError(false);
    const mine = generation.current;
    const cursor = current.nextCursor;
    void (async () => {
      try {
        const page = await store.listOrders(shopId, queryRef.current, {
          limit: pageSize,
          after: cursor,
        });
        const states = await loadEvidenceStates(
          shopId,
          page.items.map((i) => i.order.id),
        );
        if (mine !== generation.current) return;
        setLoaded((prev) => {
          if (!prev) return prev;
          const seen = new Set(prev.items.map((i) => i.order.id));
          const fresh = page.items.filter((i) => !seen.has(i.order.id));
          return {
            ...prev,
            items: [...prev.items, ...fresh],
            nextCursor: page.nextCursor,
            evidence: new Map([
              ...prev.evidence,
              ...fresh.map((i): [string, OrderEvidenceSummary] => [
                i.order.id,
                summarizeOrderEvidence(states.get(i.order.id) ?? []),
              ]),
            ]),
          };
        });
      } catch (caught) {
        if (mine !== generation.current) return;
        logger.warn('orders.list_more_failed', {
          reason: caught instanceof Error ? caught.name : 'unknown',
        });
        setMoreError(true);
      } finally {
        if (mine === generation.current) {
          moreInFlight.current = false;
          setLoadingMore(false);
        }
      }
    })();
  }, [filtersKey, pageSize, shopId, store]);

  const rows = useMemo<readonly OrderListRow[]>(
    () =>
      (loaded?.items ?? []).map((item) => ({
        item,
        evidence: loaded?.evidence.get(item.order.id) ?? { kind: 'none' },
      })),
    [loaded],
  );

  // Dữ liệu đang giữ khác bộ lọc hiện tại (vừa gõ xong, đang nạp) vẫn hiện tới khi có kết quả mới.
  return {
    rows,
    total: loaded?.total ?? null,
    status: loaded ? 'ready' : failed ? 'error' : 'loading',
    refreshing,
    loadingMore,
    hasMore: loaded?.nextCursor != null,
    error: failed,
    moreError,
    refresh: () => void reload('pull', filters),
    retry: () => void reload('retry', filters),
    loadMore,
  };
}
