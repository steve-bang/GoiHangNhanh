import { useCallback, useEffect, useState } from 'react';

import { logger } from '@/core/logging/logger';

import { useCurrentShopId, useOrderStore } from '../data';
import { MAX_RECENT_SEARCHES, type RecentSearch } from '../domain';

/**
 * Lịch sử tìm gần đây của shop hiện tại (cục bộ, Q-22f/u). Lỗi đọc/ghi chỉ log: lịch sử là tiện ích,
 * không được chặn việc tìm. Đổi shop thì đọc lại và không hiện mục của shop cũ.
 */
export function useRecentSearches() {
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const [loaded, setLoaded] = useState<{ shopId: string; items: readonly RecentSearch[] } | null>(
    null,
  );

  const reload = useCallback(async () => {
    try {
      const items = await store.listRecentSearches(shopId, MAX_RECENT_SEARCHES);
      setLoaded({ shopId, items });
    } catch {
      logger.warn('orders.recent_searches_failed');
    }
  }, [shopId, store]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/đổi shop
    void reload();
  }, [reload]);

  const items = loaded?.shopId === shopId ? loaded.items : [];
  return {
    items,
    record: async (text: string) => {
      try {
        await store.recordSearch(shopId, text, Date.now());
        await reload();
      } catch {
        logger.warn('orders.recent_search_record_failed');
      }
    },
    remove: async (text: string) => {
      try {
        await store.removeRecentSearch(shopId, text);
        await reload();
      } catch {
        logger.warn('orders.recent_search_remove_failed');
      }
    },
    clear: async () => {
      try {
        await store.clearRecentSearches(shopId);
        await reload();
      } catch {
        logger.warn('orders.recent_search_clear_failed');
      }
    },
  };
}
