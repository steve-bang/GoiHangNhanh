import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCurrentUid } from '@/features/orders';
import { openLocalDatabase } from '@/platform';

import type { ReturnStore } from '../domain/return-store';
import { createLocalReturnStore } from './create-return-store';

const ReturnStoreContext = createContext<ReturnStore | null>(null);

/** Cung cấp kho hồ sơ hàng hoàn cục bộ. Test truyền `store` (kho bộ nhớ riêng của bài test). */
export function ReturnStoreProvider({
  store,
  children,
}: {
  store?: ReturnStore;
  children: ReactNode;
}) {
  // Đọc uid MỖI LẦN lưu (không đóng băng lúc tạo kho), như kho đơn.
  const uid = useCurrentUid();
  const [holder] = useState(() => {
    let current: string | null = uid;
    return { get: () => current, set: (next: string | null) => void (current = next) };
  });
  useEffect(() => holder.set(uid), [holder, uid]);
  const value = useMemo(
    () => store ?? createLocalReturnStore(openLocalDatabase, { creatorUid: holder.get }),
    [store, holder],
  );
  return <ReturnStoreContext.Provider value={value}>{children}</ReturnStoreContext.Provider>;
}

export function useReturnStore(): ReturnStore {
  const store = useContext(ReturnStoreContext);
  if (!store) {
    throw new Error('useReturnStore cần ReturnStoreProvider (src/bootstrap/Providers.tsx)');
  }
  return store;
}
