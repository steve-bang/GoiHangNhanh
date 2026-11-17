'use strict';
/**
 * Dựng ảnh marketing từ ảnh chụp THẬT của app (marketing-assets/<module>/original/*.png).
 * Mỗi ảnh là một trang HTML cố định kích thước, xuất PNG bằng Playwright (deviceScaleFactor 1 để đúng
 * số điểm ảnh yêu cầu). Không vẽ lại giao diện: ảnh chụp chỉ được đặt vào khung máy, cắt phần dưới.
 * Cách dùng: node build.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const INK = '#0E2B3F'; // slate 900 của design token app
const ORANGE = '#FF6A45'; // Bright Orange 500: chữ/đường trên nền tối đạt >= 4.5:1
const PAPER = '#FFF5F0'; // stone 50 của app
const KRAFT = '#D9A566'; // màu bìa carton của app (kraft 300)

const b64 = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const ICON = b64(path.join(__dirname, 'brand-icon.png'));

const baseCss = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${INK};font-family:'Inter',sans-serif;color:${PAPER};-webkit-font-smoothing:antialiased}
  #c{position:relative;overflow:hidden;background:${INK}}
  .brand{position:absolute;left:72px;top:72px;display:flex;align-items:center;gap:18px;
    font:700 36px/1 'Inter Display','Inter',sans-serif;letter-spacing:-0.01em}
  .brand img{width:64px;height:64px;border-radius:16px;display:block}
  h1{position:absolute;left:72px;font:800 84px/1.04 'Inter Display','Inter',sans-serif;letter-spacing:-0.025em;
    text-wrap:balance;width:936px}
  .sub{position:absolute;left:72px;font:400 32px/1.4 'Inter',sans-serif;color:${PAPER};opacity:.82;text-wrap:balance}
  .note{position:absolute;right:72px;top:88px;font:500 24px/1.3 'Inter',sans-serif;opacity:.72;text-align:right}
  .phone{position:absolute;background:#0a0f14;border-radius:70px;padding:10px;
    box-shadow:0 50px 90px rgba(0,0,0,.45),0 0 0 2px #25384a inset}
  .phone img{display:block;width:100%;border-radius:60px}
`;

function page(w, h, body, extraCss = '') {
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><style>${baseCss}${extraCss}
  #c{width:${w}px;height:${h}px}</style><body><div id="c">${body}</div></body></html>`;
}

const SHOT = b64(path.join(ROOT, 'orders/original/orders-list-780x1688.png'));

// ---------- A. Product showcase (Instagram dọc 1080x1350) ----------
function showcaseA() {
  const phoneW = 580;
  const css = `
    h1{top:176px}
    .sub{top:372px;width:720px}
    .phone{left:${(1080 - phoneW) / 2}px;top:560px;width:${phoneW}px}
    .tape{position:absolute;left:445px;top:528px;width:190px;height:62px;background:${KRAFT};opacity:.94;
      transform:rotate(-3deg);box-shadow:0 8px 18px rgba(0,0,0,.35);
      clip-path:polygon(0 0,3% 12%,0 26%,3% 40%,0 54%,3% 68%,0 82%,3% 100%,100% 100%,97% 86%,100% 72%,97% 58%,100% 44%,97% 30%,100% 16%,97% 0)}
  `;
  const body = `
    <div class="brand"><img src="${ICON}"><span>AmaBox</span></div>
    <p class="note">Dữ liệu mẫu.<br>Bản đang phát triển.</p>
    <h1>Mọi đơn hàng,<br>một danh sách rõ ràng.</h1>
    <p class="sub">Nguồn bán, mã vận đơn và tình trạng video của từng đơn, ngay trên một màn hình.</p>
    <div class="phone"><img src="${SHOT}"></div>
    <div class="tape"></div>`;
  return { w: 1080, h: 1350, html: page(1080, 1350, body, css) };
}

// ---------- B. Feature highlight (Instagram dọc 1080x1350) ----------
function highlightB() {
  const phoneW = 470;
  const left = 560;
  const top = 500;
  const bezel = 10;
  const k = (phoneW - 2 * bezel) / 390; // px màn hình trên 1 px css của app
  const sx = left + bezel;
  const sy = top + bezel;
  const box = (x1, y1, x2, y2, pad = 6) => ({
    x: sx + (x1 - pad) * k,
    y: sy + (y1 - pad) * k,
    w: (x2 - x1 + 2 * pad) * k,
    h: (y2 - y1 + 2 * pad) * k,
  });
  // Tọa độ phần tử trong ảnh chụp 390x844 css (đo trên ảnh gốc 780x1688 chia 2).
  const targets = [
    box(16, 79, 374, 129),
    box(16, 137.5, 215.5, 176.5),
    box(29, 380, 73, 424, 8),
  ];
  const cards = [
    { title: 'Tìm theo mã', body: 'Gõ hoặc quét mã đơn, mã vận đơn.' },
    { title: 'Lọc đơn chưa có video', body: 'Thấy ngay những đơn còn thiếu.' },
    { title: 'Nguồn bán rõ ràng', body: 'Shopee, TikTok Shop, Lazada hoặc khác.' },
  ];
  const cardX = 64;
  const cardW = 440;
  const cardH = 180;
  const cardTops = [510, 710, 910];
  const gutterX = cardX + cardW + 36;
  const lines = targets
    .map((t, i) => {
      const cy = cardTops[i] + cardH / 2;
      const ty = t.y + t.h / 2;
      return `<polyline points="${cardX + cardW},${cy} ${gutterX},${cy} ${gutterX},${ty} ${t.x},${ty}" />`;
    })
    .join('');
  const outlines = targets
    .map(
      (t) =>
        `<div class="hl" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px"></div>`,
    )
    .join('');
  const cardHtml = cards
    .map(
      (c, i) => `<div class="card" style="left:${cardX}px;top:${cardTops[i]}px;width:${cardW}px;height:${cardH}px">
        <b>${c.title}</b><span>${c.body}</span></div>`,
    )
    .join('');
  const css = `
    h1{top:176px;font-size:76px}
    .sub{top:360px;width:900px;font-size:30px}
    .phone{left:${left}px;top:${top}px;width:${phoneW}px;border-radius:62px}
    .phone img{border-radius:52px}
    .card{position:absolute;background:${PAPER};color:${INK};border-radius:20px;padding:30px 32px 0 40px;
      display:flex;flex-direction:column;gap:10px;box-shadow:0 18px 36px rgba(0,0,0,.35)}
    .card:before{content:'';position:absolute;left:-14px;top:50%;width:28px;height:28px;margin-top:-14px;
      border-radius:50%;background:${INK}}
    .card b{font:800 34px/1.15 'Inter Display','Inter',sans-serif;letter-spacing:-0.01em}
    .card span{font:500 28px/1.3 'Inter',sans-serif;opacity:.85;text-wrap:balance}
    .hl{position:absolute;border:4px solid ${ORANGE};border-radius:14px}
    svg{position:absolute;left:0;top:0;width:1080px;height:1350px;overflow:visible}
    svg polyline{fill:none;stroke:${ORANGE};stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
  `;
  const body = `
    <div class="brand"><img src="${ICON}"><span>AmaBox</span></div>
    <p class="note">Dữ liệu mẫu.<br>Bản đang phát triển.</p>
    <h1>Đơn nào chưa có video?<br>Lọc một chạm.</h1>
    <p class="sub">Danh sách đơn cho thấy nguồn bán, mã vận đơn và tình trạng video của từng đơn.</p>
    <div class="phone"><img src="${SHOT}"></div>
    ${outlines}
    <svg>${lines}</svg>
    ${cardHtml}`;
  return { w: 1080, h: 1350, html: page(1080, 1350, body, css) };
}


// ---------- Poster (2:3, 1200x1800; xuất thêm @2x để in) ----------
const SHOT_DETAIL = b64(path.join(ROOT, 'orders/original/order-detail-780x1688.png'));

function poster() {
  const W = 1200;
  const H = 1800;
  const css = `
    .brand{left:80px;top:80px}
    .note{right:80px;top:96px}
    h1{left:80px;top:196px;width:1040px;font-size:136px;line-height:1.02;letter-spacing:-0.03em}
    .sub{left:80px;top:640px;width:760px;font-size:36px}
    .phone{width:540px;border-radius:66px}
    .phone img{border-radius:56px}
    .p1{left:76px;top:800px}
    .p2{left:590px;top:900px}
    .tape{position:absolute;left:800px;top:868px;width:210px;height:64px;background:${KRAFT};opacity:.94;
      transform:rotate(4deg);box-shadow:0 8px 18px rgba(0,0,0,.35);
      clip-path:polygon(0 0,3% 12%,0 26%,3% 40%,0 54%,3% 68%,0 82%,3% 100%,100% 100%,97% 86%,100% 72%,97% 58%,100% 44%,97% 30%,100% 16%,97% 0)}
    .label{position:absolute;left:0;top:1500px;width:${W}px;height:${H - 1500}px;background:${PAPER};color:${INK};
      display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:56px 80px 0}
    .label:before{content:'';position:absolute;left:0;right:0;top:-1px;height:22px;
      background:radial-gradient(circle at 14px 0,${INK} 0 11px,transparent 11.5px) 0 0/40px 22px repeat-x}
    .col{padding-right:36px}
    .col+.col{padding-left:36px;border-left:3px dashed rgba(14,43,63,.28)}
    .col b{display:block;font:800 36px/1.12 'Inter Display','Inter',sans-serif;letter-spacing:-0.015em;margin-bottom:12px;text-wrap:balance}
    .col span{display:block;font:500 27px/1.32 'Inter',sans-serif;opacity:.85;text-wrap:balance}
  `;
  const body = `
    <div class="brand"><img src="${ICON}"><span>AmaBox</span></div>
    <p class="note">Dữ liệu mẫu.<br>Bản đang phát triển.</p>
    <h1>Mỗi đơn hàng,<br>một hồ sơ<br>rõ ràng.</h1>
    <p class="sub">Quản lý đơn, kiện hàng và bằng chứng của người bán online, ngay trên điện thoại.</p>
    <div class="phone p2"><img src="${SHOT_DETAIL}"></div>
    <div class="phone p1"><img src="${SHOT}"></div>
    <div class="tape"></div>
    <div class="label">
      <div class="col"><b>Quét hoặc nhập mã</b><span>Mã đơn và mã vận đơn, không phải gõ dài.</span></div>
      <div class="col"><b>Đơn, kiện, bằng chứng</b><span>Mỗi đơn có thể có nhiều kiện, mỗi kiện một hồ sơ riêng.</span></div>
      <div class="col"><b>Nguồn dữ liệu rõ ràng</b><span>Thông tin do bạn nhập được ghi rõ, không lấy từ sàn.</span></div>
    </div>`;
  return { w: W, h: H, html: page(W, H, body, css) };
}

const JOBS = [
  { out: 'orders/instagram-portrait/showcase-1080x1350.png', make: showcaseA },
  { out: 'orders/instagram-portrait/feature-highlight-1080x1350.png', make: highlightB },
  { out: 'poster/poster-1200x1800.png', make: poster },
  { out: 'poster/poster-2400x3600@2x.png', make: poster, scale: 2 },
];

(async () => {
  const browser = await chromium.launch();
  for (const job of JOBS) {
    const { w, h, html } = job.make();
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: job.scale || 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(ROOT, job.out);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.locator('#c').screenshot({ path: file });
    await page.close();
    console.log('Đã dựng', job.out);
  }
  await browser.close();
})();
