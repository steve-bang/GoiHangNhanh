import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { openLocalDatabase } from '@/platform';

import type { OrderStore } from '../domain/order-store';
import { createLocalOrderStore } from './create-order-store';
import { useCurrentUid } from './current-shop';

const OrderStoreContext = createContext<OrderStore | null>(null);

/** Cung cấp kho đơn cục bộ. Test truyền `store` (kho bộ nhớ riêng của bài test). */
export function OrderStoreProvider({
  store,
  children,
}: {
  store?: OrderStore;
  children: ReactNode;
}) {
  // Kho đọc uid MỖI LẦN lưu (không đóng băng lúc tạo kho): đổi tài khoản thì bản ghi mới mang uid mới.
  const uid = useCurrentUid();
  const [holder] = useState(() => {
    let current: string | null = uid;
    return { get: () => current, set: (next: string | null) => void (current = next) };
  });
  useEffect(() => holder.set(uid), [holder, uid]);
  const value = useMemo(
    () => store ?? createLocalOrderStore(openLocalDatabase, { creatorUid: holder.get }),
    [store, holder],
  );
  return <OrderStoreContext.Provider value={value}>{children}</OrderStoreContext.Provider>;
}

export function useOrderStore(): OrderStore {
  const store = useContext(OrderStoreContext);
  if (!store) throw new Error('useOrderStore cần OrderStoreProvider (src/bootstrap/Providers.tsx)');
  return store;
}
