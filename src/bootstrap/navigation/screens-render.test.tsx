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

/** Tệp route thật của app, ngoại trừ layout. */
const routeFiles = listFiles(APP_DIR)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !/_layout\.tsx$/.test(file))
  // Các màn có chặn vào khi chưa qua bước trước (render rỗng rồi chuyển về bước đầu): có test riêng
  // ở VerifyOtpScreen.test.tsx, NewPasswordScreen.test.tsx và RecoveryEmailSentScreen.test.tsx.
  .filter((file) => !/(verify-otp|new-password|forgot-password[\\/]sent)\.tsx$/.test(file))
  // Chỗ giữ của nút Quét giữa thanh tab: chỉ chuyển hướng, không có màn riêng (xem tab-config.ts).
  .filter((file) => !/scan-tab\.tsx$/.test(file));

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

    // Route con (Q-20k) dùng chung mã UI với route gốc nên testID có thêm đoạn cuối của đường dẫn
    // (segment động `[articleId]` thành `articleId`).
    const testID = route.parent
      ? `screen-${route.code}-${(route.path.split('/').pop() ?? '').replace(/[[\]]/g, '')}`
      : `screen-${route.code}`;
    expect(screen.getByTestId(testID)).toBeOnTheScreen();
    // Màn quay là toàn màn hình camera, Splash (UI-A01) và Chào mừng (UI-A02) là màn thương hiệu:
    // không có thanh tiêu đề; các màn còn lại hiện đúng tiêu đề.
    // Riêng Tổng quan (UI-B01) tiêu đề là tên shop (docs/09), tên tab vẫn là "Tổng quan".
    if (route.code === 'UI-B01') {
      expect(screen.getByText(ILLUSTRATIVE_SHOP_NAME)).toBeOnTheScreen();
    } else if (route.parent) {
      const key = Object.keys(ROUTES).find((name) => ROUTES[name as keyof typeof ROUTES] === route);
      expect(
        screen.getAllByText(nav.subTitles[key as keyof typeof nav.subTitles]).length,
      ).toBeGreaterThan(0);
    } else if (
      !['UI-C03', 'UI-D04', 'UI-A01', 'UI-A02'].includes(route.code) &&
      // Các màn thiết lập/đăng nhập thật (đăng ký, tạo shop, hoàn tất, đăng nhập, quên mật khẩu) có tiêu đề riêng theo mockup, không phải
      // tiêu đề danh mục; màn đăng nhập và Quên mật khẩu cũng có tiêu đề riêng theo mockup 05.
      !['/sign-up', '/create-shop', '/setup-done', '/sign-in', '/forgot-password'].includes(
        route.path,
      )
    ) {
      expect(screen.getAllByText(nav.titles[route.code]).length).toBeGreaterThan(0);
    }
  });
});
