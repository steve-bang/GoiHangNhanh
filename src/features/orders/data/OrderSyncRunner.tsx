import { useEffect } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import {
  getAppVersion,
  getConnectivity,
  subscribeAppActive,
  subscribeConnectivity,
} from '@/platform';

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
 *
 * Trạng thái mạng đọc thẳng từ `platform/connectivity` (cùng nguồn với hàng đợi tải lên): đổi mạng KHÔNG
 * tạo lại bộ đồng bộ (cờ `running` của thể hiện cũ sẽ mất tác dụng); có mạng lại thì đăng ngay. Mỗi lệnh
 * tới máy chủ có hạn 30 giây (`RemoteDocuments`), nên lệnh treo khi mất mạng không giữ `running` mãi.
 */
export function OrderSyncRunner({ docs }: { docs: RemoteDocuments | null }) {
  const store = useOrderStore();
  const shopId = useCurrentShopId();

  useEffect(() => {
    if (!docs || shopId === LOCAL_SHOP_ID) return undefined;
    const sync = createOrderSync({
      store,
      remote: createRemoteOrderWriter(docs, getAppVersion() ?? undefined),
      now: Date.now,
      isOnline: () => getConnectivity().online,
      currentUid: docs.currentUid,
    });
    const run = () => {
      void sync.runOnce(shopId).catch(() => undefined);
    };
    run();
    const timer = setInterval(run, SYNC_INTERVAL_MS);
    const unsubscribeActive = subscribeAppActive(run);
    let wasOnline = getConnectivity().online;
    const unsubscribeNetwork = subscribeConnectivity((value) => {
      if (value.online && !wasOnline) run();
      wasOnline = value.online;
    });
    return () => {
      clearInterval(timer);
      unsubscribeActive();
      unsubscribeNetwork();
    };
  }, [docs, store, shopId]);

  return null;
}
