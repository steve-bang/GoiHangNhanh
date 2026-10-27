import { AppError } from '@/core/errors/app-error';
import { normalizeSources } from '@/core/orders/selling-sources';

import { describeApiContract } from '../contract-tests/api.contract';

import type { FirebaseServices } from './client';
import { createFirebaseApi } from './firebase-api';
import type { FirebaseOps, FirebaseUser } from './ops';

// Mô phỏng SDK trong bộ nhớ ở mức FirebaseOps, để kiểm tra phần GHÉP (ánh xạ lỗi, hasShop, restore)
// của firebase-api. Chạy với Firebase thật: xem firebase/tests/functions (Function) và bước kiểm
// chứng trên dự án dev; bộ hợp đồng này sẽ chạy trên emulator khi có dev build.
function fakeOps(): FirebaseOps & { signedOut(): void } {
  const accounts = new Map<string, { uid: string; password: string }>();
  const shops = new Map<string, string>();
  let current: FirebaseUser | null = null;
  const sdkError = (code: string) => Object.assign(new Error(code), { code });
  return {
    async createUser(email, password) {
      const key = email.toLowerCase();
      if (accounts.has(key)) throw sdkError('auth/email-already-in-use');
      const uid = `u-${accounts.size + 1}`;
      accounts.set(key, { uid, password });
      current = { uid, email, emailVerified: false };
      return current;
    },
    async signIn(email, password) {
      const account = accounts.get(email.toLowerCase());
      if (!account || account.password !== password) throw sdkError('auth/invalid-credential');
      current = { uid: account.uid, email, emailVerified: false };
      return current;
    },
    async restoreUser() {
      return current;
    },
    async readShopId(uid) {
      return shops.get(uid) ?? null;
    },
    async readShopIdForRestore(uid) {
      return shops.get(uid) ?? null;
    },
    async callShop(name, input) {
      if (!current) throw sdkError('functions/unauthenticated');
      const sellingSources = normalizeSources(input.sellingSources);
      if (name === 'createShop') {
        const id = shops.get(current.uid) ?? `shop-${shops.size + 1}`;
        shops.set(current.uid, id);
        return { id, name: input.name, sellingSources };
      }
      return { id: (input as { shopId: string }).shopId, name: input.name, sellingSources };
    },
    signedOut() {
      current = null;
    },
  };
}

jest.mock('./ops', () => ({ createFirebaseOps: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createFirebaseOps } = require('./ops') as { createFirebaseOps: jest.Mock };

function makeApi(ops: FirebaseOps = fakeOps()) {
  createFirebaseOps.mockReturnValue(ops);
  return createFirebaseApi({} as FirebaseServices);
}

describeApiContract('api/firebase (SDK mô phỏng)', () => makeApi());

describe('api/firebase', () => {
  it('đăng nhập: hasShop theo chỉ mục userShops', async () => {
    const api = makeApi();
    await api.auth.signUpWithEmail({ email: 'a@example.com', password: 'Mat-khau-1' });
    await api.shop.createShop({ name: 'S', sellingSources: [] });
    await expect(
      api.auth.signInWithPassword({ email: 'a@example.com', password: 'Mat-khau-1' }),
    ).resolves.toMatchObject({ hasShop: true });
  });

  it('khôi phục phiên: chưa đăng nhập, đã đăng nhập chưa shop, đã có shop', async () => {
    const ops = fakeOps();
    const api = makeApi(ops);
    await expect(api.session.restore()).resolves.toBe('signed_out');
    await api.auth.signUpWithEmail({ email: 'b@example.com', password: 'Mat-khau-1' });
    await expect(api.session.restore()).resolves.toBe('signed_in_no_shop');
    await api.shop.createShop({ name: 'S', sellingSources: [] });
    await expect(api.session.restore()).resolves.toBe('signed_in');
    ops.signedOut();
    await expect(api.session.restore()).resolves.toBe('signed_out');
  });

  it('lỗi SDK trong khi khôi phục phiên là AppError (Splash coi như chưa đăng nhập)', async () => {
    const ops = {
      ...fakeOps(),
      restoreUser: () => Promise.reject({ code: 'auth/network-request-failed' }),
    };
    await expect(makeApi(ops).session.restore()).rejects.toMatchObject({
      code: 'AUTH_NETWORK_ERROR',
    });
  });

  it('lỗi từ Function (createShop) được đổi sang mã nghiệp vụ', async () => {
    const ops = { ...fakeOps(), callShop: () => Promise.reject({ code: 'functions/unavailable' }) };
    const attempt = makeApi(ops).shop.createShop({ name: 'S', sellingSources: [] });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
  });

  it('khôi phục mật khẩu và đăng nhập Apple/Google chưa làm: luôn AUTH_SERVICE_UNAVAILABLE', async () => {
    const { auth } = makeApi();
    for (const call of [
      () => auth.signInWithProvider('apple'),
      () => auth.requestPasswordRecovery('a@example.com'),
      () => auth.verifyRecoveryCode({ email: 'a@example.com', code: '123456' }),
      () => auth.resetPassword({ ticket: 't', newPassword: 'Mat-khau-1' }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
    }
  });
});
