export { buildNextPackage, buildOrder } from './build-order';
export type { BuildResult, DraftError, IdFactory, LineDraft, OrderDraft } from './build-order';
export {
  MAX_CODE_LENGTH,
  MAX_LINE_NAME_LENGTH,
  MAX_LINE_VARIANT_LENGTH,
  MAX_QUANTITY,
  normalizeCode,
  toCodeKey,
  validateCode,
  validateQuantity,
  validateTrackingCode,
} from './codes';
export { classifyMatches, hasDuplicates } from './duplicates';
export type { DuplicateMatches } from './duplicates';
export {
  EMPTY_FILTERS,
  ORDER_LIST_PAGE_SIZE,
  STATUS_CHIPS,
  compareListItems,
  countAdvancedFilters,
  hasActiveFilters,
  isAfterCursor,
  lastActivityOf,
  matchesListQuery,
  periodStart,
  toListQuery,
} from './order-list';
export type {
  ActiveSessionRef,
  DeclarationFilter,
  OrderListCursor,
  OrderListFilters,
  OrderListItem,
  OrderListPage,
  OrderListPageRequest,
  OrderListQuery,
  PeriodFilter,
  StatusChip,
} from './order-list';
export { canRecordNow, summarizeOrderEvidence } from './order-evidence';
export type { OrderEvidenceSummary } from './order-evidence';
export { countEvidence, packItems, summarizePackEvidence } from './evidence-items';
export type { EvidenceCounts, OrderEvidenceItem } from './evidence-items';
export { classifyLookup, matchReasons } from './lookup';
export type { LookupMatch, LookupResult, MatchReason } from './lookup';
export {
  MAX_RECENT_SEARCHES,
  MIN_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_RESULT_LIMIT,
  normalizeSearchInput,
} from './search';
export { buildOrderEdit, isEditUnchanged } from './update-order';
export type { EditBuildResult, EditLineDraft, OrderEdit, OrderEditDraft } from './update-order';
export { formatDeviceDateTime } from './format';
export { LOCAL_SHOP_ID } from './local-shop';
export type { OrderStore, RecentSearch } from './order-store';
export {
  buildPackingSession,
  findActiveSession,
  findBlockingSession,
  isSessionActive,
  isSessionStatusActive,
} from './start-session';
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
export { stampCreator } from './creator';
export type { CreatorUidProvider } from './creator';
export * from './order-sync';
export * from './remote-documents';
export { SESSION_STATUSES, canChangeSessionStatus, isSessionStatus } from './session-status';
export type { SessionStatus } from './session-status';
export { booleanSetting, decodeDeviceSetting, encodeDeviceSetting } from './device-settings';
export type { DeviceSettingDefinition, DeviceSettingsStore } from './device-settings';
