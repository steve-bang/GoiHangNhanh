import { createMemoryReturnStore } from './memory-return-store';
import { runReturnStoreContract } from './return-store.contract';

runReturnStoreContract('bộ nhớ', async () => createMemoryReturnStore());
