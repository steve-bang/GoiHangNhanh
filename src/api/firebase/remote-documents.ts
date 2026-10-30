import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

import { httpsCallable } from '@react-native-firebase/functions';

import { TimeoutError, withTimeout } from '@/core/async';

import type { RemoteDocuments } from '../contract';

import type { FirebaseServices } from './client';

/** Firestore giới hạn số giá trị trong toán tử `in` (10 theo tài liệu giới hạn hiện hành). */
export const FIRESTORE_IN_LIMIT = 10;

/**
 * Thời hạn cho MỖI lệnh tới máy chủ (R4). Khi mất mạng, `batch.commit()` chỉ trả khi máy chủ xác nhận
 * và lệnh đọc có thể chờ lâu: không có hạn thì cờ `running` của hàng đợi/đồng bộ kẹt mãi.
 */
export const REMOTE_CALL_TIMEOUT_MS = 30_000;

/** Lỗi hết giờ, cùng dạng `code` với lỗi SDK để bên gọi phân loại là lỗi mạng (không tốn lượt). */
export class RemoteDeadlineError extends Error {
  readonly code = 'deadline-exceeded';
  constructor() {
    super('deadline-exceeded');
  }
}

/**
 * Giới hạn thời gian một lệnh. Lệnh bên dưới KHÔNG bị hủy (lệnh ghi Firestore vẫn chờ trong SDK và có
 * thể được gửi khi có mạng lại); mọi lệnh ở đây idempotent nên lượt sau thử lại vẫn an toàn.
 */
async function bounded<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
  try {
    return await withTimeout(task(), timeoutMs);
  } catch (error) {
    throw error instanceof TimeoutError ? new RemoteDeadlineError() : error;
  }
}

/** Cổng ghi Firestore cho đồng bộ đơn/phiên. Chưa chạy trên thiết bị (chỉ có test với SDK giả). */
export function createFirestoreRemoteDocuments(
  { auth, db, functions }: FirebaseServices,
  timeoutMs: number = REMOTE_CALL_TIMEOUT_MS,
): RemoteDocuments {
  const raw = createUnboundedRemoteDocuments({ auth, db, functions });
  return {
    values: raw.values,
    currentUid: raw.currentUid,
    createMissing: (writes) => bounded(() => raw.createMissing(writes), timeoutMs),
    updateFields: (path, fields) => bounded(() => raw.updateFields(path, fields), timeoutMs),
    getFields: (path) => bounded(() => raw.getFields(path), timeoutMs),
    getManyFields: (paths) => bounded(() => raw.getManyFields(paths), timeoutMs),
    callFunction: <T>(name: string, data: unknown) =>
      bounded(() => raw.callFunction<T>(name, data), timeoutMs),
  };
}

function createUnboundedRemoteDocuments({
  auth,
  db,
  functions,
}: FirebaseServices): RemoteDocuments {
  return {
    values: {
      serverTimestamp: () => serverTimestamp(),
      timestamp: (ms) => Timestamp.fromMillis(ms),
    },
    currentUid: () => auth.currentUser?.uid ?? null,
    async createMissing(writes) {
      const missing = [];
      for (const write of writes) {
        const snapshot = await getDoc(doc(db, write.path));
        if (!snapshot.exists()) missing.push(write);
      }
      if (missing.length === 0) return;
      const batch = writeBatch(db);
      for (const write of missing) batch.set(doc(db, write.path), write.data);
      await batch.commit();
    },
    async updateFields(path, fields) {
      await updateDoc(doc(db, path), { ...fields });
    },
    async getFields(path) {
      const snapshot = await getDoc(doc(db, path));
      return snapshot.exists() ? ((snapshot.data() ?? {}) as Record<string, unknown>) : null;
    },
    async getManyFields(paths) {
      const found = new Map<string, Record<string, unknown>>();
      // Gom theo bộ sưu tập cha: `documentId() in [...]` chỉ chạy trong một bộ sưu tập.
      const byParent = new Map<string, string[]>();
      for (const path of new Set(paths)) {
        const at = path.lastIndexOf('/');
        const parent = path.slice(0, at);
        byParent.set(parent, [...(byParent.get(parent) ?? []), path.slice(at + 1)]);
      }
      for (const [parent, ids] of byParent) {
        for (let from = 0; from < ids.length; from += FIRESTORE_IN_LIMIT) {
          const chunk = ids.slice(from, from + FIRESTORE_IN_LIMIT);
          const snapshot = await getDocs(
            query(collection(db, parent), where(documentId(), 'in', chunk)),
          );
          for (const item of snapshot.docs) {
            found.set(`${parent}/${item.id}`, (item.data() ?? {}) as Record<string, unknown>);
          }
        }
      }
      return found;
    },
    async callFunction<T>(name: string, data: unknown) {
      const result = await httpsCallable<unknown, T>(functions, name)(data);
      return result.data;
    },
  };
}
