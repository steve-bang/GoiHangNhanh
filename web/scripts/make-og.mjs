// Tạo public/og-default.png (1200x630) từ tên/tagline trong src/config/site.ts và icon của app.
// Chạy lại khi đổi tên thương hiệu: node scripts/make-og.mjs
// Cần font hệ thống có tiếng Việt (DejaVu Sans, Noto Sans...). Hình chỉ là giữ chỗ chờ designer.
import sharp from 'sharp';
import { site } from '../src/config/site.ts';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const icon = await sharp('../assets/images/icon.png').resize(260, 260).png().toBuffer();
// Màu lấy từ docs/design-token-spec.md: jade.950, neutral.0, jade.100
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#14382A"/>
  <text x="340" y="300" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="88" font-weight="700" fill="#FFFFFF">${esc(site.name)}</text>
  <text x="340" y="375" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="28" fill="#E6F0E9">${esc(site.tagline)}</text>
</svg>`;
await sharp(Buffer.from(svg))
  .composite([{ input: icon, left: 60, top: 185 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og-default.png');
console.log('Đã tạo public/og-default.png');
