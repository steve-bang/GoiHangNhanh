import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useCurrentShopId,
  useCurrentUid,
  useEvidenceFileStore,
  useOrderStore,
} from '@/features/orders';
import { useReturnStore } from '@/features/returns';
import { useScreenFocused } from '@/platform';

import {
  DONE_LIST_LIMIT,
  DONE_SYNC_STATES,
  loadRecentSyncJobs,
  loadSyncJobs,
  PENDING_SYNC_STATES,
  type SyncJob,
  type SyncJobStores,
} from '../domain';
import { useUploadQueueControl } from '../data';

/** Đọc lại khi màn đang mở (trạng thái `uploading` đổi giữa một lượt chạy dài). Chỉ đọc SQLite trên máy. */
const REFRESH_MS = 10_000;

export type SyncJobsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | {
      readonly kind: 'ready';
      /** Tệp còn việc đồng bộ/lỗi (mọi bộ lọc trừ "Đã tải lên"). */
      readonly pending: readonly SyncJob[];
      /** Tệp máy chủ đã nhận, mới nhất trước, tối đa `DONE_LIST_LIMIT`; `null` = chưa nạp. */
      readonly done: readonly SyncJob[] | null;
      readonly doneTotal: number;
      /** Giờ THIẾT BỊ lúc nạp (để biết tệp `uploaded` đã chờ xác minh bao lâu). */
      readonly loadedAt: number;
    };

export function useSyncJobStores(): SyncJobStores {
  const files = useEvidenceFileStore();
  const orders = useOrderStore();
  const returns = useReturnStore();
  return useMemo(() => ({ files, orders, returns }), [files, orders, returns]);
}

/**
 * Danh sách tệp của Trung tâm đồng bộ cho shop đang dùng. Đọc khi màn được mở, sau mỗi lượt hàng đợi,
 * mỗi `REFRESH_MS` khi màn đang hiển thị, và khi gọi `reload`. `includeDone` nạp thêm nhóm "Đã tải lên"
 * (chỉ khi chọn bộ lọc đó, vì nhóm này lớn dần theo thời gian).
 */
export function useSyncJobs(includeDone: boolean) {
  const stores = useSyncJobStores();
  const shopId = useCurrentShopId();
  const uid = useCurrentUid();
  const focused = useScreenFocused();
  const control = useUploadQueueControl();
  const [state, setState] = useState<SyncJobsState>({ kind: 'loading' });
  const request = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const pending = await loadSyncJobs(stores, shopId, uid, PENDING_SYNC_STATES);
      let done: SyncJob[] | null = null;
      let doneTotal = 0;
      if (includeDone) {
        const recent = await loadRecentSyncJobs(
          stores,
          shopId,
          uid,
          DONE_SYNC_STATES,
          DONE_LIST_LIMIT,
        );
        done = recent.jobs;
        doneTotal = recent.total;
      }
      if (ticket !== request.current) return;
      setState({ kind: 'ready', pending, done, doneTotal, loadedAt: Date.now() });
    } catch {
      if (ticket !== request.current) return;
      // Lỗi khi đọc lại: giữ danh sách cũ (không làm mất những gì người dùng đang xem).
      setState((prev) => (prev.kind === 'ready' ? prev : { kind: 'error' }));
    }
  }, [stores, shopId, uid, includeDone]);

  useEffect(() => {
    if (!focused) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/lấy lại focus
    void reload();
    const timer = setInterval(() => void reload(), REFRESH_MS);
    const unsubscribe = control.subscribe(() => void reload());
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [focused, reload, control]);

  return { state, reload };
}
