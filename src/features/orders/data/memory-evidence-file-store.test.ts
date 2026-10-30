import { runEvidenceFileStoreContract } from './evidence-file-store.contract';
import { createMemoryEvidenceFileStore } from './memory-evidence-file-store';
import { createMemoryOrderStore } from './memory-order-store';

runEvidenceFileStoreContract('bộ nhớ', async () => {
  let uid: string | null = null;
  const orders = createMemoryOrderStore({ creatorUid: () => uid });
  return {
    files: createMemoryEvidenceFileStore({ sessions: orders }),
    orders,
    signInAs: (next) => void (uid = next),
  };
});
