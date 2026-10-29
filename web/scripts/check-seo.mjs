// Kiểm tra SEO tĩnh trên thư mục dist/ sau `astro build`. Không cần trình duyệt.
// Kiểm: title/description (độ dài, duy nhất), canonical, lang, một h1, OG/Twitter, JSON-LD hợp lệ,
// link nội bộ không hỏng (kể cả #anchor), ảnh có alt + width/height, sitemap, robots.txt.
// Thoát mã 1 nếu có lỗi. Cảnh báo (WARN) không làm hỏng.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { site } from '../src/config/site.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TITLE = [50, 60];
const DESC = [120, 160];

const errors = [];
const warns = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warns.push(`${page}: ${msg}`);

if (!existsSync(DIST)) {
  console.error('Chưa có dist/. Chạy `npm run build` trước.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const urlOf = (f) => {
  const rel = relative(DIST, f).split(sep).join('/');
  return '/' + rel.replace(/(^|\/)index\.html$/, '$1');
};

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const meta = (html, attr, name) => {
  const m = html.match(new RegExp(`<meta[^>]*\\b${attr}="${name}"[^>]*>`, 'i'));
  const c = m && m[0].match(/\bcontent="([^"]*)"/i);
  return c ? decode(c[1]) : null;
};

const pages = new Map();
for (const f of htmlFiles) pages.set(urlOf(f), readFileSync(f, 'utf8'));

const titles = new Map();
const descs = new Map();

for (const [url, html] of pages) {
  const is404 = url.endsWith('404.html') || url === '/404/';
  const robots = meta(html, 'name', 'robots') ?? '';
  const noindex = /noindex/i.test(robots);

  if (!/<html[^>]*\blang="vi"/i.test(html)) err(url, 'thiếu lang="vi"');

  const t = html.match(/<title>([^<]*)<\/title>/i);
  const title = t ? decode(t[1]).trim() : '';
  if (!title) err(url, 'thiếu <title>');
  const d = meta(html, 'name', 'description');
  if (!d) err(url, 'thiếu meta description');

  if (title && !is404) {
    const n = [...title].length;
    if (n < TITLE[0] || n > TITLE[1])
      err(url, `title ${n} ký tự (cần ${TITLE[0]}-${TITLE[1]}): "${title}"`);
    if (titles.has(title)) err(url, `title trùng với ${titles.get(title)}`);
    titles.set(title, url);
  }
  if (d && !is404) {
    const n = [...d].length;
    if (n < DESC[0] || n > DESC[1]) err(url, `description ${n} ký tự (cần ${DESC[0]}-${DESC[1]})`);
    if (descs.has(d)) err(url, `description trùng với ${descs.get(d)}`);
    descs.set(d, url);
  }

  // robots theo cờ site.indexable
  if (!site.indexable && !noindex) err(url, 'site.indexable=false nhưng trang thiếu noindex');
  if (is404 && !noindex) err(url, '404 phải noindex');

  // canonical
  const canon = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i);
  if (!is404) {
    if (!canon) err(url, 'thiếu canonical');
    else if (canon[1] !== new URL(url, site.url).toString()) err(url, `canonical sai: ${canon[1]}`);
  }

  // OG / Twitter
  if (!is404) {
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url'])
      if (!meta(html, 'property', p)) err(url, `thiếu ${p}`);
    for (const p of ['twitter:card', 'twitter:image'])
      if (!meta(html, 'name', p)) err(url, `thiếu ${p}`);
  }
  const og = meta(html, 'property', 'og:image');
  if (og) {
    const path = new URL(og).pathname;
    if (!existsSync(join(DIST, path))) err(url, `og:image không tồn tại trong dist: ${path}`);
  }

  // h1
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1 !== 1) err(url, `cần đúng 1 h1, có ${h1}`);

  // landmark
  for (const tag of ['header', 'nav', 'main', 'footer'])
    if (!new RegExp(`<${tag}[\\s>]`, 'i').test(html)) err(url, `thiếu <${tag}>`);

  // JSON-LD
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      const j = JSON.parse(m[1]);
      if (j['@context'] !== 'https://schema.org' || !j['@type'])
        err(url, 'JSON-LD thiếu @context/@type');
      if (j['@type'] === 'FAQPage') {
        for (const q of j.mainEntity ?? []) {
          const text = q.acceptedAnswer?.text ?? '';
          const visible = decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
          if (!visible.includes(q.name) || !visible.includes(text))
            err(url, `FAQPage không khớp nội dung hiển thị: "${q.name}"`);
        }
      }
      if (/aggregateRating|"offers"|"review"/.test(m[1]))
        err(url, 'JSON-LD có rating/offers/review: chỉ dùng khi có dữ liệu thật');
    } catch (e) {
      err(url, `JSON-LD không parse được: ${e.message}`);
    }
  }
  if (url === '/' && ld.length === 0) err(url, 'trang chủ cần JSON-LD');

  // ảnh
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\balt=/.test(tag)) err(url, `img thiếu alt: ${tag.slice(0, 80)}`);
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag))
      err(url, `img thiếu width/height: ${tag.slice(0, 80)}`);
  }

  // link nội bộ
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    const href = decode(m[1]);
    if (/^(https?:|mailto:|tel:)/i.test(href)) {
      if (/^http:/i.test(href)) warn(url, `liên kết http không mã hóa: ${href}`);
      continue;
    }
    const [pathPart, hash] = href.split('#');
    const target = pathPart === '' ? url : pathPart;
    if (!target.startsWith('/')) {
      err(url, `link tương đối khó kiểm: ${href}`);
      continue;
    }
    const clean = target.split('?')[0];
    const html2 = pages.get(clean) ?? pages.get(clean.endsWith('/') ? clean : clean + '/');
    const fileOk = existsSync(join(DIST, clean)) && statSync(join(DIST, clean)).isFile();
    if (!html2 && !fileOk) err(url, `link hỏng: ${href}`);
    else if (hash && html2) {
      const targetIds =
        clean === url ? ids : new Set([...html2.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]));
      if (!targetIds.has(hash)) err(url, `anchor không tồn tại: ${href}`);
    }
  }
  // tài nguyên nội bộ (css/js/ảnh/icon)
  for (const m of html.matchAll(/\b(?:src|href)="(\/[^"#?]*\.[a-z0-9]+)"/gi)) {
    if (!existsSync(join(DIST, m[1]))) err(url, `tài nguyên thiếu: ${m[1]}`);
  }
}

