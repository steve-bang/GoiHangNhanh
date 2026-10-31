import { runDisputeStoreContract } from './dispute-store.contract';
import { createMemoryDisputeStore } from './memory-dispute-store';

runDisputeStoreContract('bộ nhớ', async () => createMemoryDisputeStore());
