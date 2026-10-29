// Public API của feature orders. Feature khác chỉ import từ đây (@/features/orders).
export * from './ui';
export {
  CurrentShopProvider,
  OrderStoreProvider,
  OrderSyncRunner,
  createLocalEvidenceFileStore,
  createLocalOrderStore,
  EvidenceFileStoreProvider,
  useEvidenceFileStore,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  createSqliteEvidenceFileStore,
  ORDER_DB_MIGRATIONS,
  migrateOrderDatabase,
  runSerializedOnDb,
  useCurrentShopId,
  useCurrentUid,
  useOrderStore,
} from './data';
export {
  LOCAL_SHOP_ID,
  classifyLookup,
  formatDeviceDateTime,
  normalizeCode,
  stampCreator,
  toCodeKey,
  validateCode,
  validateQuantity,
} from './domain';
export type { CreatorUidProvider, LookupMatch, LookupResult, MatchReason } from './domain';
export type {
  Order,
  OrderDetails,
  OrderLine,
  OrderPackage,
  OrderSnapshot,
  OrderStore,
  PackingSession,
} from './domain';
