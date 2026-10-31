import { readBackendEnv, resolveBackendMode, type BackendEnv } from '@/api/create-api';

/**
 * Báo lỗi chỉ ở bản build thật dùng Firebase (V1-16): không ở dev (`__DEV__`), test hay cổng giả (dữ liệu
 * giả, bản xem trước). Bản thiếu mô-đun native/tệp cấu hình thì adapter tự là no-op.
 */
export function crashReportingAllowed(env: BackendEnv = readBackendEnv()): boolean {
  return !env.isDev && !env.isTest && resolveBackendMode(env) === 'firebase';
}
