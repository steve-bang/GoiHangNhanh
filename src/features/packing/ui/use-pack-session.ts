import { useEffect, useState } from 'react';

import type { SessionId } from '@/core/ids';
import { useCurrentShopId, useOrderStore, type PackingSession } from '@/features/orders';
import { useRouteParams } from '@/platform';

/**
 * Đọc phiên theo `sessionId` trên tham số route (không nhận mã đơn qua tham số; bất biến 2). Mã đơn
 * hiển thị lấy từ ảnh chụp của phiên. `null`: không có/không đọc được phiên.
 */
export function usePackSession(): PackingSession | null | 'loading' {
  const params = useRouteParams();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const sessionId = params.sessionId as SessionId | undefined;
  const [session, setSession] = useState<PackingSession | null | 'loading'>('loading');
  useEffect(() => {
    let alive = true;
    const load = sessionId ? store.getSession(shopId, sessionId) : Promise.resolve(null);
    load.then((found) => alive && setSession(found)).catch(() => alive && setSession(null));
    return () => {
      alive = false;
    };
  }, [sessionId, shopId, store]);
  return session;
}
