import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { EvidenceFileStore } from '@/features/evidence';
import { openLocalDatabase } from '@/platform';

import { createLocalEvidenceFileStore } from './create-evidence-file-store';

const EvidenceFileStoreContext = createContext<EvidenceFileStore | null>(null);

/** Cung cấp kho tệp bằng chứng cục bộ. Test truyền `store` (kho bộ nhớ riêng của bài test). */
export function EvidenceFileStoreProvider({
  store,
  children,
}: {
  store?: EvidenceFileStore;
  children: ReactNode;
}) {
  const value = useMemo(() => store ?? createLocalEvidenceFileStore(openLocalDatabase), [store]);
  return (
    <EvidenceFileStoreContext.Provider value={value}>{children}</EvidenceFileStoreContext.Provider>
  );
}

export function useEvidenceFileStore(): EvidenceFileStore {
  const store = useContext(EvidenceFileStoreContext);
  if (!store) {
    throw new Error(
      'useEvidenceFileStore cần EvidenceFileStoreProvider (src/bootstrap/Providers.tsx)',
    );
  }
  return store;
}
