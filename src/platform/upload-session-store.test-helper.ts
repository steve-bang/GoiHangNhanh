import type { StoredUploadSession, UploadSessionStore } from './upload-session-store';

/** Kho phiên trong bộ nhớ cho test của `platform` (không import từ `features`). */
export function createMemoryUploadSessionStoreForTest(): UploadSessionStore {
  const sessions = new Map<string, { shopId: string; session: StoredUploadSession }>();
  return {
    get: async (shopId, evidenceId) => {
      const entry = sessions.get(evidenceId);
      return entry && entry.shopId === shopId ? entry.session : null;
    },
    save: async (shopId, evidenceId, session) => {
      sessions.set(evidenceId, { shopId, session });
    },
    clear: async (shopId, evidenceId) => {
      const entry = sessions.get(evidenceId);
      if (entry && entry.shopId === shopId) sessions.delete(evidenceId);
    },
  };
}
