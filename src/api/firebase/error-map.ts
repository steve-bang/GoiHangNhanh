import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';

/**
 * Dịch lỗi SDK Firebase sang mã nghiệp vụ. Đây là chỗ DUY NHẤT biết mã `auth/...`,
 * `functions/...`, `firestore/...`; lớp trên chỉ thấy `AppError`. Lỗi lạ coi là hệ thống bận, không
 * lộ chi tiết SDK (và không đính kèm dữ liệu người dùng).
 */
/** Mã `ops.ts` gắn cho lỗi "không còn người dùng đang đăng nhập" (SDK không ném gì khi `currentUser` null). */
export const NO_CURRENT_USER = 'auth/no-current-user';

/** Ánh xạ riêng của một thao tác, ưu tiên hơn bảng chung (ví dụ sai mật khẩu khi đổi mật khẩu). */
export type ErrorOverrides = Readonly<Record<string, ErrorCode>>;

const CODE_MAP: Readonly<Record<string, ErrorCode>> = {
  'auth/email-already-in-use': 'AUTH_EMAIL_IN_USE',
  'auth/weak-password': 'AUTH_WEAK_PASSWORD',
  // Firebase mới gộp sai mật khẩu và không có tài khoản vào một mã; bản cũ tách hai mã dưới đây.
  'auth/invalid-credential': 'AUTH_INVALID_CREDENTIALS',
  'auth/wrong-password': 'AUTH_INVALID_CREDENTIALS',
  'auth/user-not-found': 'AUTH_INVALID_CREDENTIALS',
  'auth/invalid-email': 'AUTH_INVALID_CREDENTIALS',
  'auth/too-many-requests': 'AUTH_TOO_MANY_REQUESTS',
  'auth/network-request-failed': 'AUTH_NETWORK_ERROR',
  'auth/user-disabled': 'AUTH_SERVICE_UNAVAILABLE',
  // Chỉ xảy ra ở thao tác trên người dùng đang đăng nhập (đổi mật khẩu, đổi họ tên; V1-05).
  'auth/requires-recent-login': 'AUTH_REQUIRES_RECENT_LOGIN',
  'auth/user-token-expired': 'AUTH_SESSION_EXPIRED',
  // Mã nội bộ của `ops.ts` khi `auth.currentUser` không còn (không phải mã của SDK).
  [NO_CURRENT_USER]: 'AUTH_SESSION_EXPIRED',
  'functions/unavailable': 'AUTH_NETWORK_ERROR',
  'functions/deadline-exceeded': 'AUTH_NETWORK_ERROR',
  'functions/resource-exhausted': 'AUTH_TOO_MANY_REQUESTS',
  'functions/unauthenticated': 'AUTH_SERVICE_UNAVAILABLE',
  'functions/permission-denied': 'AUTH_SERVICE_UNAVAILABLE',
  'firestore/unavailable': 'AUTH_NETWORK_ERROR',
};

/**
 * Lý do có cấu trúc của callable xóa tài khoản (`details.reason`, V1-14 b/l). Ưu tiên hơn mã HttpsError:
 * client phân loại theo lý do, không theo câu chữ hay mã chung (`failed-precondition`, `permission-denied`).
 * Áp dụng cho MỌI callable (ví dụ `createShop` trả `account_deleted` khi tài khoản đang được xóa).
 */
const REASON_MAP: Readonly<Record<string, ErrorCode>> = {
  requires_recent_login: 'AUTH_REQUIRES_RECENT_LOGIN',
  shop_has_members: 'ACCOUNT_DELETE_SHOP_HAS_MEMBERS',
  account_deleted: 'ACCOUNT_DELETION_PENDING',
};

/** `details.reason` (chuỗi) của lỗi callable nếu có. */
export function readCallableReason(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) return undefined;
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === 'string' ? reason : undefined;
}

/** Lỗi callable có `details.reason` đã biết -> `AppError` theo lý do; không có -> `null`. */
export function mapCallableReason(error: unknown): AppError | null {
  const reason = readCallableReason(error);
  const code = reason ? REASON_MAP[reason] : undefined;
  if (!reason || !code) return null;
  const raw = readCode(error);
  return new AppError(code, raw ? { sdkCode: raw, reason } : { reason }, { cause: error });
}

function readCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

export function mapFirebaseError(error: unknown, overrides: ErrorOverrides = {}): AppError {
  if (error instanceof AppError) return error;
  const byReason = mapCallableReason(error);
  if (byReason) return byReason;
  const raw = readCode(error);
  // Chỉ giữ mã SDK (không nhạy cảm) trong context để tra lỗi; không giữ message.
  const code = raw ? (overrides[raw] ?? CODE_MAP[raw]) : undefined;
  return new AppError(code ?? 'AUTH_SERVICE_UNAVAILABLE', raw ? { sdkCode: raw } : {}, {
    cause: error,
  });
}

/** Chạy một lời gọi SDK và đổi mọi lỗi thành `AppError`. */
export async function guard<T>(call: () => Promise<T>, overrides?: ErrorOverrides): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw mapFirebaseError(error, overrides);
  }
}
