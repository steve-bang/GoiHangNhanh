'use strict';
/**
 * Chụp ảnh gốc màn Danh sách đơn hàng từ bản web cổng giả của app (không dựng giao diện giả).
 * Dữ liệu mẫu được NHẬP QUA CHÍNH ỨNG DỤNG (Tạo đơn nhanh): mã đơn/mã vận đơn/sản phẩm là dữ liệu mẫu
 * tự đặt, không phải dữ liệu thật. Cách dùng: node capture-orders.cjs <thư-mục-dist-web> <thư-mục-ra>
 * `dist-web` là bản xuất bằng `scripts/screens/capture.cjs` (phiên signed_in, cổng giả).
 */
const path = require('node:path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { startStaticServer } = require(path.resolve(__dirname, '../../scripts/screens/serve.cjs'));

const ORDERS = [
  { code: 'SP2611-48213', src: 'shopee', name: 'Áo thun cotton basic', variant: 'Trắng, size M', tracking: 'SPXVN0412345678' },
  { code: 'TT2611-90377', src: 'tiktok_shop', name: 'Tai nghe bluetooth mini', variant: 'Đen', tracking: null },
  { code: 'LZ2611-15520', src: 'lazada', name: 'Ốp lưng điện thoại trong suốt', variant: 'iPhone 14', tracking: null },
  { code: 'SP2611-48307', src: 'shopee', name: 'Bình giữ nhiệt inox 500 ml', variant: 'Xanh mint', tracking: 'SPXVN0412399021' },
  { code: 'DH-0042', src: 'other', name: 'Nến thơm handmade', variant: 'Oải hương', tracking: null },
];

(async () => {
  const [dist, out] = process.argv.slice(2);
  if (!dist || !out) throw new Error('Thiếu tham số: <dist-web> <thư-mục-ra>');
  const srv = await startStaticServer(dist, 4721);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const vid = (id) => p.locator(`[data-testid="${id}"]:visible`).first();
  const vtxt = (t) => p.locator(`text="${t}" >> visible=true`).first();
  await p.goto(srv.url + '/home');
  await p.waitForTimeout(1500);
  for (const o of ORDERS) {
    await vtxt('Tạo đơn nhanh').click();
    await p.waitForTimeout(500);
    await vid('quick-order-code').fill(o.code);
    await vid('source-change').click();
    await vid('source-option-' + o.src).click();
    await p.waitForTimeout(300);
    await vid('line-name-0').fill(o.name);
    await vid('line-variant-0').fill(o.variant);
    if (o.tracking) {
      await vid('quick-add-tracking').click();
      await p.waitForTimeout(200);
      await vid('quick-tracking').fill(o.tracking);
    }
    await vid('quick-continue').click();
    await p.waitForTimeout(500);
    await vid('quick-create').click();
    await p.waitForTimeout(900);
    await vtxt('Trang chủ').click();
    await p.waitForTimeout(500);
  }
  await vtxt('Danh sách đơn').click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(out, 'orders-list-780x1688.png') });
  await browser.close();
  await srv.close();
  if (errors.length) {
    console.error('Lỗi trang:', errors.join('; '));
    process.exit(1);
  }
  console.log('Đã chụp orders-list-780x1688.png');
})();
