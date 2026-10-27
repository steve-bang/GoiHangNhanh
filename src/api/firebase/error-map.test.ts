import { AppError } from '@/core/errors/app-error';

import { guard, mapFirebaseError } from './error-map';

describe('mapFirebaseError', () => {
  it.each([
    ['auth/email-already-in-use', 'AUTH_EMAIL_IN_USE'],
    ['auth/weak-password', 'AUTH_WEAK_PASSWORD'],
    ['auth/invalid-credential', 'AUTH_INVALID_CREDENTIALS'],
    ['auth/wrong-password', 'AUTH_INVALID_CREDENTIALS'],
    ['auth/user-not-found', 'AUTH_INVALID_CREDENTIALS'],
    ['auth/too-many-requests', 'AUTH_TOO_MANY_REQUESTS'],
    ['auth/network-request-failed', 'AUTH_NETWORK_ERROR'],
    ['functions/unavailable', 'AUTH_NETWORK_ERROR'],
    ['functions/resource-exhausted', 'AUTH_TOO_MANY_REQUESTS'],
  ])('%s -> %s', (sdkCode, expected) => {
    const mapped = mapFirebaseError({ code: sdkCode, message: 'chi tiết SDK không lộ ra' });
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.code).toBe(expected);
    expect(mapped.context).toEqual({ sdkCode });
    expect(mapped.message).toBe(expected);
  });

  it('lỗi lạ hoặc không có mã là AUTH_SERVICE_UNAVAILABLE, không kèm dữ liệu', () => {
    expect(mapFirebaseError(new Error('boom')).code).toBe('AUTH_SERVICE_UNAVAILABLE');
    expect(mapFirebaseError('x').context).toEqual({});
    expect(mapFirebaseError({ code: 'auth/khong-biet' }).code).toBe('AUTH_SERVICE_UNAVAILABLE');
  });

  it('giữ nguyên AppError đã có', () => {
    const error = new AppError('AUTH_OTP_INVALID');
    expect(mapFirebaseError(error)).toBe(error);
  });

  it('guard đổi mọi lỗi thành AppError và trả giá trị khi thành công', async () => {
    await expect(guard(async () => 5)).resolves.toBe(5);
    await expect(
      guard(() => Promise.reject({ code: 'auth/email-already-in-use' })),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_IN_USE' });
  });
});
