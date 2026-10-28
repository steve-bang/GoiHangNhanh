import { useEffect, useMemo } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import { getAppVersion, subscribeAppActive, useIsOffline } from '@/platform';

import { createOrderSync } from '../domain/order-sync';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { useCurrentShopId } from './current-shop';
import { useOrderStore } from './OrderStoreProvider';
import { createRemoteOrderWriter } from './remote-order-writer';

/** Giãn cách giữa các lượt đăng khi app mở (mỗi lượt chỉ chạm mạng nếu có việc cần đăng). */
const SYNC_INTERVAL_MS = 60_000;

/**
 * Chạy đồng bộ đơn/phiên lên máy chủ (ADR-019): ngay khi gắn, khi app trở lại foreground và định kỳ.
 * `docs = null` (cổng giả, test, thiếu cấu hình Firebase) thì KHÔNG làm gì. Shop cục bộ tạm
 * (`LOCAL_SHOP_ID`, chưa có shop thật) không bao giờ đăng. Không hiển thị gì và nuốt mọi lỗi: lượt sau
 * thử lại, trạng thái "đã đăng" chỉ được ghi sau khi máy chủ nhận.
 */
export function OrderSyncRunner({ docs }: { docs: RemoteDocuments | null }) {
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const offline = useIsOffline();

  const sync = useMemo(
    () =>
      docs
        ? createOrderSync({
            store,
            remote: createRemoteOrderWriter(docs, getAppVersion() ?? undefined),
            now: Date.now,
            isOnline: () => !offline,
            currentUid: docs.currentUid,
          })
        : null,
    [docs, store, offline],
  );

  useEffect(() => {
    if (!sync || shopId === LOCAL_SHOP_ID) return undefined;
    const run = () => {
      void sync.runOnce(shopId).catch(() => undefined);
    };
    run();
    const timer = setInterval(run, SYNC_INTERVAL_MS);
    const unsubscribe = subscribeAppActive(run);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [sync, shopId]);

  return null;
}
