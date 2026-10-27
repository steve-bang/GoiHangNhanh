import { AppError } from '@/core/errors/app-error';

import { createFakeGateways, FAKE_OFFLINE_EMAIL } from './fake-gateways';
import { createGateways, resolveBackendMode, resolveFakeSession } from './gateways';
import { createUnavailableGateways } from './unavailable-gateways';

describe('chọn cổng theo môi trường', () => {
  it('bản giả chỉ khi __DEV__, trong test, hoặc đặt rõ EXPO_PUBLIC_USE_FAKE_BACKEND=1', () => {
    expect(resolveBackendMode({ isDev: true, isTest: false, fakeFlag: undefined })).toBe('fake');
    expect(resolveBackendMode({ isDev: false, isTest: true, fakeFlag: undefined })).toBe('fake');
    expect(resolveBackendMode({ isDev: false, isTest: false, fakeFlag: '1' })).toBe('fake');
  });

  it.each([undefined, '', '0', 'true', 'yes'])(
    'bản build thường (cờ = %p) là "chưa kết nối"',
    (flag) => {
      expect(resolveBackendMode({ isDev: false, isTest: false, fakeFlag: flag })).toBe(
        'unavailable',
      );
    },
  );

  it('bản build thường: nhà máy trả cổng chưa kết nối, không báo thành công', async () => {
    const gateways = createGateways({ isDev: false, isTest: false, fakeFlag: undefined });
    await expect(
      gateways.auth.signUpWithEmail({ email: 'a@b.co', password: 'matkhau123' }),
    ).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
    await expect(
      gateways.shop.createShop({ name: 'Shop', sellingSources: [] }),
    ).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
  });
});

