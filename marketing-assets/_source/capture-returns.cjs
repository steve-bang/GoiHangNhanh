'use strict';
/**
 * Chụp ảnh gốc luồng Nhận hàng hoàn (UI-D03 Tình trạng kiện bên ngoài, UI-D05 Kiểm tra hàng thực nhận)
 * từ bản web cổng giả của app. Dữ liệu mẫu (đơn gốc, tình trạng kiện, số lượng thực nhận, ghi chú) được
 * nhập QUA CHÍNH ỨNG DỤNG; không phải dữ liệu thật. Ứng dụng chỉ ghi nhận, không tự kết luận nguyên nhân.
 * Cách dùng: node capture-returns.cjs <thư-mục-dist-web> <thư-mục-ra>
 */
const path = require('node:path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { startStaticServer } = require(path.resolve(__dirname, '../../scripts/screens/serve.cjs'));

(async () => {
  const [dist, out] = process.argv.slice(2);
  if (!dist || !out) throw new Error('Thiếu tham số: <dist-web> <thư-mục-ra>');
  const srv = await startStaticServer(dist, 4722);
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
  const q = (sel) => p.locator(`${sel}:visible`).first();
  const vid = (id) => q(`[data-testid="${id}"]`);
  const vtxt = (t) => p.locator(`text="${t}" >> visible=true`).first();

  await p.goto(srv.url + '/home');
  await p.waitForTimeout(1500);
  // Đơn gốc (dữ liệu mẫu) nhập qua Tạo đơn nhanh.
  await vtxt('Tạo đơn nhanh').click();
  await p.waitForTimeout(500);
  await vid('quick-order-code').fill('SP2611-48307');
  await vid('source-change').click();
  await vid('source-option-shopee').click();
  await p.waitForTimeout(300);
  await vid('line-name-0').fill('Bình giữ nhiệt inox 500 ml');
  await vid('line-variant-0').fill('Xanh mint');
  await vid('quick-add-tracking').click();
  await vid('quick-tracking').fill('SPXVN0412399021');
  await vid('quick-continue').click();
  await p.waitForTimeout(500);
  await vid('quick-create').click();
  await p.waitForTimeout(900);
  await vtxt('Trang chủ').click();
  await p.waitForTimeout(500);
  // Tiếp nhận hàng hoàn: tìm đơn gốc, dùng đơn, ghi tình trạng bên ngoài.
  await vtxt('Nhận hàng hoàn').click();
  await p.waitForTimeout(800);
  await vid('return-code').fill('SP2611-48307');
  await vid('return-search').click();
  await p.waitForTimeout(900);
  await vid('return-use-order').click();
  await p.waitForTimeout(900);
  await vid('return-sign-dented').click();
  await vid('return-sign-seal_abnormal').click();
  await vid('return-exterior-note').fill('Móp góc phải, băng keo bị cắt');
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, 'return-exterior-780x1688.png') });
  await vid('return-exterior-continue').click();
  await p.waitForTimeout(900);
  // Bản web không có camera: ghi nhận "chưa có video" để sang bước kiểm hàng.
  await vid('recording-stop').click();
  await p.waitForTimeout(600);
  await vtxt('Tiếp tục không có video').click();
  await p.waitForTimeout(1000);
  await q('[data-testid^="return-line-qty-"]:not([data-testid$="-required"])').fill('0');
  // Số thực nhận ít hơn dự kiến thì app tự mở phần ghi nhận sai lệch và hiện nhãn "Ít hơn dự kiến".
  await q('[data-testid^="return-line-note-"]').fill('Kiện về không có sản phẩm bên trong.');
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'return-items-780x1688.png') });
  await browser.close();
  await srv.close();
  if (errors.length) {
    console.error('Lỗi trang:', errors.join('; '));
    process.exit(1);
  }
  console.log('Đã chụp return-exterior, return-items');
})();
