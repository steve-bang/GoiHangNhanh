import { AppError } from '@/core/errors/app-error';
import { REMOTE_ORDER_SOURCES } from '@/core/orders/remote-source';

import { describeApiContract } from '../contract-tests/api.contract';

import type { FirebaseServices } from './client';
import { createFirebaseApi, PASSWORD_RESET_RESEND_SECONDS } from './firebase-api';
import type { FirebaseOps, FirebaseUser } from './ops';

// Mô phỏng SDK trong bộ nhớ ở mức FirebaseOps, để kiểm tra phần GHÉP (ánh xạ lỗi, hasShop, restore)
// của firebase-api. Chạy với Firebase thật: xem firebase/tests/functions (Function) và bước kiểm
// chứng trên dự án dev; bộ hợp đồng này sẽ chạy trên emulator khi có dev build.
function fakeOps(): FirebaseOps & {
  signedOut(): void;
  failSignOut(error: unknown): void;
  failReadShopId(error: unknown): void;
  patchCurrent(patch: Partial<FirebaseUser>): void;
  failPasswordReset(error: unknown): void;
  /** Lần gọi kế tiếp của thao tác này ném `error` (mã SDK). */
  failOnce(
    op: 'changePassword' | 'updateDisplayName' | 'callShop' | 'reauth' | 'callDeleteAccount',
    error: unknown,
  ): void;
  /** Kết quả `deleteAccount` giả trả về (mặc định `{ status: 'completed' }`). */
  setDeleteResult(result: { status?: unknown }): void;
  readonly calls: string[];
  setRoles(roles: readonly string[]): void;
  setStoredSources(shopId: string, sources: readonly string[] | null): void;
  readonly signOutCalls: () => number;
  readonly resetEmails: string[];
  readonly shopCalls: { name: string; input: unknown }[];
} {
  const accounts = new Map<string, { uid: string; password: string }>();
  const shops = new Map<string, string>();
  const shopData = new Map<string, { name: string; sellingSources: readonly string[] | null }>();
  const failures = new Map<string, unknown>();
  const shopCalls: { name: string; input: unknown }[] = [];
  let roles: readonly string[] = ['owner'];
  const calls: string[] = [];
  let reauthed = false;
  let deleteResult: { status?: unknown } = { status: 'completed' };
  const takeFailure = (op: string) => {
    if (!failures.has(op)) return;
    const error = failures.get(op);
    failures.delete(op);
    throw error;
  };
  let current: FirebaseUser | null = null;
  let signOutError: unknown = null;
  let readShopIdError: unknown = null;
  let signOutCalls = 0;
  let passwordResetError: unknown = null;
  const resetEmails: string[] = [];
  const sdkError = (code: string) => Object.assign(new Error(code), { code });
  return {
    async createUser(email, password) {
      const key = email.toLowerCase();
      if (accounts.has(key)) throw sdkError('auth/email-already-in-use');
      const uid = `u-${accounts.size + 1}`;
      accounts.set(key, { uid, password });
      current = {
        uid,
        email,
        emailVerified: false,
        displayName: null,
        providerIds: ['password'],
      };
      return current;
    },
    async signIn(email, password) {
      const account = accounts.get(email.toLowerCase());
      if (!account || account.password !== password) throw sdkError('auth/invalid-credential');
      current = {
        uid: account.uid,
        email,
        emailVerified: false,
        displayName: 'Chị Lan',
        providerIds: ['password'],
      };
      return current;
    },
    async restoreUser() {
      return current;
    },
    async readShopId(uid) {
      if (readShopIdError) throw readShopIdError;
      return shops.get(uid) ?? null;
    },
    async readShopIdForRestore(uid) {
      return shops.get(uid) ?? null;
    },
    async signOut() {
      signOutCalls += 1;
      if (signOutError) throw signOutError;
      current = null;
    },
    async sendPasswordReset(email) {
      resetEmails.push(email);
      if (passwordResetError) throw passwordResetError;
    },
    async readShopDetails(shopId, uid) {
      const data = shopData.get(shopId);
      if (shops.get(uid) !== shopId || !data) return null;
      const isOwner = roles.includes('owner');
      return {
        id: shopId,
        name: data.name,
        role: isOwner ? 'owner' : 'member',
        canEdit: isOwner || roles.includes('manager'),
      };
    },
    async changePassword(currentPassword, newPassword) {
      takeFailure('changePassword');
      if (!current?.email) throw sdkError('auth/no-current-user');
      const account = accounts.get(current.email.toLowerCase());
      if (!account || account.password !== currentPassword) {
        throw sdkError('auth/invalid-credential');
      }
      if (newPassword.length < 6) throw sdkError('auth/weak-password');
      account.password = newPassword;
    },
    async updateDisplayName(displayName) {
      takeFailure('updateDisplayName');
      if (!current) throw sdkError('auth/no-current-user');
      current = { ...current, displayName };
    },
    async reauthenticateForSensitiveAction(password) {
      calls.push('reauth');
      takeFailure('reauth');
      if (!current?.email) throw sdkError('auth/no-current-user');
      const account = accounts.get(current.email.toLowerCase());
      if (!account || account.password !== password) throw sdkError('auth/invalid-credential');
      reauthed = true;
    },
    async callDeleteAccount() {
      calls.push('callDeleteAccount');
      takeFailure('callDeleteAccount');
      if (!current?.email) throw sdkError('functions/unauthenticated');
      // Như máy chủ: không có token mới sau xác thực lại thì từ chối.
      if (!reauthed) {
        throw Object.assign(sdkError('functions/failed-precondition'), {
          details: { reason: 'requires_recent_login' },
        });
      }
      accounts.delete(current.email.toLowerCase());
      shops.delete(current.uid);
      return deleteResult;
    },
    async readShopSellingSources(shopId) {
      return shopData.get(shopId)?.sellingSources ?? null;
    },
    async callShop(name, input) {
      shopCalls.push({ name, input });
      takeFailure('callShop');
      if (!current) throw sdkError('functions/unauthenticated');
      // Như Function thật (`parseShopInput`): chỉ nhận từ vựng máy chủ, chuẩn hóa thứ tự.
      if (
        !input.sellingSources.every((v) => (REMOTE_ORDER_SOURCES as readonly string[]).includes(v))
      ) {
        throw sdkError('functions/invalid-argument');
      }
      const sellingSources = REMOTE_ORDER_SOURCES.filter((v) => input.sellingSources.includes(v));
      if (name === 'createShop') {
        const id = shops.get(current.uid) ?? `shop-${shops.size + 1}`;
        shops.set(current.uid, id);
        shopData.set(id, { name: input.name, sellingSources });
        return { id, name: input.name, sellingSources };
      }
      const { shopId } = input as { shopId: string };
      if (
        shops.get(current.uid) !== shopId ||
        !roles.some((r) => r === 'owner' || r === 'manager')
      ) {
        throw sdkError('functions/permission-denied');
      }
      // Như Function thật: ghi đè cả tên và nguồn bán bằng giá trị gửi lên.
      shopData.set(shopId, { name: input.name, sellingSources });
      return { id: shopId, name: input.name, sellingSources };
    },
    signedOut() {
      current = null;
    },
    failSignOut(error) {
      signOutError = error;
    },
    failReadShopId(error) {
      readShopIdError = error;
    },
    patchCurrent(patch) {
      if (current) current = { ...current, ...patch };
    },
    failPasswordReset(error) {
      passwordResetError = error;
    },
    failOnce(op, error) {
      failures.set(op, error);
    },
    setDeleteResult(result) {
      deleteResult = result;
    },
    calls,
    setRoles(next) {
      roles = next;
    },
    setStoredSources(shopId, sources) {
      const data = shopData.get(shopId);
      if (data) shopData.set(shopId, { ...data, sellingSources: sources });
    },
    signOutCalls: () => signOutCalls,
    resetEmails,
    shopCalls,
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

  it('identity: chưa đăng nhập là null; chưa có shop thì shopId null; có shop thì shopId thật', async () => {
    const api = makeApi(fakeOps());
    await expect(api.session.identity()).resolves.toBeNull();
    await api.auth.signUpWithEmail({ email: 'c@example.com', password: 'Mat-khau-1' });
    await expect(api.session.identity()).resolves.toEqual({
      uid: 'u-1',
      email: 'c@example.com',
      displayName: null,
      signInMethod: 'password',
      shopId: null,
    });
    const shop = await api.shop.createShop({ name: 'S', sellingSources: [] });
    await expect(api.session.identity()).resolves.toMatchObject({ uid: 'u-1', shopId: shop.id });
  });

  it('đăng nhập trả shopId từ userShops (null khi chưa có shop)', async () => {
    const api = makeApi();
    await api.auth.signUpWithEmail({ email: 'd@example.com', password: 'Mat-khau-1' });
    await expect(
      api.auth.signInWithPassword({ email: 'd@example.com', password: 'Mat-khau-1' }),
    ).resolves.toMatchObject({ hasShop: false, shopId: null });
    const shop = await api.shop.createShop({ name: 'S', sellingSources: [] });
    await expect(
      api.auth.signInWithPassword({ email: 'd@example.com', password: 'Mat-khau-1' }),
    ).resolves.toMatchObject({ hasShop: true, shopId: shop.id });
  });

  it('signOut thật: sau đó identity là null; lỗi SDK là AppError và phiên còn nguyên', async () => {
    const ops = fakeOps();
    const api = makeApi(ops);
    await api.auth.signUpWithEmail({ email: 'e@example.com', password: 'Mat-khau-1' });
    ops.failSignOut({ code: 'auth/network-request-failed' });
    await expect(api.auth.signOut()).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
    await expect(api.session.identity()).resolves.not.toBeNull();
    ops.failSignOut(null);
    await expect(api.auth.signOut()).resolves.toBeUndefined();
    await expect(api.session.identity()).resolves.toBeNull();
  });

  it('đăng nhập trả họ tên từ Auth để hồ sơ giống lúc khôi phục', async () => {
    const api = makeApi();
    await api.auth.signUpWithEmail({ email: 'g@example.com', password: 'Mat-khau-1' });
    await expect(
      api.auth.signInWithPassword({ email: 'g@example.com', password: 'Mat-khau-1' }),
    ).resolves.toMatchObject({ displayName: 'Chị Lan' });
  });

  it('đăng nhập xong mà đọc userShops lỗi: thoát Auth (không để nửa đăng nhập) và báo lỗi gốc', async () => {
    const ops = fakeOps();
    const api = makeApi(ops);
    await api.auth.signUpWithEmail({ email: 'h@example.com', password: 'Mat-khau-1' });
    ops.failReadShopId({ code: 'firestore/unavailable' });
    await expect(
      api.auth.signInWithPassword({ email: 'h@example.com', password: 'Mat-khau-1' }),
    ).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
    expect(ops.signOutCalls()).toBe(1);
    await expect(api.session.identity()).resolves.toBeNull();
  });

  it('đăng nhập xong, đọc userShops lỗi và thoát cũng lỗi: vẫn báo lỗi đọc shop', async () => {
    const ops = fakeOps();
    const api = makeApi(ops);
    await api.auth.signUpWithEmail({ email: 'i@example.com', password: 'Mat-khau-1' });
    ops.failReadShopId({ code: 'firestore/unavailable' });
    ops.failSignOut({ code: 'auth/network-request-failed' });
    await expect(
      api.auth.signInWithPassword({ email: 'i@example.com', password: 'Mat-khau-1' }),
    ).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
    expect(ops.signOutCalls()).toBe(1);
  });

  it('identity: phương thức đăng nhập lấy từ nhà cung cấp Auth, lạ thì null; thiếu email thì lỗi (không bịa)', async () => {
    const ops = fakeOps();
    const api = makeApi(ops);
    await api.auth.signUpWithEmail({ email: 'j@example.com', password: 'Mat-khau-1' });
    ops.patchCurrent({ providerIds: ['google.com'] });
    await expect(api.session.identity()).resolves.toMatchObject({ signInMethod: 'google' });
    ops.patchCurrent({ providerIds: ['apple.com'] });
    await expect(api.session.identity()).resolves.toMatchObject({ signInMethod: 'apple' });
    ops.patchCurrent({ providerIds: ['phone'] });
    await expect(api.session.identity()).resolves.toMatchObject({ signInMethod: null });
    ops.patchCurrent({ email: null });
    await expect(api.session.identity()).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
  });

  it('getShop: thành viên đọc được; shop lạ hoặc chưa đăng nhập là null', async () => {
    const api = makeApi(fakeOps());
    await expect(api.shop.getShop('shop-1')).resolves.toBeNull();
    await api.auth.signUpWithEmail({ email: 'f@example.com', password: 'Mat-khau-1' });
    const shop = await api.shop.createShop({ name: 'S', sellingSources: [] });
    await expect(api.shop.getShop(shop.id)).resolves.toMatchObject({ id: shop.id, canEdit: true });
    await expect(api.shop.getShop('shop-khac')).resolves.toBeNull();
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

  it('mã 6 số và đăng nhập Apple/Google chưa làm: luôn AUTH_SERVICE_UNAVAILABLE', async () => {
    const { auth } = makeApi();
    for (const call of [
      () => auth.signInWithProvider('apple'),
      () => auth.verifyRecoveryCode({ email: 'a@example.com', code: '123456' }),
      () => auth.resetPassword({ ticket: 't', newPassword: 'Mat-khau-1' }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
    }
  });
});

describe('api/firebase: quên mật khẩu bằng thư của Firebase (D-14 v1)', () => {
  it('gửi thư cho email đã cắt khoảng trắng, báo thời gian chờ gửi lại', async () => {
    const ops = fakeOps();
    const result = await makeApi(ops).auth.requestPasswordRecovery('  lan@example.com ');
    expect(ops.resetEmails).toEqual(['lan@example.com']);
    expect(result).toEqual({ retryAfterSeconds: PASSWORD_RESET_RESEND_SECONDS });
  });

  it.each(['auth/user-not-found', 'auth/user-disabled'])(
    'lỗi theo trạng thái tài khoản (%s): trung tính, cùng kết quả như email có tài khoản',
    async (sdkCode) => {
      const normal = await makeApi(fakeOps()).auth.requestPasswordRecovery('co@example.com');
      const ops = fakeOps();
      ops.failPasswordReset(Object.assign(new Error('chi tiết SDK'), { code: sdkCode }));
      await expect(makeApi(ops).auth.requestPasswordRecovery('x@example.com')).resolves.toEqual(
        normal,
      );
      expect(normal).toEqual({ retryAfterSeconds: PASSWORD_RESET_RESEND_SECONDS });
    },
  );

  it.each([
    ['auth/invalid-email', 'AUTH_INVALID_CREDENTIALS'],
    ['auth/too-many-requests', 'AUTH_TOO_MANY_REQUESTS'],
    ['auth/network-request-failed', 'AUTH_NETWORK_ERROR'],
    ['auth/internal-error', 'AUTH_SERVICE_UNAVAILABLE'],
  ])('lỗi SDK %s -> %s (AppError, không lộ thông điệp SDK)', async (sdkCode, code) => {
    const ops = fakeOps();
    ops.failPasswordReset(Object.assign(new Error('chi tiết SDK'), { code: sdkCode }));
    const attempt = makeApi(ops).auth.requestPasswordRecovery('lan@example.com');
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({ code });
  });
});

describe('api/firebase: tab Cá nhân (V1-05)', () => {
  const sdk = (code: string) => Object.assign(new Error('chi tiết SDK'), { code });
  async function signedUp(ops = fakeOps()) {
    const api = makeApi(ops);
    await api.auth.signUpWithEmail({ email: 'lan@example.com', password: 'Mat-khau-1' });
    return { api, ops };
  }

  it('đổi mật khẩu: sai mật khẩu hiện tại là AUTH_WRONG_CURRENT_PASSWORD (không phải lỗi đăng nhập)', async () => {
    const { api } = await signedUp();
    await expect(
      api.auth.changePassword({ currentPassword: 'sai-roi-1', newPassword: 'Moi-hon-2' }),
    ).rejects.toMatchObject({ code: 'AUTH_WRONG_CURRENT_PASSWORD' });
    await api.auth.changePassword({ currentPassword: 'Mat-khau-1', newPassword: 'Moi-hon-2' });
    await expect(
      api.auth.signInWithPassword({ email: 'lan@example.com', password: 'Moi-hon-2' }),
    ).resolves.toMatchObject({ email: 'lan@example.com' });
  });

  it.each([
    ['auth/wrong-password', 'AUTH_WRONG_CURRENT_PASSWORD'],
    ['auth/invalid-credential', 'AUTH_WRONG_CURRENT_PASSWORD'],
    ['auth/weak-password', 'AUTH_WEAK_PASSWORD'],
    ['auth/password-does-not-meet-requirements', 'AUTH_WEAK_PASSWORD'],
    ['auth/requires-recent-login', 'AUTH_REQUIRES_RECENT_LOGIN'],
    ['auth/user-token-expired', 'AUTH_SESSION_EXPIRED'],
    ['auth/user-mismatch', 'AUTH_SESSION_EXPIRED'],
    ['auth/user-not-found', 'AUTH_SESSION_EXPIRED'],
    ['auth/no-current-user', 'AUTH_SESSION_EXPIRED'],
    ['auth/too-many-requests', 'AUTH_TOO_MANY_REQUESTS'],
    ['auth/network-request-failed', 'AUTH_NETWORK_ERROR'],
    ['auth/internal-error', 'AUTH_SERVICE_UNAVAILABLE'],
  ])('đổi mật khẩu: lỗi SDK %s -> %s', async (sdkCode, code) => {
    const { api, ops } = await signedUp();
    ops.failOnce('changePassword', sdk(sdkCode));
    const attempt = api.auth.changePassword({ currentPassword: 'Mat-khau-1', newPassword: 'X-2' });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({ code });
  });

  it('sai mật khẩu ở màn Đăng nhập vẫn là AUTH_INVALID_CREDENTIALS (ánh xạ riêng chỉ cho đổi mật khẩu)', async () => {
    const { api } = await signedUp();
    await expect(
      api.auth.signInWithPassword({ email: 'lan@example.com', password: 'sai-roi-1' }),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('đổi họ tên: resolve với tên máy chủ nhận; identity thấy tên mới; chưa đăng nhập là phiên hết hạn', async () => {
    const { api, ops } = await signedUp();
    await expect(api.auth.updateDisplayName('Chị Mai')).resolves.toEqual({
      displayName: 'Chị Mai',
    });
    await expect(api.session.identity()).resolves.toMatchObject({ displayName: 'Chị Mai' });
    ops.failOnce('updateDisplayName', sdk('auth/network-request-failed'));
    await expect(api.auth.updateDisplayName('A')).rejects.toMatchObject({
      code: 'AUTH_NETWORK_ERROR',
    });
    ops.signedOut();
    await expect(api.auth.updateDisplayName('A')).rejects.toMatchObject({
      code: 'AUTH_SESSION_EXPIRED',
    });
  });

  it('danh sách shop: rỗng khi chưa có shop, một shop sau khi tạo; chưa đăng nhập là phiên hết hạn', async () => {
    const { api, ops } = await signedUp();
    await expect(api.shop.listMyShops()).resolves.toEqual([]);
    const shop = await api.shop.createShop({ name: 'Shop Lan', sellingSources: ['shopee'] });
    await expect(api.shop.listMyShops()).resolves.toEqual([
      { id: shop.id, name: 'Shop Lan', role: 'owner', canEdit: true },
    ]);
    ops.signedOut();
    await expect(api.shop.listMyShops()).rejects.toMatchObject({ code: 'AUTH_SESSION_EXPIRED' });
  });

  it('đổi tên shop: gọi updateShop với NGUYÊN nguồn bán máy chủ đang lưu', async () => {
    const { api, ops } = await signedUp();
    const shop = await api.shop.createShop({ name: 'Cũ', sellingSources: ['shopee', 'lazada'] });
    // Giá trị máy chủ có thể khác tên ở app (Function dùng `other_unknown`): gửi lại nguyên văn.
    ops.setStoredSources(shop.id, ['shopee', 'other_unknown']);
    await expect(api.shop.renameShop(shop.id, 'Mới')).resolves.toEqual({
      id: shop.id,
      name: 'Mới',
      role: 'owner',
      canEdit: true,
    });
    expect(ops.shopCalls.at(-1)).toEqual({
      name: 'updateShop',
      input: { shopId: shop.id, name: 'Mới', sellingSources: ['shopee', 'other_unknown'] },
    });
  });

  it('tạo/sửa shop có nguồn "Khác": gửi other_unknown lên Function, app nhận lại other', async () => {
    const { api, ops } = await signedUp();
    const created = await api.shop.createShop({ name: 'K', sellingSources: ['shopee', 'other'] });
    expect(ops.shopCalls.at(-1)).toEqual({
      name: 'createShop',
      input: { name: 'K', sellingSources: ['shopee', 'other_unknown'] },
    });
    expect(created.sellingSources).toEqual(['shopee', 'other']);
    const updated = await api.shop.updateShop({
      shopId: created.id,
      name: 'K2',
      sellingSources: ['other'],
    });
    expect(ops.shopCalls.at(-1)).toEqual({
      name: 'updateShop',
      input: { shopId: created.id, name: 'K2', sellingSources: ['other_unknown'] },
    });
    expect(updated).toEqual({ id: created.id, name: 'K2', sellingSources: ['other'] });
  });

  it('đổi tên shop có nguồn "Khác" đã lưu: gửi lại nguyên other_unknown, không đổi thành other', async () => {
    const { api, ops } = await signedUp();
    const shop = await api.shop.createShop({ name: 'Cũ', sellingSources: ['other'] });
    await api.shop.renameShop(shop.id, 'Mới');
    expect(ops.shopCalls.at(-1)).toEqual({
      name: 'updateShop',
      input: { shopId: shop.id, name: 'Mới', sellingSources: ['other_unknown'] },
    });
  });

  it('đổi tên shop: không có quyền thì SHOP_PERMISSION_DENIED và KHÔNG gọi Function', async () => {
    const { api, ops } = await signedUp();
    const shop = await api.shop.createShop({ name: 'S', sellingSources: [] });
    ops.setRoles(['packer']);
    const calls = ops.shopCalls.length;
    await expect(api.shop.renameShop(shop.id, 'Mới')).rejects.toMatchObject({
      code: 'SHOP_PERMISSION_DENIED',
    });
    expect(ops.shopCalls).toHaveLength(calls);
  });

  it('đổi tên shop: shop lạ hoặc nguồn bán không đọc được thì SHOP_SAVE_FAILED, không gửi mảng rỗng', async () => {
    const { api, ops } = await signedUp();
    const shop = await api.shop.createShop({ name: 'S', sellingSources: ['shopee'] });
    const calls = ops.shopCalls.length;
    await expect(api.shop.renameShop('shop-khac', 'Mới')).rejects.toMatchObject({
      code: 'SHOP_SAVE_FAILED',
    });
    ops.setStoredSources(shop.id, null);
    await expect(api.shop.renameShop(shop.id, 'Mới')).rejects.toMatchObject({
      code: 'SHOP_SAVE_FAILED',
    });
    expect(ops.shopCalls).toHaveLength(calls);
  });

  it.each([
    ['functions/permission-denied', 'SHOP_PERMISSION_DENIED'],
    ['functions/invalid-argument', 'SHOP_SAVE_FAILED'],
    ['functions/not-found', 'SHOP_SAVE_FAILED'],
    ['functions/unavailable', 'AUTH_NETWORK_ERROR'],
    ['functions/internal', 'AUTH_SERVICE_UNAVAILABLE'],
  ])('đổi tên shop: lỗi Function %s -> %s', async (sdkCode, code) => {
    const { api, ops } = await signedUp();
    const shop = await api.shop.createShop({ name: 'S', sellingSources: [] });
    ops.failOnce('callShop', sdk(sdkCode));
    await expect(api.shop.renameShop(shop.id, 'Mới')).rejects.toMatchObject({ code });
  });

  it('luồng thiết lập shop giữ ánh xạ cũ: updateShop bị từ chối quyền vẫn là AUTH_SERVICE_UNAVAILABLE', async () => {
    const { api, ops } = await signedUp();
    const shop = await api.shop.createShop({ name: 'S', sellingSources: [] });
    ops.failOnce('callShop', sdk('functions/permission-denied'));
    await expect(
      api.shop.updateShop({ shopId: shop.id, name: 'Mới', sellingSources: [] }),
    ).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
  });
});

describe('api/firebase: xóa tài khoản (V1-15)', () => {
  const sdk = (code: string, reason?: string) =>
    Object.assign(new Error('chi tiết SDK'), { code }, reason ? { details: { reason } } : {});
  async function signedUp(ops = fakeOps()) {
    const api = makeApi(ops);
    await api.auth.signUpWithEmail({ email: 'lan@example.com', password: 'Mat-khau-1' });
    return { api, ops };
  }

  it('xác thực lại (kèm token mới) TRƯỚC, rồi mới gọi Function; sai mật khẩu thì không gọi Function', async () => {
    const { api, ops } = await signedUp();
    await expect(api.auth.deleteAccount({ password: 'sai' })).rejects.toMatchObject({
      code: 'AUTH_WRONG_CURRENT_PASSWORD',
    });
    expect(ops.calls).toEqual(['reauth']);
    await api.auth.deleteAccount({ password: 'Mat-khau-1' });
    expect(ops.calls).toEqual(['reauth', 'reauth', 'callDeleteAccount']);
  });

  it.each([
    ['functions/failed-precondition', 'requires_recent_login', 'AUTH_REQUIRES_RECENT_LOGIN'],
    ['functions/failed-precondition', 'shop_has_members', 'ACCOUNT_DELETE_SHOP_HAS_MEMBERS'],
    ['functions/permission-denied', 'account_deleted', 'ACCOUNT_DELETION_PENDING'],
    ['permission-denied', 'account_deleted', 'ACCOUNT_DELETION_PENDING'],
  ])('lỗi %s + details.reason %s -> %s', async (sdkCode, reason, code) => {
    const { api, ops } = await signedUp();
    ops.failOnce('callDeleteAccount', sdk(sdkCode, reason));
    await expect(api.auth.deleteAccount({ password: 'Mat-khau-1' })).rejects.toMatchObject({
      code,
    });
  });

  it.each([
    ['functions/unavailable', 'AUTH_NETWORK_ERROR'],
    ['unavailable', 'AUTH_NETWORK_ERROR'],
    ['deadline-exceeded', 'AUTH_NETWORK_ERROR'],
    ['auth/network-request-failed', 'AUTH_NETWORK_ERROR'],
    ['functions/internal', 'AUTH_SERVICE_UNAVAILABLE'],
  ])('lỗi %s -> %s', async (sdkCode, code) => {
    const { api, ops } = await signedUp();
    ops.failOnce('callDeleteAccount', sdk(sdkCode));
    await expect(api.auth.deleteAccount({ password: 'Mat-khau-1' })).rejects.toMatchObject({
      code,
    });
  });

  it('kết quả máy chủ không đúng dạng thì KHÔNG coi là thành công', async () => {
    const { api, ops } = await signedUp();
    ops.setDeleteResult({});
    await expect(api.auth.deleteAccount({ password: 'Mat-khau-1' })).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
    const other = await signedUp();
    other.ops.setDeleteResult({ status: 'pending_purge' });
    await expect(other.api.auth.deleteAccount({ password: 'Mat-khau-1' })).resolves.toBeUndefined();
  });

  it('createShop bị từ chối vì tài khoản đang được xóa -> ACCOUNT_DELETION_PENDING', async () => {
    const { api, ops } = await signedUp();
    ops.failOnce('callShop', sdk('functions/permission-denied', 'account_deleted'));
    await expect(api.shop.createShop({ name: 'S', sellingSources: [] })).rejects.toMatchObject({
      code: 'ACCOUNT_DELETION_PENDING',
    });
  });
});
