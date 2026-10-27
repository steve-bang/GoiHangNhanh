import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';

/**
 * Dịch lỗi SDK Firebase sang mã nghiệp vụ. Đây là chỗ DUY NHẤT biết mã `auth/...`,
 * `functions/...`, `firestore/...`; lớp trên chỉ thấy `AppError`. Lỗi lạ coi là hệ thống bận, không
 * lộ chi tiết SDK (và không đính kèm dữ liệu người dùng).
 */
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
  'functions/unavailable': 'AUTH_NETWORK_ERROR',
  'functions/deadline-exceeded': 'AUTH_NETWORK_ERROR',
  'functions/resource-exhausted': 'AUTH_TOO_MANY_REQUESTS',
  'functions/unauthenticated': 'AUTH_SERVICE_UNAVAILABLE',
  'functions/permission-denied': 'AUTH_SERVICE_UNAVAILABLE',
  'firestore/unavailable': 'AUTH_NETWORK_ERROR',
};

function readCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

export function mapFirebaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const raw = readCode(error);
  // Chỉ giữ mã SDK (không nhạy cảm) trong context để tra lỗi; không giữ message.
  const code = raw ? CODE_MAP[raw] : undefined;
  return new AppError(code ?? 'AUTH_SERVICE_UNAVAILABLE', raw ? { sdkCode: raw } : {}, {
    cause: error,
  });
}

/** Chạy một lời gọi SDK và đổi mọi lỗi thành `AppError`. */
export async function guard<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
