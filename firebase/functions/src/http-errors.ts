import { HttpsError } from 'firebase-functions/v2/https';

import { describeCallableError } from './callable-errors';

/** Đổi lỗi sang HttpsError theo `describeCallableError`; HttpsError có sẵn đi nguyên. */
export function toHttpsError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  const { code, message, details } = describeCallableError(error);
  throw details ? new HttpsError(code, message, details) : new HttpsError(code, message);
}
