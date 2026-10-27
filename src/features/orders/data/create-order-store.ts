import { AppError } from '@/core/errors/app-error';
import type { SqlDatabase } from '@/platform';

import type { OrderStore } from '../domain/order-store';
import { createMemoryOrderStore } from './memory-order-store';
import { createSqliteOrderStore } from './sqlite-order-store';

/**
 * Kho dùng khi chạy: mở SQLite lần đầu cần tới (lười). `open` trả `null` (web) thì dùng kho bộ nhớ.
 * Mở SQLite LỖI thì mọi thao tác báo `LOCAL_SAVE_UNAVAILABLE`: KHÔNG lặng lẽ chuyển sang bộ nhớ vì
 * sẽ mất dữ liệu khi đóng app mà người dùng tưởng đã lưu (bất biến 3, 11).
 */
export function createLocalOrderStore(open: () => Promise<SqlDatabase | null>): OrderStore {
  let resolved: Promise<OrderStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) => (db ? createSqliteOrderStore(db) : createMemoryOrderStore()))
        .catch((error: unknown) => {
          resolved = null; // lần sau thử mở lại
          throw new AppError('LOCAL_SAVE_UNAVAILABLE', {}, { cause: error });
        });
    }
    return resolved;
  };
  return {
    saveNewOrder: async (d) => (await get()).saveNewOrder(d),
    getOrder: async (id) => (await get()).getOrder(id),
    findOrdersByCodes: async (s, q) => (await get()).findOrdersByCodes(s, q),
    listRecentLines: async (s, l) => (await get()).listRecentLines(s, l),
    updateLineQuantity: async (id, q) => (await get()).updateLineQuantity(id, q),
    addPackage: async (p) => (await get()).addPackage(p),
    saveSession: async (s) => (await get()).saveSession(s),
    getSession: async (id) => (await get()).getSession(id),
  };
}
