// Public API của feature orders. Feature khác chỉ import từ đây (@/features/orders).
export * from './ui';
export {
  OrderStoreProvider,
  createMemoryOrderStore,
  useCurrentShopId,
  useOrderStore,
} from './data';
export { LOCAL_SHOP_ID } from './domain';
export type {
  Order,
  OrderDetails,
  OrderLine,
  OrderPackage,
  OrderSnapshot,
  OrderStore,
  PackingSession,
} from './domain';
