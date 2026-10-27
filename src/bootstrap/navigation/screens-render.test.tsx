import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import nav from '@/core/i18n/locales/vi/nav.json';
import { ROUTES, type RouteDef } from '@/core/navigation';
import { ILLUSTRATIVE_SHOP_NAME } from '@/shared/fixtures/illustrative-data';
import { resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

const APP_DIR = join(__dirname, '..', '..', 'app');

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Tệp route thật của app, ngoại trừ layout và route gốc (chuyển hướng Splash). */
const routeFiles = listFiles(APP_DIR)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !/_layout\.tsx$/.test(file))
  .filter((file) => relative(APP_DIR, file) !== 'index.tsx');

function routeOf(file: string): RouteDef {
  const segments = relative(APP_DIR, file)
    .replace(/\.tsx$/, '')
    .split(/[\\/]/)
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
    .filter((s) => s !== 'index');
  const path = '/' + segments.join('/');
  const route = Object.values(ROUTES).find((r) => r.path === path);
  if (!route) throw new Error(`Route không có trong ROUTES: ${path}`);
  return route;
}

beforeEach(() => {
  resetMockNavigation();
});

describe('mọi route của app render được (khung giao diện)', () => {
  it.each(routeFiles.map((file) => [relative(APP_DIR, file), file]))('%s', async (_name, file) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Screen = (require(file as string) as { default: ComponentType }).default;
    const route = routeOf(file as string);
    await renderWithProviders(<Screen />);

    expect(screen.getByTestId(`screen-${route.code}`)).toBeOnTheScreen();
    // Màn quay là toàn màn hình camera và Chào mừng (UI-A02) là màn thương hiệu: không có thanh
    // tiêu đề; các màn còn lại hiện đúng tiêu đề.
    // Riêng Tổng quan (UI-B01) tiêu đề là tên shop (docs/09), tên tab vẫn là "Tổng quan".
    if (route.code === 'UI-B01') {
      expect(screen.getByText(ILLUSTRATIVE_SHOP_NAME)).toBeOnTheScreen();
    } else if (
      !['UI-C03', 'UI-D04', 'UI-A02'].includes(route.code) &&
      // Ba màn thiết lập thật (đăng ký, tạo shop, hoàn tất) có tiêu đề riêng theo mockup, không phải
      // tiêu đề danh mục; `/sign-in` vẫn là màn khung.
      !['/sign-up', '/create-shop', '/setup-done'].includes(route.path)
    ) {
      expect(screen.getAllByText(nav.titles[route.code]).length).toBeGreaterThan(0);
    }
  });
});
