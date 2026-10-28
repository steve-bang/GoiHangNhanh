import { runEvidenceFileStoreContract } from './evidence-file-store.contract';
import { createMemoryEvidenceFileStore } from './memory-evidence-file-store';
import { createMemoryOrderStore } from './memory-order-store';

runEvidenceFileStoreContract('bộ nhớ', async () => ({
  files: createMemoryEvidenceFileStore(),
  orders: createMemoryOrderStore(),
}));
