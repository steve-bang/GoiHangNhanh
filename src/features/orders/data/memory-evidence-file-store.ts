import type { EvidenceId, OrderId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';
import {
  applyEventToFile,
  countStates,
  hasSameBinding,
  isUnsynced,
  type EvidenceFile,
  type EvidenceFileStore,
} from '@/features/evidence';

import type { OrderStore } from '../domain/order-store';

/** Tra phiên để kiểm bộ ba kiện-phiên-đơn khi tạo tệp; `OrderStore` thỏa mãn giao diện này. */
export type SessionLookup = Pick<OrderStore, 'getSession'>;

/**
 * Kho tệp bằng chứng trong bộ nhớ: cho web và test. Cùng hợp đồng với bản SQLite.
 * `sessions` (thường là kho đơn cùng bộ nhớ) bật kiểm tra liên kết khi tạo; không truyền thì chỉ kiểm
 * liên kết khi `id` đã có (dành cho test độc lập không dựng đơn). Đường chạy thật luôn truyền.
 */
export function createMemoryEvidenceFileStore(
  options: { sessions?: SessionLookup } = {},
): EvidenceFileStore {
  const files = new Map<string, EvidenceFile>();
  const ofShop = (shopId: ShopId) => [...files.values()].filter((f) => f.shopId === shopId);
  const oldestFirst = (a: EvidenceFile, b: EvidenceFile) => a.createdAtDevice - b.createdAtDevice;

  return {
    create: async (input) => {
      const existing = files.get(input.id);
      if (existing) {
        if (!hasSameBinding(existing, input)) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
        return existing;
      }
      if (options.sessions) {
        const session = await options.sessions.getSession(input.shopId, input.sessionId);
        if (
          !session ||
          session.shopId !== input.shopId ||
          session.orderId !== input.orderId ||
          session.packageId !== input.packageId
        ) {
          throw new AppError('LOCAL_SAVE_UNAVAILABLE');
        }
      }
      const file: EvidenceFile = {
        ...input,
        state: 'recording',
        localPath: null,
        sizeBytes: null,
        durationMs: null,
        sha256Client: null,
        attemptCount: 0,
        nextAttemptAtDevice: null,
        lastErrorCode: null,
        updatedAtDevice: input.createdAtDevice,
      };
      files.set(file.id, file);
      return file;
    },
    get: async (shopId, id: EvidenceId) => {
      const file = files.get(id);
      return file && file.shopId === shopId ? file : null;
    },
    applyEvent: async (shopId, id, event, nowDevice, patch) => {
      const file = files.get(id);
      if (!file || file.shopId !== shopId) return { ok: false, error: 'FILE_NOT_FOUND' };
      const result = applyEventToFile(file, event, nowDevice, patch);
      if (result.ok) files.set(id, result.file);
      return result;
    },
    listByStates: async (shopId, states) =>
      ofShop(shopId)
        .filter((f) => states.includes(f.state))
        .sort(oldestFirst),
    listForUpload: async (shopId, states, uid) => {
      // Không có tra cứu phiên = không biết người tạo: không tải gì (không đoán, Q-24g).
      if (!uid || !options.sessions) return [];
      const result: EvidenceFile[] = [];
      for (const file of ofShop(shopId).filter((f) => states.includes(f.state))) {
        const session = await options.sessions.getSession(shopId, file.sessionId);
        if (session?.createdBy === uid) result.push(file);
      }
      return result.sort(oldestFirst);
    },
    listShopsWithStates: async (states) => [
      ...new Set([...files.values()].filter((f) => states.includes(f.state)).map((f) => f.shopId)),
    ],
    listByOrders: async (shopId, orderIds) =>
      ofShop(shopId)
        .filter((f) => orderIds.includes(f.orderId))
        .sort(oldestFirst),
    listByOrder: async (shopId, orderId: OrderId) =>
      ofShop(shopId)
        .filter((f) => f.orderId === orderId)
        .sort(oldestFirst),
    listBySession: async (shopId, sessionId: SessionId) =>
      ofShop(shopId)
        .filter((f) => f.sessionId === sessionId)
        .sort(oldestFirst),
    countUnsynced: async (shopId) => ofShop(shopId).filter((f) => isUnsynced(f.state)).length,
    countUnsyncedOnDevice: async () =>
      [...files.values()].filter((f) => isUnsynced(f.state)).length,
    countByState: async (shopId, updatedIn) => countStates(ofShop(shopId), updatedIn),
  };
}
