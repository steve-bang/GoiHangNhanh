import { readBackendEnv, resolveBackendMode, type BackendEnv } from '@/api/create-api';

/**
 * Phiên có BẮT BUỘC biết shop thật trước khi vào màn nghiệp vụ và ghi dữ liệu không (V1-06)?
 * Bản Firebase và bản "chưa kết nối": có (không bao giờ ghi dưới `LOCAL_SHOP_ID`, vì bản ghi đó không
 * bao giờ được đăng lên máy chủ). Cổng giả (dev, test, bản web chụp ảnh): không, giữ hành vi cũ.
 * Chọn theo CÙNG `resolveBackendMode` của lớp API, không có bản sao quy tắc.
 */
export function requiresKnownShop(env: BackendEnv = readBackendEnv()): boolean {
  return resolveBackendMode(env) !== 'fake';
}
