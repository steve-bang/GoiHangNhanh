import { useEffect, useState } from 'react';

import type { OrderId } from '@/core/ids';
import { useCurrentShopId, useOrderStore } from '@/features/orders';

/** Mã đơn gốc đã liên kết (để hiển thị). `null` khi chưa liên kết hoặc chưa đọc được: không bịa mã. */
export function useLinkedOrderCode(orderId: OrderId | null): string | null {
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (orderId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đặt lại khi hồ sơ không còn đơn gốc
      setCode(null);
      return undefined;
    }
    let cancelled = false;
    store
      .getOrder(shopId, orderId)
      .then((found) => {
        if (!cancelled) setCode(found?.order.orderCode ?? null);
      })
      .catch(() => {
        if (!cancelled) setCode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [store, shopId, orderId]);
  return code;
}
