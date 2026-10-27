export { buildNextPackage, buildOrder } from './build-order';
export type { BuildResult, DraftError, IdFactory, LineDraft, OrderDraft } from './build-order';
export { MAX_QUANTITY, normalizeCode, toCodeKey, validateCode, validateQuantity } from './codes';
export { classifyMatches, hasDuplicates } from './duplicates';
export type { DuplicateMatches } from './duplicates';
export { LOCAL_SHOP_ID } from './local-shop';
export type { OrderStore } from './order-store';
export { buildPackingSession, findActiveSession, isSessionActive } from './start-session';
export type { StartSessionResult } from './start-session';
export { suggestProductNames, suggestVariants } from './suggestions';
export type {
  DataOrigin,
  Order,
  OrderDetails,
  OrderLine,
  OrderPackage,
  OrderSnapshot,
  PackingSession,
} from './types';
