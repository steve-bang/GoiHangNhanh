import {
  firebaseEmulatorHost,
  readBackendEnv,
  resolveBackendMode,
  type BackendEnv,
} from './create-api';
import type { RemoteDocuments } from './contract';
// eslint-disable-next-line no-restricted-imports -- đây là thư mục src/api/firebase, không phải gói SDK 'firebase'
import type * as FirebaseModule_ from './firebase';

type FirebaseModule = typeof FirebaseModule_;

function tryCreateFirebaseRemoteDocuments(env: BackendEnv): RemoteDocuments | null {
  try {
    const { createFirestoreRemoteDocuments, getFirebaseServices } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./firebase') as FirebaseModule;
    const host = firebaseEmulatorHost(env);
    return createFirestoreRemoteDocuments(getFirebaseServices(host ? { host } : undefined));
  } catch {
    return null;
  }
}

/**
 * Cổng ghi tài liệu lên máy chủ. CHỈ có với backend Firebase thật (cùng quy tắc chọn với `createApi`);
 * cổng giả và test trả `null` nên đồng bộ không chạy và không đổi hành vi. Thiếu cấu hình Firebase
 * cũng `null`, không giả vờ đã đồng bộ.
 */
export function createRemoteDocuments(
  env: BackendEnv = readBackendEnv(),
  createFirebase: (env: BackendEnv) => RemoteDocuments | null = tryCreateFirebaseRemoteDocuments,
): RemoteDocuments | null {
  return resolveBackendMode(env) === 'firebase' ? createFirebase(env) : null;
}

let defaultDocs: RemoteDocuments | null | undefined;

/** Cổng mặc định của app (một thể hiện cho cả phiên). */
export function getDefaultRemoteDocuments(): RemoteDocuments | null {
  if (defaultDocs === undefined) defaultDocs = createRemoteDocuments();
  return defaultDocs;
}

/** Chỉ cho test. */
export function resetDefaultRemoteDocumentsForTests(): void {
  defaultDocs = undefined;
}
