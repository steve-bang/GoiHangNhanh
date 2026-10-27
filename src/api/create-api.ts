import { createFakeApi, FAKE_TAKEN_EMAIL } from './fake';
import { createUnavailableApi } from './unavailable';
import type { ApiClient, SessionState } from './contract';
// eslint-disable-next-line no-restricted-imports -- đây là thư mục src/api/firebase, không phải gói SDK 'firebase'
import type * as FirebaseModule_ from './firebase';

type FirebaseModule = typeof FirebaseModule_;

/** Chọn hiện thực API cho app (nơi duy nhất biết các backend). Thêm backend mới: thêm chế độ ở đây. */
export type BackendMode = 'fake' | 'firebase' | 'unavailable';

export interface BackendEnv {
  readonly isDev: boolean;
  readonly isTest: boolean;
  /** Giá trị của `EXPO_PUBLIC_USE_FAKE_BACKEND`. */
  readonly fakeFlag: string | undefined;
  /** Giá trị của `EXPO_PUBLIC_FAKE_SESSION`: `signed_out` | `no_shop` | `signed_in` (chỉ cổng giả dùng). */
  readonly fakeSession?: string | undefined;
  /** Giá trị của `EXPO_PUBLIC_BACKEND`: `firebase` | `fake` (ép chọn; không đặt thì theo quy tắc mặc định). */
  readonly backend?: string | undefined;
  /** Giá trị của `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`: có thì nối Firebase Emulator (chỉ dev). */
  readonly emulatorHost?: string | undefined;
}

/**
 * Thứ tự quyết định: test luôn là bản giả; `EXPO_PUBLIC_USE_FAKE_BACKEND=1` hoặc
 * `EXPO_PUBLIC_BACKEND=fake` ép bản giả (ví dụ xuất web chụp ảnh giao diện); `EXPO_PUBLIC_BACKEND=firebase`
 * hoặc có `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` ép Firebase; còn lại `__DEV__` là bản giả và bản build
 * thường là Firebase thật. Thiếu cấu hình Firebase thì `createApi` rơi về "chưa kết nối", không giả vờ thành công.
 */
export function resolveBackendMode(env: BackendEnv): BackendMode {
  if (env.isTest) return 'fake';
  if (env.fakeFlag === '1' || env.backend === 'fake') return 'fake';
  if (env.backend === 'firebase' || env.emulatorHost) return 'firebase';
  return env.isDev ? 'fake' : 'firebase';
}

/**
 * Phiên giả khi mở app (cổng giả). Giá trị hợp lệ của `EXPO_PUBLIC_FAKE_SESSION` được dùng nguyên;
 * không đặt: `__DEV__`/test = `signed_in` (giữ hành vi mở app hiện tại để dev/QA vào được khung),
 * còn lại (bản xem trước dùng cổng giả mà không đặt cờ) = `signed_out`. Bản build thường không
 * dùng cổng giả nên không có phiên (xem `createUnavailableApi`). Xem decisions.md Q-15.
 */
export function resolveFakeSession(env: BackendEnv): SessionState {
  switch (env.fakeSession) {
    case 'signed_out':
      return 'signed_out';
    case 'no_shop':
      return 'signed_in_no_shop';
    case 'signed_in':
      return 'signed_in';
    default:
      return env.isDev || env.isTest ? 'signed_in' : 'signed_out';
  }
}

export function readBackendEnv(): BackendEnv {
  return {
    isDev: __DEV__,
    isTest: process.env.NODE_ENV === 'test',
    // Truy cập trực tiếp để Metro thay giá trị lúc đóng gói.
    fakeFlag: process.env.EXPO_PUBLIC_USE_FAKE_BACKEND,
    fakeSession: process.env.EXPO_PUBLIC_FAKE_SESSION,
    backend: process.env.EXPO_PUBLIC_BACKEND,
    emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
  };
}

/**
 * Tạo hiện thực Firebase. Nạp SDK lười (require trong hàm) để test, bản giả và bản web không nạp
 * mô-đun native. Lỗi (thiếu tệp cấu hình, SDK không khởi tạo được) -> `null`.
 */
function tryCreateFirebaseApi(env: BackendEnv): ApiClient | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createFirebaseApi, getFirebaseServices } = require('./firebase') as FirebaseModule;
    return createFirebaseApi(
      getFirebaseServices(env.emulatorHost ? { host: env.emulatorHost } : undefined),
    );
  } catch {
    return null;
  }
}

export function createApi(
  env: BackendEnv = readBackendEnv(),
  createFirebase: (env: BackendEnv) => ApiClient | null = tryCreateFirebaseApi,
): ApiClient {
  const mode = resolveBackendMode(env);
  if (mode === 'firebase') return createFirebase(env) ?? createUnavailableApi();
  if (mode === 'unavailable') return createUnavailableApi();
  return createFakeApi({
    latencyMs: env.isTest ? 0 : 450,
    takenEmails: [FAKE_TAKEN_EMAIL],
    sessionState: resolveFakeSession(env),
  });
}

let defaultApi: ApiClient | undefined;

/** API mặc định của app (một thể hiện cho cả phiên). Xem `resolveBackendMode` và decisions.md Q-13. */
export function getDefaultApi(): ApiClient {
  defaultApi ??= createApi();
  return defaultApi;
}

/** Chỉ cho test. */
export function resetDefaultApiForTests(): void {
  defaultApi = undefined;
}
