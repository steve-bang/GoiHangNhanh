import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import nav from '@/core/i18n/locales/vi/nav.json';
import { ROUTES, UI_CODES } from '@/core/navigation';

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

describe('bảng route <-> mã UI-xx (docs/09 mục 4)', () => {
  const files = screenFiles();

  it('mỗi route trong ROUTES có đúng một tệp route và ngược lại', () => {
    const fromFiles = files.map((f) => f.url).sort();
    const fromTable = Object.values(ROUTES)
      .map((r) => r.path)
      .sort();
    expect(fromFiles).toEqual(fromTable);
  });

  it('mỗi mã UI-xx trong danh mục có route; không mã lạ; chỉ UI-A03 có hai route', () => {
    const codes = Object.values(ROUTES).map((r) => r.code);
    // UI-F04 (banner ngoại tuyến) và nhóm J (ngoại lệ) không phải route; mọi mã còn lại đều có.
    expect([...new Set(codes)].sort()).toEqual([...UI_CODES].sort());
    // UI-A03 có hai route (đăng nhập, đăng ký); mọi mã khác đúng một route.
    const repeated = codes.filter((code, i) => codes.indexOf(code) !== i);
    expect(repeated).toEqual(['UI-A03']);
  });

  it('mỗi mã UI-xx có tiêu đề i18n', () => {
    for (const code of UI_CODES) {
      expect(nav.titles[code]).toBeTruthy();
    }
  });

  it('cờ tabBar khớp vị trí tệp: chỉ route trong nhóm (tabs) có thanh tab', () => {
    for (const file of files) {
      const route = Object.values(ROUTES).find((r) => r.path === file.url);
      expect(route?.tabBar).toBe(file.inTabs);
    }
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
    const tabDirs = new Set(files.filter((f) => f.inTabs).map((f) => f.file.split('/')[1]));
    expect([...tabDirs].sort()).toEqual(['home', 'orders', 'returns', 'sync']);
  });
});
