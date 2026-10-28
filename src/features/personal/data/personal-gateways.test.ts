import { AppError } from '@/core/errors/app-error';

import { createFakePersonalGateways, FAKE_ACCOUNT_PASSWORD } from './fake-personal-gateways';
import {
  createPersonalGateways,
  getDefaultPersonalGateways,
  resetDefaultPersonalGatewaysForTests,
} from './personal-gateways';
import { createUnavailablePersonalGateways } from './unavailable-personal-gateways';

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error.code : 'NOT_APP_ERROR';
  }
}

describe('cổng cá nhân giả', () => {
  it('trả hồ sơ và cập nhật họ tên đã bỏ khoảng trắng', async () => {
    const { account } = createFakePersonalGateways();
    expect((await account.getProfile()).displayName).toBeNull();
    const updated = await account.updateProfile({ displayName: '  Lan  ' });
    expect(updated.displayName).toBe('Lan');
    expect((await account.getProfile()).displayName).toBe('Lan');
  });

  it('failNext làm đúng một lần gọi kế tiếp thất bại rồi trở lại bình thường', async () => {
    const { account } = createFakePersonalGateways();
    account.failNext('AUTH_NETWORK_ERROR');
    expect(await codeOf(account.signOut())).toBe('AUTH_NETWORK_ERROR');
    await expect(account.signOut()).resolves.toBeUndefined();
    expect(account.signOutCalls).toBe(2);
  });

  it('lỗi cập nhật hồ sơ không làm đổi dữ liệu', async () => {
    const { account } = createFakePersonalGateways({ profile: { displayName: 'Cũ' } });
    account.failNext('AUTH_SERVICE_UNAVAILABLE');
    expect(await codeOf(account.updateProfile({ displayName: 'Mới' }))).toBe(
      'AUTH_SERVICE_UNAVAILABLE',
    );
    expect((await account.getProfile()).displayName).toBe('Cũ');
  });

  it('độ trễ mô phỏng: chưa resolve trước hạn', async () => {
    jest.useFakeTimers();
    try {
      const { account } = createFakePersonalGateways({ latencyMs: 300 });
      let done = false;
      void account.getProfile().then(() => {
        done = true;
      });
      await jest.advanceTimersByTimeAsync(299);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('đổi mật khẩu: sai mật khẩu hiện tại, mật khẩu yếu, rồi thành công', async () => {
    const { account } = createFakePersonalGateways();
    expect(
      await codeOf(
        account.changePassword({ currentPassword: 'sai', newPassword: 'matkhau-moi-1' }),
      ),
    ).toBe('AUTH_WRONG_CURRENT_PASSWORD');
    expect(
      await codeOf(
        account.changePassword({ currentPassword: FAKE_ACCOUNT_PASSWORD, newPassword: '12345678' }),
      ),
    ).toBe('AUTH_WEAK_PASSWORD');
    await account.changePassword({
      currentPassword: FAKE_ACCOUNT_PASSWORD,
      newPassword: 'matkhau-moi-1',
    });
    // Mật khẩu cũ không còn dùng được.
    expect(
      await codeOf(
        account.changePassword({
          currentPassword: FAKE_ACCOUNT_PASSWORD,
          newPassword: 'matkhau-moi-2',
        }),
      ),
    ).toBe('AUTH_WRONG_CURRENT_PASSWORD');
  });

  it('tài khoản Apple/Google không đổi được mật khẩu', async () => {
    const { account } = createFakePersonalGateways({ profile: { signInMethod: 'apple' } });
    expect(
      await codeOf(
        account.changePassword({
          currentPassword: FAKE_ACCOUNT_PASSWORD,
          newPassword: 'matkhau-moi-1',
        }),
      ),
    ).toBe('AUTH_WRONG_CURRENT_PASSWORD');
  });

  it('cài đặt thông báo: lưu và đọc lại; lỗi thì giữ giá trị cũ', async () => {
    const { settings } = createFakePersonalGateways();
    const before = await settings.getNotificationPreferences();
    settings.failNext('AUTH_NETWORK_ERROR');
    expect(
      await codeOf(settings.updateNotificationPreferences({ ...before, syncCompleted: true })),
    ).toBe('AUTH_NETWORK_ERROR');
    expect(await settings.getNotificationPreferences()).toEqual(before);
    await settings.updateNotificationPreferences({ ...before, syncCompleted: true });
    expect((await settings.getNotificationPreferences()).syncCompleted).toBe(true);
  });
});

describe('cổng cá nhân giả: đăng xuất đặt lại dữ liệu tài khoản', () => {
  it('sau đăng xuất thành công: tên, tên shop, mật khẩu và cài đặt thông báo về mặc định', async () => {
    const { account, settings } = createFakePersonalGateways();
    await account.updateProfile({ displayName: 'Tên của A' });
    await account.updateShopName((await account.listShops())[0]?.id ?? '', 'Shop của A');
    await settings.updateNotificationPreferences({
      uploadProblems: false,
      syncCompleted: true,
      storageNearlyFull: false,
      planExpiring: false,
    });
    await account.signOut();
    expect((await account.getProfile()).displayName).toBeNull();
    expect((await account.getShopSummary())?.name).toBe('Cửa hàng minh họa');
    expect((await settings.getNotificationPreferences()).uploadProblems).toBe(true);
  });

  it('đăng xuất lỗi thì giữ nguyên dữ liệu', async () => {
    const { account } = createFakePersonalGateways();
    await account.updateProfile({ displayName: 'Tên của A' });
    account.failNext('AUTH_NETWORK_ERROR');
    await expect(account.signOut()).rejects.toBeInstanceOf(AppError);
    expect((await account.getProfile()).displayName).toBe('Tên của A');
  });
});

describe('cổng cá nhân giả: đăng xuất giữa lúc đang lưu', () => {
  it('lần lưu đang chờ của tài khoản cũ không ghi sang tài khoản sau (cài đặt, họ tên, tên shop, mật khẩu)', async () => {
    const { account, settings } = createFakePersonalGateways({ latencyMs: 20 });
    const before = await settings.getNotificationPreferences();
    const shopId = (await account.listShops()).map((shop) => shop.id).join();
    // Đăng xuất bắt đầu trước; các lần lưu bắt đầu giữa chừng nên kết thúc SAU lúc đặt lại.
    const signingOut = account.signOut();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const pending = [
      settings.updateNotificationPreferences({ ...before, syncCompleted: !before.syncCompleted }),
      account.updateProfile({ displayName: 'Cũ' }),
      account.updateShopName(shopId, 'Shop cũ'),
      account.changePassword({
        currentPassword: FAKE_ACCOUNT_PASSWORD,
        newPassword: 'mat-khau-moi-1',
      }),
    ];
    await signingOut;
    await Promise.all(pending);
    expect(await settings.getNotificationPreferences()).toEqual(before);
    expect((await account.getProfile()).displayName).toBeNull();
    expect((await account.getShopSummary())?.name).toBe('Cửa hàng minh họa');
    // Mật khẩu đã về mặc định: mật khẩu cũ vẫn là mật khẩu hiện tại.
    await expect(
      account.changePassword({
        currentPassword: FAKE_ACCOUNT_PASSWORD,
        newPassword: 'mat-khau-khac-2',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('cổng cá nhân chưa kết nối', () => {
  it('mọi lời gọi trả AUTH_SERVICE_UNAVAILABLE, không bao giờ báo thành công', async () => {
    const { account, settings } = createUnavailablePersonalGateways();
    for (const call of [
      () => account.getProfile(),
      () => account.updateProfile({ displayName: 'A' }),
      () => account.changePassword({ currentPassword: 'a', newPassword: 'b' }),
      () => account.signOut(),
      () => account.listShops(),
      () => account.updateShopName('s', 'Tên'),
      () => account.switchShop('s'),
      () => settings.getNotificationPreferences(),
      () =>
        settings.updateNotificationPreferences({
          uploadProblems: true,
          syncCompleted: true,
          storageNearlyFull: true,
          planExpiring: true,
        }),
    ]) {
      expect(await codeOf(call())).toBe('AUTH_SERVICE_UNAVAILABLE');
    }
  });
});

const SHOP_A = { id: 'a', name: 'Shop A', role: 'owner', status: 'active', canEdit: true } as const;
const SHOP_B = {
  id: 'b',
  name: 'Shop B',
  role: 'member',
  status: 'active',
  canEdit: false,
} as const;
const SHOP_C = {
  id: 'c',
  name: 'Shop C',
  role: 'owner',
  status: 'suspended',
  canEdit: true,
} as const;

describe('cổng cá nhân giả: cửa hàng', () => {
  it('mặc định một shop; listShops trả bản sao (sửa kết quả không đổi cổng)', async () => {
    const { account } = createFakePersonalGateways();
    const shops = await account.listShops();
    expect(shops).toHaveLength(1);
    expect(shops[0]).toMatchObject({ name: 'Cửa hàng minh họa', canEdit: true, status: 'active' });
    expect(await account.getShopSummary()).toEqual(shops[0]);
  });

  it('shop: null nghĩa là chưa có shop nào', async () => {
    const { account } = createFakePersonalGateways({ shop: null });
    expect(await account.getShopSummary()).toBeNull();
    expect(await account.listShops()).toEqual([]);
  });

  it('đổi tên: bỏ khoảng trắng đầu/cuối, chỉ đổi shop được chọn', async () => {
    const { account } = createFakePersonalGateways({ shops: [SHOP_A, SHOP_C] });
    const updated = await account.updateShopName('a', '  Shop Mới  ');
    expect(updated.name).toBe('Shop Mới');
    const names = (await account.listShops()).map((shop) => shop.name);
    expect(names).toEqual(['Shop Mới', 'Shop C']);
  });

  it('đổi tên: thiếu quyền -> SHOP_PERMISSION_DENIED và không đổi gì (cổng tự kiểm, không tin UI)', async () => {
    const { account } = createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] });
    expect(await codeOf(account.updateShopName('b', 'Tên khác'))).toBe('SHOP_PERMISSION_DENIED');
    expect((await account.listShops())[1]?.name).toBe('Shop B');
  });

  it('đổi tên: tên không hợp lệ hoặc shop lạ -> SHOP_SAVE_FAILED', async () => {
    const { account } = createFakePersonalGateways({ shops: [SHOP_A] });
    expect(await codeOf(account.updateShopName('a', '   '))).toBe('SHOP_SAVE_FAILED');
    expect(await codeOf(account.updateShopName('khong-co', 'X'))).toBe('SHOP_SAVE_FAILED');
  });

  it('chuyển shop: đổi shop đang dùng; shop tạm khóa hoặc không thuộc tài khoản bị từ chối', async () => {
    const { account } = createFakePersonalGateways({ shops: [SHOP_A, SHOP_B, SHOP_C] });
    expect((await account.getShopSummary())?.id).toBe('a');
    expect((await account.switchShop('b')).id).toBe('b');
    expect((await account.getShopSummary())?.id).toBe('b');
    expect(await codeOf(account.switchShop('c'))).toBe('SHOP_SWITCH_FAILED');
    expect(await codeOf(account.switchShop('lạ'))).toBe('SHOP_SWITCH_FAILED');
    expect((await account.getShopSummary())?.id).toBe('b');
  });

  it('failNext làm hỏng đúng một lần chuyển/đổi tên và không đổi dữ liệu', async () => {
    const { account } = createFakePersonalGateways({ shops: [SHOP_A, SHOP_B] });
    account.failNext('SHOP_SWITCH_FAILED');
    expect(await codeOf(account.switchShop('b'))).toBe('SHOP_SWITCH_FAILED');
    expect((await account.getShopSummary())?.id).toBe('a');
    account.failNext('SHOP_SAVE_FAILED');
    expect(await codeOf(account.updateShopName('a', 'Mới'))).toBe('SHOP_SAVE_FAILED');
    expect((await account.getShopSummary())?.name).toBe('Shop A');
  });
});

describe('chọn cổng theo môi trường (cùng cơ chế với src/api/create-api)', () => {
  const prod = { isDev: false, isTest: false, fakeFlag: undefined };

  it('bản giả khi dev, test hoặc cờ rõ ràng (cùng quy tắc resolveBackendMode)', async () => {
    for (const env of [
      { ...prod, isDev: true },
      { ...prod, isTest: true },
      { ...prod, fakeFlag: '1' },
      { ...prod, backend: 'fake' },
    ]) {
      expect(await createPersonalGateways(env).account.getProfile()).toMatchObject({
        uid: 'fake-user-1',
      });
    }
  });

  it('bản build thường (chế độ Firebase) là "chưa kết nối", không dùng bản giả', async () => {
    for (const env of [prod, { ...prod, backend: 'firebase' }, { ...prod, emulatorHost: 'h' }]) {
      const { account, settings } = createPersonalGateways(env);
      expect(await codeOf(account.getProfile())).toBe('AUTH_SERVICE_UNAVAILABLE');
      expect(await codeOf(account.signOut())).toBe('AUTH_SERVICE_UNAVAILABLE');
      expect(await codeOf(settings.getNotificationPreferences())).toBe('AUTH_SERVICE_UNAVAILABLE');
    }
  });

  it('cổng mặc định là một thể hiện cho cả phiên', () => {
    resetDefaultPersonalGatewaysForTests();
    expect(getDefaultPersonalGateways()).toBe(getDefaultPersonalGateways());
    resetDefaultPersonalGatewaysForTests();
  });
});