describe('cổng "chưa kết nối"', () => {
  it('mọi lời gọi (kể cả đăng nhập mạng xã hội) trả AUTH_SERVICE_UNAVAILABLE dạng AppError', async () => {
    const { auth, shop } = createUnavailableGateways();
    const results = await Promise.allSettled([
      auth.signUpWithEmail({ email: 'a@b.co', password: '12345678' }),
      auth.signInWithProvider('apple'),
      auth.signInWithProvider('google'),
      shop.createShop({ name: 'Shop', sellingSources: ['shopee'] }),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      const reason = (result as PromiseRejectedResult).reason as unknown;
      expect(reason).toBeInstanceOf(AppError);
      expect((reason as AppError).code).toBe('AUTH_SERVICE_UNAVAILABLE');
    }
  });
});

describe('cổng giả', () => {
  it('tạo tài khoản: ghi emailVerified=false, đã bỏ khoảng trắng email', async () => {
    const { auth } = createFakeGateways();
    const account = await auth.signUpWithEmail({
      email: ' Shop@Example.com ',
      password: 'matkhau-du-dai',
    });
    expect(account.email).toBe('Shop@Example.com');
    expect(account.emailVerified).toBe(false);
    expect(account.uid).toEqual(expect.any(String));
  });

  it('kịch bản: email đã dùng (không phân biệt hoa thường), mật khẩu yếu, mạng lỗi', async () => {
    const { auth } = createFakeGateways({ takenEmails: ['da.dung@example.com'] });
    await expect(
      auth.signUpWithEmail({ email: 'DA.DUNG@example.com', password: 'matkhau-du-dai' }),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_IN_USE' });
    await expect(
      auth.signUpWithEmail({ email: 'moi@example.com', password: '12345678' }),
    ).rejects.toMatchObject({ code: 'AUTH_WEAK_PASSWORD' });
    await expect(
      auth.signUpWithEmail({ email: FAKE_OFFLINE_EMAIL, password: 'matkhau-du-dai' }),
    ).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
  });

  it('đăng ký lần hai cùng email thì báo đã dùng (không tạo trùng)', async () => {
    const { auth } = createFakeGateways();
    const input = { email: 'a@b.co', password: 'matkhau-du-dai' };
    await auth.signUpWithEmail(input);
    await expect(auth.signUpWithEmail(input)).rejects.toMatchObject({ code: 'AUTH_EMAIL_IN_USE' });
  });

  it('failNext làm lần gọi kế tiếp thất bại một lần', async () => {
    const { auth, shop } = createFakeGateways();
    shop.failNext('AUTH_NETWORK_ERROR');
    await expect(shop.createShop({ name: 'Shop', sellingSources: [] })).rejects.toMatchObject({
      code: 'AUTH_NETWORK_ERROR',
    });
    await expect(shop.createShop({ name: 'Shop', sellingSources: [] })).resolves.toMatchObject({
      name: 'Shop',
    });
    auth.failNext('AUTH_SERVICE_UNAVAILABLE');
    await expect(auth.signInWithProvider('google')).rejects.toBeInstanceOf(AppError);
  });

  it('tạo shop: giữ enum nguồn bán theo thứ tự chuẩn', async () => {
    const { shop } = createFakeGateways();
    const created = await shop.createShop({ name: 'Shop', sellingSources: ['other', 'shopee'] });
    expect(created.sellingSources).toEqual(['shopee', 'other']);
    expect(created.id).toEqual(expect.any(String));
  });

  it('đăng nhập mạng xã hội không làm gì và không báo đã đăng nhập (O-15)', async () => {
    const { auth } = createFakeGateways();
    await expect(auth.signInWithProvider('apple')).resolves.toBeUndefined();
    expect(auth.providerCalls).toEqual(['apple']);
  });
});

describe('cổng phiên', () => {
  const env = { isDev: false, isTest: false, fakeFlag: '1' as string | undefined };

  it('EXPO_PUBLIC_FAKE_SESSION hợp lệ được dùng nguyên, kể cả ở bản xem trước', () => {
    expect(resolveFakeSession({ ...env, fakeSession: 'signed_out' })).toBe('signed_out');
    expect(resolveFakeSession({ ...env, fakeSession: 'no_shop' })).toBe('signed_in_no_shop');
    expect(resolveFakeSession({ ...env, fakeSession: 'signed_in' })).toBe('signed_in');
    expect(resolveFakeSession({ ...env, isDev: true, fakeSession: 'signed_out' })).toBe(
      'signed_out',
    );
  });

  it('không đặt cờ: __DEV__/test mặc định signed_in; bản xem trước (cổng giả, không dev) là signed_out', () => {
    expect(resolveFakeSession({ ...env, isDev: true })).toBe('signed_in');
    expect(resolveFakeSession({ ...env, isTest: true })).toBe('signed_in');
    expect(resolveFakeSession(env)).toBe('signed_out');
  });

  it.each([undefined, '', 'true', 'SIGNED_IN', 'admin'])(
    'giá trị cờ không hợp lệ %p -> theo mặc định',
    (v) => {
      expect(resolveFakeSession({ ...env, fakeSession: v })).toBe('signed_out');
      expect(resolveFakeSession({ ...env, isDev: true, fakeSession: v })).toBe('signed_in');
    },
  );

  it('nhà máy: cổng giả trả đúng phiên theo cờ', async () => {
    const make = (fakeSession?: string) =>
      createGateways({ isDev: false, isTest: true, fakeFlag: undefined, fakeSession });
    await expect(make().session.restore()).resolves.toBe('signed_in');
    await expect(make('no_shop').session.restore()).resolves.toBe('signed_in_no_shop');
    await expect(make('signed_out').session.restore()).resolves.toBe('signed_out');
  });

  it('bản build thường (không cổng giả): cổng phiên luôn lỗi, kể cả khi đặt cờ phiên', async () => {
    const gateways = createGateways({
      isDev: false,
      isTest: false,
      fakeFlag: undefined,
      fakeSession: 'signed_in',
    });
    await expect(gateways.session.restore()).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
  });

  it('cổng "chưa kết nối" không bao giờ trả thành công', async () => {
    const { session } = createUnavailableGateways();
    for (let i = 0; i < 3; i += 1) {
      await expect(session.restore()).rejects.toBeInstanceOf(AppError);
    }
  });

  it('cổng giả đếm số lần gọi và mô phỏng được lỗi', async () => {
    const ok = createFakeGateways({ sessionState: 'signed_out' });
    await expect(ok.session.restore()).resolves.toBe('signed_out');
    expect(ok.session.restoreCalls).toBe(1);
    const bad = createFakeGateways({ sessionFails: true });
    await expect(bad.session.restore()).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
  });
});
