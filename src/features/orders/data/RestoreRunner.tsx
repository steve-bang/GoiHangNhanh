import { useEffect } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import { logger } from '@/core/logging/logger';
import {
  getConnectivity,
  openLocalDatabase,
  subscribeAppActive,
  subscribeConnectivity,
} from '@/platform';

import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { createRestorer, RESTORE_PHASES } from '../domain/restore';
import { useCurrentShopId } from './current-shop';
import { useOrderStore } from './OrderStoreProvider';
import { useRestoreController } from './RestoreProvider';
import { createLocalRestoreStore } from './sqlite-restore-store';

/** Giãn cách thử lại khi lỗi (mỗi lượt xong rồi thì không tốn gì: chỉ đọc tiến độ trên máy). */
const RETRY_INTERVAL_MS = 60_000;

const NETWORK_CODES = ['unavailable', 'deadline-exceeded'];
const isNetworkError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === 'string' && NETWORK_CODES.some((c) => code === c || code.endsWith(`/${c}`))
  );
};

/**
 * Lấy lại dữ liệu đã lên máy chủ sau khi cài lại app hoặc đăng nhập trên máy khác (khôi phục một chiều
 * máy chủ -> máy, xem `domain/restore.ts`). Chạy ngầm, không chặn dùng app; mỗi lượt đã hoàn tất chỉ đọc
 * tiến độ trên máy, không chạm mạng. `docs = null` (cổng giả, test, thiếu cấu hình Firebase), shop cục
 * bộ tạm hoặc chưa đăng nhập thì KHÔNG làm gì. Lỗi mạng: chờ có mạng rồi chạy tiếp từ trang đang dở.
 * Thẻ tiến độ chỉ hiện khi máy còn trống hoặc đã thật sự lấy về bản ghi (máy đủ dữ liệu đối soát lặng lẽ).
 */
export function RestoreRunner({ docs }: { docs: RemoteDocuments | null }) {
  const orderStore = useOrderStore();
  const shopId = useCurrentShopId();
  const controller = useRestoreController();

  useEffect(() => {
    if (!docs || !controller || shopId === LOCAL_SHOP_ID) return undefined;
    const store = createLocalRestoreStore(openLocalDatabase);
    const restorer = createRestorer({ docs, store, now: Date.now });
    let cancelled = false;
    let running = false;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), RETRY_INTERVAL_MS);
    };

    const run = async () => {
      const uid = docs.currentUid();
      if (cancelled || running || !uid) return;
      running = true;
      clearTimeout(timer);
      let orders = 0;
      try {
        const progress = await store.readProgress(shopId, uid);
        if (RESTORE_PHASES.every((phase) => progress[phase].done)) {
          if (!cancelled && controller.get().kind !== 'done') controller.set({ kind: 'idle' });
          return; // đã khôi phục xong từ trước: không cần mạng
        }
        orders = progress.orders.imported;
        // Máy trống (chưa có đơn nào): hiện tiến độ ngay. Máy đã có dữ liệu: chỉ hiện khi thật sự lấy về.
        if (!visible) {
          const empty = (await orderStore.countOrders(shopId, {}).catch(() => 0)) === 0;
          visible = empty || orders > 0;
        }
        if (!getConnectivity().online) {
          if (!cancelled) controller.set({ kind: 'waiting_network', visible, orders });
          return;
        }
        if (!cancelled) controller.set({ kind: 'running', visible, orders });
        await restorer.run(shopId, uid, (counts) => {
          orders = counts.orders;
          if (counts.orders > 0) visible = true;
          if (!cancelled) controller.set({ kind: 'running', visible, orders });
        });
        if (!cancelled) controller.set({ kind: 'done', orders });
      } catch (error) {
        logger.warn('restore.failed', { network: isNetworkError(error) });
        if (!cancelled) {
          controller.set(
            isNetworkError(error)
              ? { kind: 'waiting_network', visible, orders }
              : { kind: 'failed', visible, orders },
          );
        }
        schedule();
      } finally {
        running = false;
      }
    };

    void run();
    const unsubscribeRetry = controller.onRetry(() => void run());
    const unsubscribeActive = subscribeAppActive(() => void run());
    let wasOnline = getConnectivity().online;
    const unsubscribeNetwork = subscribeConnectivity((value) => {
      if (value.online && !wasOnline) void run();
      wasOnline = value.online;
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribeRetry();
      unsubscribeActive();
      unsubscribeNetwork();
      controller.set({ kind: 'idle' });
    };
  }, [docs, controller, orderStore, shopId]);

  return null;
}
