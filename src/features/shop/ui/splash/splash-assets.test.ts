import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { colors } from '@/core/theme';

import { HERO_IMAGE } from './splash-layout';

const ROOT = join(__dirname, '../../../../..');
const read = (file: string) => readFileSync(join(ROOT, file));

/** Đọc kích thước + cờ alpha từ khung VP8X của WebP (ảnh có alpha dùng khung mở rộng). */
function readWebp(buf: Buffer) {
  expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buf.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(buf.subarray(12, 16).toString('ascii')).toBe('VP8X');
  return {
    hasAlpha: (buf.readUInt8(20) & 0x10) !== 0,
    width: 1 + buf.readUIntLE(24, 3),
    height: 1 + buf.readUIntLE(27, 3),
  };
}

function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('ảnh minh họa Splash', () => {
  const file = 'assets/images/splash/splash-hero.webp';

  it('tồn tại, là WebP có alpha, đúng kích thước đã cắt và < 400 KB', () => {
    expect(existsSync(join(ROOT, file))).toBe(true);
    const info = readWebp(read(file));
    expect(info.hasAlpha).toBe(true);
    expect({ width: info.width, height: info.height }).toEqual(HERO_IMAGE);
    expect(statSync(join(ROOT, file)).size).toBeLessThan(400 * 1024);
  });

  it('giữ bản gốc PNG (1024x1536) và ảnh thiết kế tham chiếu để truy nguồn', () => {
    const original = 'docs/assets/brand/splash/splash-hero-original.png';
    expect(pngSize(read(original))).toEqual({ width: 1024, height: 1536 });
    expect(pngSize(read('docs/assets/ui/06-splash-design.png'))).toEqual({
      width: 1024,
      height: 1536,
    });
    expect(existsSync(join(ROOT, 'docs/assets/brand/splash/brand-mark-play.svg'))).toBe(true);
  });
});

describe('cấu hình splash hệ điều hành và icon (app.json)', () => {
  const config = JSON.parse(read('app.json').toString('utf8')) as {
    expo: {
      icon: string;
      android: { adaptiveIcon: { foregroundImage: string; backgroundColor: string } };
      plugins: (string | [string, Record<string, unknown>])[];
    };
  };
  const plugin = config.expo.plugins.find(
    (p): p is [string, Record<string, unknown>] =>
      Array.isArray(p) && p[0] === 'expo-splash-screen',
  );

  it('có plugin expo-splash-screen với nền = màu nền Splash và ảnh tồn tại', () => {
    expect(plugin).toBeDefined();
    const options = (plugin as [string, Record<string, unknown>])[1] as {
      backgroundColor: string;
      image: string;
      dark?: unknown;
      android: { image: string; imageWidth: number; dark?: unknown };
    };
    expect(options.backgroundColor.toUpperCase()).toBe(colors.splashBackground.toUpperCase());
    // userInterfaceStyle "light": không cấu hình splash tối (expo prebuild cảnh báo nếu có cả hai).
    expect(options.dark).toBeUndefined();
    expect(options.android.dark).toBeUndefined();
    for (const image of [options.image, options.android.image]) {
      expect(existsSync(join(ROOT, image))).toBe(true);
    }
    // Android 12+ cắt biểu tượng trong vòng tròn của khung 288dp: ảnh phải vuông và có đệm.
    expect(options.android.imageWidth).toBe(288);
    const size = pngSize(read(options.android.image));
    expect(size.width).toBe(size.height);
  });

  it('icon ứng dụng và icon thích ứng Android (tạm) tồn tại, vuông 1024', () => {
    const { icon, android } = config.expo;
    expect(pngSize(read(icon))).toEqual({ width: 1024, height: 1024 });
    expect(pngSize(read(android.adaptiveIcon.foregroundImage))).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(android.adaptiveIcon.backgroundColor.toUpperCase()).toBe(
      colors.splashBackground.toUpperCase(),
    );
  });
});
