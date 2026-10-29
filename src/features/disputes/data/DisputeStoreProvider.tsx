import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCurrentUid } from '@/features/orders';
import { openLocalDatabase } from '@/platform';

import type { DisputeStore } from '../domain/dispute-store';
import { createLocalDisputeStore } from './create-dispute-store';

const DisputeStoreContext = createContext<DisputeStore | null>(null);

/** Cung cấp kho hồ sơ tranh chấp cục bộ. Test truyền `store` (kho bộ nhớ riêng của bài test). */
export function DisputeStoreProvider({
  store,
  children,
}: {
  store?: DisputeStore;
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
    () => store ?? createLocalDisputeStore(openLocalDatabase, { creatorUid: holder.get }),
    [store, holder],
  );
  return <DisputeStoreContext.Provider value={value}>{children}</DisputeStoreContext.Provider>;
}

export function useDisputeStore(): DisputeStore {
  const store = useContext(DisputeStoreContext);
  if (!store) {
    throw new Error('useDisputeStore cần DisputeStoreProvider (src/bootstrap/Providers.tsx)');
  }
  return store;
}
