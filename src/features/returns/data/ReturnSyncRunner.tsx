import { useEffect, useRef } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import { LOCAL_SHOP_ID, useCurrentShopId } from '@/features/orders';
import { getAppVersion, subscribeAppActive, useIsOffline } from '@/platform';

import { createReturnSync } from '../domain/return-sync';
import { createRemoteReturnWriter } from './remote-return-writer';
import { useReturnStore } from './ReturnStoreProvider';

/** Giãn cách giữa các lượt đăng khi app mở (mỗi lượt chỉ chạm mạng nếu có hồ sơ cần đăng). */
const SYNC_INTERVAL_MS = 60_000;

/**
 * Đăng bản "neo" hồ sơ hàng hoàn lên máy chủ (Q-28) để ảnh/video của hồ sơ tải lên được: ngay khi gắn,
 * khi app trở lại foreground, khi có mạng lại và định kỳ. `docs = null` (cổng giả, test, thiếu cấu hình
 * Firebase) thì KHÔNG làm gì; shop cục bộ tạm không bao giờ đăng. Không hiển thị gì và nuốt mọi lỗi
 * (lượt sau thử lại; dấu "đã đăng" chỉ ghi sau khi máy chủ nhận). Trạng thái mạng đọc qua ref để đổi
 * mạng KHÔNG tạo lại bộ đồng bộ (cờ `running` của thể hiện cũ sẽ mất tác dụng).
 */
export function ReturnSyncRunner({ docs }: { docs: RemoteDocuments | null }) {
  const store = useReturnStore();
  const shopId = useCurrentShopId();
  const offline = useIsOffline();
  const offlineRef = useRef(offline);
  const runRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  useEffect(() => {
    if (!docs || shopId === LOCAL_SHOP_ID) return undefined;
    const sync = createReturnSync({
      store,
      remote: createRemoteReturnWriter(docs, getAppVersion() ?? undefined),
      now: Date.now,
      isOnline: () => !offlineRef.current,
      currentUid: docs.currentUid,
    });
    const run = () => {
      void sync.runOnce(shopId).catch(() => undefined);
    };
    runRef.current = run;
    run();
    const timer = setInterval(run, SYNC_INTERVAL_MS);
    const unsubscribe = subscribeAppActive(run);
    return () => {
      clearInterval(timer);
      unsubscribe();
      runRef.current = null;
    };
  }, [docs, store, shopId]);

  // Có mạng lại: đăng ngay thay vì đợi chu kỳ kế tiếp (lượt đang chạy thì bỏ qua, `busy`).
  useEffect(() => {
    if (!offline) runRef.current?.();
  }, [offline]);

  return null;
}
