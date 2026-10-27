import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from '@react-native-firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from '@react-native-firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from '@react-native-firebase/functions';

/** Khu vực Functions: Singapore (decisions.md Q-08). Phải khớp `REGION` ở firebase/functions/src/index.ts. */
export const FUNCTIONS_REGION = 'asia-southeast1';

export interface FirebaseServices {
  readonly auth: Auth;
  readonly db: Firestore;
  readonly functions: Functions;
}

export interface EmulatorConfig {
  /** Máy chạy emulator, ví dụ `10.0.2.2` (Android emulator) hoặc `localhost` (iOS simulator). */
  readonly host: string;
}

/**
 * Lấy các dịch vụ Firebase. Tệp cấu hình app (GoogleService-Info.plist / google-services.json)
 * do bản build nạp; không có tệp thì SDK ném lỗi lúc `getApp()` và `create-api` trả bản "chưa kết nối".
 * Có `emulator` thì nối Auth/Firestore/Functions emulator (chỉ dev).
 */
export function getFirebaseServices(emulator?: EmulatorConfig): FirebaseServices {
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator.host}:9099`);
    connectFirestoreEmulator(db, emulator.host, 8080);
    connectFunctionsEmulator(functions, emulator.host, 5001);
  }
  return { auth, db, functions };
}
