import type { ReactNode } from 'react';

import { CurrentShopProvider } from '@/features/orders';

import { useSession } from './SessionProvider';

/**
 * Nối shop của phiên vào `useCurrentShopId()` của feature orders (bất biến 8: mọi truy vấn theo shop
 * của phiên). Phải nằm trong `SessionProvider`. Phiên chưa biết shop thì orders dùng `LOCAL_SHOP_ID`.
 */
export function SessionShopProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  return (
    <CurrentShopProvider shopId={session.state.shopId} uid={session.state.user?.uid ?? null}>
      {children}
    </CurrentShopProvider>
  );
}
