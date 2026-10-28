import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';

import type { RemoteDocuments } from '../contract';

import type { FirebaseServices } from './client';

/** Cổng ghi Firestore cho đồng bộ đơn/phiên. Chưa chạy trên thiết bị (chỉ có test với SDK giả). */
export function createFirestoreRemoteDocuments({ auth, db }: FirebaseServices): RemoteDocuments {
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
  };
}
