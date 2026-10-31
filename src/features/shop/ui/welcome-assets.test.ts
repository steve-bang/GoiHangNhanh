import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { WELCOME_HERO_IMAGE } from './WelcomeHero';

const ROOT = join(__dirname, '../../../..');

describe('ảnh minh họa Chào mừng', () => {
  const file = 'assets/images/welcome/welcome-hero.webp';

  it('là WebP có alpha, đúng kích thước khai báo và < 300 KB', () => {
    const buf = readFileSync(join(ROOT, file));
    expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(buf.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(buf.subarray(12, 16).toString('ascii')).toBe('VP8X');
    expect((buf.readUInt8(20) & 0x10) !== 0).toBe(true);
    expect({ width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }).toEqual(
      WELCOME_HERO_IMAGE,
    );
    expect(statSync(join(ROOT, file)).size).toBeLessThan(300 * 1024);
  });

  it('giữ bản gốc PNG để truy nguồn', () => {
    const original = readFileSync(
      join(ROOT, 'docs/assets/brand/welcome/welcome-hero-original.png'),
    );
    expect(original.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(existsSync(join(ROOT, file))).toBe(true);
  });
});
