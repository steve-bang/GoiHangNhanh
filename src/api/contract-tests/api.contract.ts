import { AppError } from '@/core/errors/app-error';

import type { ApiClient } from '../contract';

/**
 * Bộ test hợp đồng: MỌI hiện thực của `ApiClient` (api/fake, api/firebase...) phải qua. Chỉ kiểm
 * điều hợp đồng cam kết, không kiểm chi tiết riêng của một backend (ví dụ độ dài mật khẩu tối
 * thiểu, hay kịch bản email mẫu của bản giả). Dùng email ngẫu nhiên để chạy lặp trên backend thật.
 * Chạy: `describeApiContract('tên', () => api)` trong một tệp `*.test.ts`.
 */
export function describeApiContract(name: string, makeApi: () => ApiClient): void {
  const PASSWORD = 'Mat-khau-hop-le-1';
  let counter = 0;
  const newEmail = () => `contract.${Date.now()}.${(counter += 1)}@example.com`;

  describe(`hợp đồng API: ${name}`, () => {
    it('đăng ký trả tài khoản có uid, đúng email, chưa xác thực email', async () => {
      const api = makeApi();
      const email = newEmail();
      const account = await api.auth.signUpWithEmail({ email, password: PASSWORD });
      expect(account.uid).not.toBe('');
      expect(account.email.toLowerCase()).toBe(email.toLowerCase());
      expect(account.emailVerified).toBe(false);
    });

    it('đăng ký lại cùng email (khác hoa thường) là AUTH_EMAIL_IN_USE dạng AppError', async () => {
      const api = makeApi();
      const email = newEmail();
      await api.auth.signUpWithEmail({ email, password: PASSWORD });
      const attempt = api.auth.signUpWithEmail({ email: email.toUpperCase(), password: PASSWORD });
      await expect(attempt).rejects.toBeInstanceOf(AppError);
      await expect(attempt).rejects.toMatchObject({ code: 'AUTH_EMAIL_IN_USE' });
    });

    it('đăng nhập đúng thông tin: cùng uid, chưa có shop', async () => {
      const api = makeApi();
      const email = newEmail();
      const created = await api.auth.signUpWithEmail({ email, password: PASSWORD });
      const signedIn = await api.auth.signInWithPassword({ email, password: PASSWORD });
      expect(signedIn.uid).toBe(created.uid);
      expect(signedIn.hasShop).toBe(false);
    });

    it('sai mật khẩu và email không tồn tại cùng một lỗi AUTH_INVALID_CREDENTIALS', async () => {
      const api = makeApi();
      const email = newEmail();
      await api.auth.signUpWithEmail({ email, password: PASSWORD });
      await expect(
        api.auth.signInWithPassword({ email, password: 'sai-mat-khau-9' }),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
      await expect(
        api.auth.signInWithPassword({ email: newEmail(), password: PASSWORD }),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    });

    it('quên mật khẩu TRUNG TÍNH: email có và không có tài khoản cùng resolve, cùng dạng kết quả', async () => {
      const api = makeApi();
      const registered = newEmail();
      await api.auth.signUpWithEmail({ email: registered, password: PASSWORD });
      const known = await api.auth.requestPasswordRecovery(registered);
      const unknown = await api.auth.requestPasswordRecovery(newEmail());
      expect(Object.keys(unknown).sort()).toEqual(Object.keys(known).sort());
      expect(unknown.retryAfterSeconds).toBe(known.retryAfterSeconds);
    });

    it('tạo shop: có id, giữ tên, nguồn bán bỏ trùng và theo thứ tự chuẩn', async () => {
      const api = makeApi();
      await api.auth.signUpWithEmail({ email: newEmail(), password: PASSWORD });
      const shop = await api.shop.createShop({
        name: 'Shop thử',
        sellingSources: ['lazada', 'shopee', 'lazada'],
      });
      expect(shop.id).not.toBe('');
      expect(shop.name).toBe('Shop thử');
      expect(shop.sellingSources).toEqual(['shopee', 'lazada']);
    });

    it('sửa shop: giữ id, đổi tên và nguồn bán', async () => {
      const api = makeApi();
      await api.auth.signUpWithEmail({ email: newEmail(), password: PASSWORD });
      const created = await api.shop.createShop({ name: 'Shop A', sellingSources: ['shopee'] });
      const updated = await api.shop.updateShop({
        shopId: created.id,
        name: 'Shop B',
        sellingSources: [],
      });
      expect(updated).toEqual({ id: created.id, name: 'Shop B', sellingSources: [] });
    });

    it('khôi phục phiên trả một trong ba trạng thái hợp lệ hoặc ném AppError', async () => {
      const api = makeApi();
      const result = await api.session.restore().then(
        (state) => state,
        (error: unknown) => error,
      );
      if (result instanceof AppError) return;
      expect(['signed_out', 'signed_in_no_shop', 'signed_in']).toContain(result);
    });

    it('identity trả null hoặc danh tính có uid; signOut resolve hoặc ném AppError', async () => {
      const api = makeApi();
      try {
        const identity = await api.session.identity();
        if (identity !== null) {
          expect(typeof identity.uid).toBe('string');
          expect(identity.shopId === null || typeof identity.shopId === 'string').toBe(true);
        }
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
      const out = await api.auth.signOut().then(
        () => 'ok',
        (error: unknown) => error,
      );
      expect(out === 'ok' || out instanceof AppError).toBe(true);
    });

    it('đổi mật khẩu: sai mật khẩu hiện tại bị từ chối; đúng thì đăng nhập bằng mật khẩu mới (V1-05)', async () => {
      const api = makeApi();
      const email = newEmail();
      await api.auth.signUpWithEmail({ email, password: PASSWORD });
      await expect(
        api.auth.changePassword({
          currentPassword: 'sai-mat-khau-9',
          newPassword: 'Mat-khau-moi-2',
        }),
      ).rejects.toMatchObject({ code: 'AUTH_WRONG_CURRENT_PASSWORD' });
      await api.auth.changePassword({ currentPassword: PASSWORD, newPassword: 'Mat-khau-moi-2' });
      await expect(
        api.auth.signInWithPassword({ email, password: PASSWORD }),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
      await expect(
        api.auth.signInWithPassword({ email, password: 'Mat-khau-moi-2' }),
      ).resolves.toMatchObject({ email: expect.any(String) });
    });

    it('đổi họ tên: trả đúng tên đã gửi (V1-05)', async () => {
      const api = makeApi();
      await api.auth.signUpWithEmail({ email: newEmail(), password: PASSWORD });
      await expect(api.auth.updateDisplayName('Chị Lan')).resolves.toEqual({
        displayName: 'Chị Lan',
      });
    });

    it('danh sách shop có shop vừa tạo; đổi tên giữ id (V1-05)', async () => {
      const api = makeApi();
      await api.auth.signUpWithEmail({ email: newEmail(), password: PASSWORD });
      const created = await api.shop.createShop({ name: 'Shop A', sellingSources: ['shopee'] });
      const shops = await api.shop.listMyShops();
      expect(shops.map((shop) => shop.id)).toContain(created.id);
      const renamed = await api.shop.renameShop(created.id, 'Shop B');
      expect(renamed).toMatchObject({ id: created.id, name: 'Shop B' });
      expect((await api.shop.listMyShops()).find((shop) => shop.id === created.id)?.name).toBe(
        'Shop B',
      );
    });

    // Chưa kiểm được ở bản giả (cổng shop giả không biết tài khoản hiện tại); bản Firebase phải
    // thêm ca thật: gọi createShop hai lần cùng một tài khoản trả CÙNG shop, không tạo shop thứ hai.
    it.todo('createShop idempotent theo tài khoản (decisions.md Q-13b)');
  });
}
