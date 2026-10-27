import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import nav from '@/core/i18n/locales/vi/nav.json';
import { ROUTES, UI_CODES, isTabBarHiddenAt, type RouteDef } from '@/core/navigation';

import { TAB_CONFIG } from './tab-config';

const APP_DIR = join(__dirname, '..', '..', 'app');

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Tệp route (không tính _layout) -> { URL, có nằm trong nhóm (tabs) không }. */
function screenFiles() {
  return listFiles(APP_DIR)
    .map((file) => relative(APP_DIR, file).split('\\').join('/'))
    .filter((file) => file.endsWith('.tsx') && !(file.split('/').pop() ?? '').startsWith('_layout'))
    .map((file) => {
      const segments = file.replace(/\.tsx$/, '').split('/');
      const inTabs = segments[0] === '(tabs)';
      const url =
        '/' +
        segments
          .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
          .filter((s) => s !== 'index')
          .join('/');
      return { file, url: url === '/' ? '/' : url.replace(/\/$/, ''), inTabs };
    });
}

/** Tệp giữ chỗ của nút Quét giữa thanh tab (chỉ chuyển hướng, không phải route trong ROUTES). */
const TAB_ACTION_FILES = TAB_CONFIG.filter((tab) => 'action' in tab).map(
  (tab) => `(tabs)/${tab.name}.tsx`,
);

