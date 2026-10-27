import { createMemoryOrderStore } from './memory-order-store';
import { runOrderStoreContract } from './order-store.contract';

runOrderStoreContract('bộ nhớ', async () => createMemoryOrderStore());
