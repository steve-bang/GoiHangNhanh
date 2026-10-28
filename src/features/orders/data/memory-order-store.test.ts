import { createMemoryOrderStore } from './memory-order-store';
import { runOrderStoreContract } from './order-store.contract';
import { runPendingRemoteContract } from './pending-remote.contract';

runOrderStoreContract('bộ nhớ', async () => createMemoryOrderStore());

runPendingRemoteContract('bộ nhớ', async () => {
  let uid: string | null = 'user-a';
  return {
    store: createMemoryOrderStore({ creatorUid: () => uid }),
    setUid: (value) => void (uid = value),
  };
});
