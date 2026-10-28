import type { EvidenceId, OrderId, SessionId, ShopId } from '@/core/ids';
import {
  applyEventToFile,
  isUnsynced,
  type EvidenceFile,
  type EvidenceFileStore,
} from '@/features/evidence';

/** Kho tệp bằng chứng trong bộ nhớ: cho web và test. Cùng hợp đồng với bản SQLite. */
export function createMemoryEvidenceFileStore(): EvidenceFileStore {
  const files = new Map<string, EvidenceFile>();
  const ofShop = (shopId: ShopId) => [...files.values()].filter((f) => f.shopId === shopId);
  const oldestFirst = (a: EvidenceFile, b: EvidenceFile) => a.createdAtDevice - b.createdAtDevice;

  return {
    create: async (input) => {
      const existing = files.get(input.id);
      if (existing) return existing;
      const file: EvidenceFile = {
        ...input,
        state: 'recording',
        localPath: null,
        sizeBytes: null,
        durationMs: null,
        sha256Client: null,
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
  };
}
