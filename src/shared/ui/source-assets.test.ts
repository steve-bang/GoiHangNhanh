import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../..');
const FILES = ['assets/images/sources/shopee.png', 'assets/images/sources/tiktok-shop.png'];
const ORIGINALS = [
  'docs/assets/brand/sources/shopee-original.jpg',
  'docs/assets/brand/sources/tiktok-shop-original.png',
];

describe('logo nguồn bán', () => {
  it.each(FILES)('%s tồn tại, là PNG vuông <= 512px và < 100 KB', (file) => {
    const path = join(ROOT, file);
    expect(existsSync(path)).toBe(true);
    const buf = readFileSync(path);
    expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(height);
    expect(width).toBeLessThanOrEqual(512);
    expect(statSync(path).size).toBeLessThan(100 * 1024);
  });

  it.each(ORIGINALS)('bản gốc %s được lưu để truy nguồn', (file) => {
    expect(existsSync(join(ROOT, file))).toBe(true);
  });
});