describe('bảng route <-> mã UI-xx (docs/09 mục 4)', () => {
  const allFiles = screenFiles();
  const files = allFiles.filter((f) => !TAB_ACTION_FILES.includes(f.file));

  it('mỗi route trong ROUTES có đúng một tệp route và ngược lại', () => {
    const fromFiles = files.map((f) => f.url).sort();
    const fromTable = Object.values(ROUTES)
      .map((r) => r.path)
      .sort();
    expect(fromFiles).toEqual(fromTable);
  });

  it('mỗi mã UI-xx trong danh mục có route; không mã lạ', () => {
    const codes = Object.values(ROUTES).map((r) => r.code);
    // UI-F04 (banner ngoại tuyến) và nhóm J (ngoại lệ) không phải route; mọi mã còn lại đều có.
    expect([...new Set(codes)].sort()).toEqual([...UI_CODES].sort());
  });

  it('một mã UI chỉ có nhiều route khi là ngoại lệ UI-A03 hoặc route con khai báo rõ parent (Q-19k)', () => {
    const roots = Object.values(ROUTES).filter((r) => !r.parent);
    // Route gốc: mỗi mã đúng một, trừ UI-A03 (đăng nhập + đăng ký, một màn hai chế độ).
    const rootCodes = roots.map((r) => r.code);
    const repeatedRoots = rootCodes.filter((code, i) => rootCodes.indexOf(code) !== i);
    expect(repeatedRoots).toEqual(['UI-A03']);
  });

  it('route con (parent): trỏ tới route gốc có thật, cùng mã UI, cùng cờ tabBar, gốc không phải con', () => {
    const children = Object.entries(ROUTES).filter(([, r]) => 'parent' in r && r.parent);
    // Chỉ các route con đã duyệt (PR2: hồ sơ, mật khẩu; PR4: sửa và chuyển cửa hàng, cùng mã UI-I02);
    // thêm route con mới phải được người dùng duyệt và sửa danh sách này.
    expect(children.map(([name]) => name).sort()).toEqual([
      'changePassword',
      'editProfile',
      'shopEdit',
      'shopSwitch',
    ]);
    for (const [name, child] of children) {
      const parent = (ROUTES as Record<string, RouteDef | undefined>)[child.parent ?? ''];
      expect(parent).toBeDefined();
      expect(parent?.parent).toBeUndefined();
      expect(parent?.code).toBe(child.code);
      expect(parent?.tabBar).toBe(child.tabBar);
      expect(child.path.startsWith('/account/')).toBe(true);
      expect(name).not.toBe(child.parent);
    }
    expect(ROUTES.editProfile).toMatchObject({ parent: 'profile', code: 'UI-I01' });
    expect(ROUTES.changePassword).toMatchObject({ parent: 'security', code: 'UI-I05' });
    expect(ROUTES.shopEdit).toMatchObject({ parent: 'shopSettings', code: 'UI-I02' });
    expect(ROUTES.shopSwitch).toMatchObject({ parent: 'shopSettings', code: 'UI-I02' });
  });

  it('route con có tiêu đề riêng trong nav.subTitles', () => {
    expect(nav.subTitles.editProfile).toBeTruthy();
    expect(nav.subTitles.changePassword).toBeTruthy();
    expect(nav.subTitles.shopEdit).toBeTruthy();
    expect(nav.subTitles.shopSwitch).toBeTruthy();
  });

  it('mỗi mã UI-xx có tiêu đề i18n', () => {
    for (const code of UI_CODES) {
      expect(nav.titles[code]).toBeTruthy();
    }
  });

  it('cờ tabBar khớp vị trí tệp: route ngoài nhóm (tabs) không có thanh tab; trong nhóm có', () => {
    for (const file of files) {
      const route = Object.values(ROUTES).find((r) => r.path === file.url);
      expect(route?.tabBar).toBe(file.inTabs);
    }
  });

  it('màn quét UI-B02 là route cấp gốc ngoài nhóm tab (Back về đúng màn trước) và ẩn thanh tab', () => {
    expect(ROUTES.scan).toMatchObject({ path: '/scan', code: 'UI-B02', tabBar: false });
    expect(files.find((f) => f.url === ROUTES.scan.path)?.inTabs).toBe(false);
    expect(isTabBarHiddenAt('/scan')).toBe(true);
    expect(isTabBarHiddenAt('/home')).toBe(false);
    expect(isTabBarHiddenAt('/home/quick-order')).toBe(false);
    expect(isTabBarHiddenAt('/account/plan')).toBe(false);
  });

  it('Tạo đơn nhanh (UI-B04) và Xác nhận đơn (UI-C01) là route cấp gốc, ngoài nhóm tab, không có thanh tab', () => {
    expect(ROUTES.quickOrder).toMatchObject({
      path: '/quick-order',
      code: 'UI-B04',
      tabBar: false,
    });
    expect(ROUTES.orderPreview).toMatchObject({
      path: '/order-preview',
      code: 'UI-C01',
      tabBar: false,
    });
    for (const route of [ROUTES.quickOrder, ROUTES.orderPreview]) {
      expect(files.find((f) => f.url === route.path)?.inTabs).toBe(false);
    }
  });

  it('Hàng hoàn và Đồng bộ không còn là tab: nằm ngoài nhóm (tabs), không có thanh tab', () => {
    for (const route of [ROUTES.returns, ROUTES.returnFindOrder, ROUTES.sync, ROUTES.storage]) {
      expect(route.tabBar).toBe(false);
      expect(files.find((f) => f.url === route.path)?.inTabs).toBe(false);
    }
  });

  it('luồng khôi phục mật khẩu có mã UI-A07, UI-A08, UI-A09 và không có thanh tab', () => {
    expect(ROUTES.forgotPassword).toMatchObject({
      path: '/forgot-password',
      code: 'UI-A07',
      tabBar: false,
    });
    expect(ROUTES.verifyOtp).toMatchObject({ path: '/verify-otp', code: 'UI-A08', tabBar: false });
    expect(ROUTES.newPassword).toMatchObject({
      path: '/new-password',
      code: 'UI-A09',
      tabBar: false,
    });
  });

  it('màn quay (UI-C03, UI-D04) nằm ngoài nhóm tab nên ẩn thanh tab', () => {
    expect(ROUTES.packRecord.code).toBe('UI-C03');
    expect(ROUTES.returnRecord.code).toBe('UI-D04');
    expect(ROUTES.packRecord.tabBar).toBe(false);
    expect(ROUTES.returnRecord.tabBar).toBe(false);
    for (const route of [ROUTES.packRecord, ROUTES.returnRecord]) {
      const file = files.find((f) => f.url === route.path);
      expect(file?.inTabs).toBe(false);
    }
  });

  it('thư mục tab của app khớp danh sách tab', () => {
    const tabEntries = new Set(
      allFiles
        .filter((f) => f.inTabs)
        .map((f) => (f.file.split('/')[1] ?? '').replace(/\.tsx$/, '')),
    );
    expect([...tabEntries].sort()).toEqual([...TAB_CONFIG.map((tab) => tab.name)].sort());
  });
});
