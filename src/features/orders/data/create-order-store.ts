import { AppError } from '@/core/errors/app-error';
import type { SqlDatabase } from '@/platform';

import type { CreatorUidProvider } from '../domain/creator';
import type { OrderStore } from '../domain/order-store';
import { createMemoryOrderStore } from './memory-order-store';
import { createSqliteOrderStore } from './sqlite-order-store';

/**
 * Kho dùng khi chạy: mở SQLite lần đầu cần tới (lười). `open` trả `null` (web) thì dùng kho bộ nhớ.
 * Mở SQLite LỖI thì mọi thao tác báo `ORDER_SAVE_FAILED`: KHÔNG lặng lẽ chuyển sang bộ nhớ vì
 * sẽ mất dữ liệu khi đóng app mà người dùng tưởng đã lưu (bất biến 3, 11).
 */
export function createLocalOrderStore(
  open: () => Promise<SqlDatabase | null>,
  options: { creatorUid?: CreatorUidProvider } = {},
): OrderStore {
  let resolved: Promise<OrderStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) => (db ? createSqliteOrderStore(db, options) : createMemoryOrderStore(options)))
        .catch((error: unknown) => {
          resolved = null; // lần sau thử mở lại
          throw new AppError('ORDER_SAVE_FAILED', {}, { cause: error });
        });
    }
    return resolved;
  };
  return {
    listOrders: async (shop, q, p) => (await get()).listOrders(shop, q, p),
    countOrders: async (shop, q) => (await get()).countOrders(shop, q),
    saveNewOrder: async (d) => (await get()).saveNewOrder(d),
    getOrder: async (shop, id) => (await get()).getOrder(shop, id),
    findOrdersByCodes: async (s, q) => (await get()).findOrdersByCodes(s, q),
    listRecentLines: async (s, l) => (await get()).listRecentLines(s, l),
    updateLineQuantity: async (shop, id, q) => (await get()).updateLineQuantity(shop, id, q),
    updateOrder: async (shop, id, edit) => (await get()).updateOrder(shop, id, edit),
    addPackage: async (shop, p) => (await get()).addPackage(shop, p),
    saveSession: async (s) => (await get()).saveSession(s),
    getSession: async (shop, id) => (await get()).getSession(shop, id),
    updateSessionStatus: async (shop, id, st) => (await get()).updateSessionStatus(shop, id, st),
    listSessionsOfOrder: async (shop, order) => (await get()).listSessionsOfOrder(shop, order),
    countUnsynced: async (shop) => (await get()).countUnsynced(shop),
    hasRecordingInProgress: async (shop) => (await get()).hasRecordingInProgress(shop),
    countUnsyncedOnDevice: async () => (await get()).countUnsyncedOnDevice(),
    hasRecordingOnDevice: async () => (await get()).hasRecordingOnDevice(),
    recordSearch: async (s, t, n) => (await get()).recordSearch(s, t, n),
    listRecentSearches: async (s, l) => (await get()).listRecentSearches(s, l),
    removeRecentSearch: async (s, t) => (await get()).removeRecentSearch(s, t),
    clearRecentSearches: async (s) => (await get()).clearRecentSearches(s),
    listOrdersPendingRemote: async (s, l, u) => (await get()).listOrdersPendingRemote(s, l, u),
    markOrderPublished: async (s, o, a, u) => (await get()).markOrderPublished(s, o, a, u),
    markPackagePublished: async (s, p, a) => (await get()).markPackagePublished(s, p, a),
    listSessionsPendingRemote: async (s, l, u) => (await get()).listSessionsPendingRemote(s, l, u),
    markSessionPublished: async (s, i, st) => (await get()).markSessionPublished(s, i, st),
  };
}
