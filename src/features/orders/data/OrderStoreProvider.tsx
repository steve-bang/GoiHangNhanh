import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { openLocalDatabase } from '@/platform';

import type { OrderStore } from '../domain/order-store';
import { createLocalOrderStore } from './create-order-store';

const OrderStoreContext = createContext<OrderStore | null>(null);

/** Cung cấp kho đơn cục bộ. Test truyền `store` (kho bộ nhớ riêng của bài test). */
export function OrderStoreProvider({
  store,
  children,
}: {
  store?: OrderStore;
  children: ReactNode;
}) {
  const value = useMemo(() => store ?? createLocalOrderStore(openLocalDatabase), [store]);
  return <OrderStoreContext.Provider value={value}>{children}</OrderStoreContext.Provider>;
}

export function useOrderStore(): OrderStore {
  const store = useContext(OrderStoreContext);
  if (!store) throw new Error('useOrderStore cần OrderStoreProvider (src/bootstrap/Providers.tsx)');
  return store;
}
