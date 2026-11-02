// Tạo public/og-default.png (1200x630) từ tên/tagline trong src/config/site.ts và icon của app.
// Chạy lại khi đổi tên thương hiệu: node scripts/make-og.mjs
// Cần font hệ thống có tiếng Việt (DejaVu Sans, Noto Sans...). Hình chỉ là giữ chỗ chờ designer.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { site } from '../src/config/site.ts';

// Màu lấy từ src/styles/tokens.css (cùng nguồn với giao diện web, khớp token app).
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const token = (n) => css.match(new RegExp(`--${n}:\\s*([^;]+);`))[1].trim();
const bg = token('orange-900');
const fg = token('neutral-0');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const icon = await sharp('../assets/images/icon.png').resize(260, 260).png().toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${bg}"/>
  <text x="340" y="300" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="88" font-weight="700" fill="${fg}">${esc(site.name)}</text>
  <text x="340" y="375" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="28" fill="${fg}" fill-opacity="0.75">${esc(site.tagline)}</text>
</svg>`;
await sharp(Buffer.from(svg))
  .composite([{ input: icon, left: 60, top: 185 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og-default.png');
console.log('Đã tạo public/og-default.png');