// robots.txt
const robotsPath = join(DIST, 'robots.txt');
if (!existsSync(robotsPath)) err('robots.txt', 'không có');
else {
  const r = readFileSync(robotsPath, 'utf8');
  if (site.indexable) {
    if (!r.includes(`Sitemap: ${new URL('/sitemap-index.xml', site.url)}`))
      err('robots.txt', 'thiếu dòng Sitemap');
    if (/^Disallow:\s*\/\s*$/m.test(r))
      err('robots.txt', 'chặn toàn site trong khi indexable=true');
    if (/\.(css|js)/i.test(r)) err('robots.txt', 'không được chặn CSS/JS');
  } else if (!/^Disallow:\s*\/\s*$/m.test(r))
    err('robots.txt', 'indexable=false nhưng không Disallow: /');
}

// sitemap
const sitemapIndex = join(DIST, 'sitemap-index.xml');
if (!existsSync(sitemapIndex)) err('sitemap', 'không có sitemap-index.xml');
else {
  const smFiles = files.filter((f) => /sitemap-\d+\.xml$/.test(f));
  const locs = smFiles.flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
  );
  if (locs.length === 0) err('sitemap', 'không có URL nào');
  for (const loc of locs) {
    const u = new URL(loc);
    if (u.origin !== new URL(site.url).origin) err('sitemap', `URL sai miền: ${loc}`);
    if (u.pathname.includes('404')) err('sitemap', `chứa trang 404: ${loc}`);
    const p = pages.get(u.pathname);
    if (!p) err('sitemap', `URL không có trang: ${loc}`);
    else if (/noindex/i.test(meta(p, 'name', 'robots') ?? '') && site.indexable)
      err('sitemap', `chứa trang noindex: ${loc}`);
  }
  if (!site.indexable)
    warn('sitemap', 'site.indexable=false: sitemap vẫn được sinh nhưng robots chặn toàn site');
}

console.log(`Đã kiểm ${pages.size} trang HTML.`);
for (const w of warns) console.log('WARN ', w);
if (errors.length) {
  for (const e of errors) console.error('LỖI ', e);
  console.error(`\n${errors.length} lỗi.`);
  process.exit(1);
}
console.log('Không có lỗi.');
