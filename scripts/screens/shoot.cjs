'use strict';
/**
 * Chụp ảnh bản web đang được phục vụ ở một URL bằng Playwright (Chromium). Thường được capture.cjs
 * gọi; chạy riêng khi đã có máy chủ:
 *   node scripts/screens/shoot.cjs --base-url http://127.0.0.1:5100 --out <thư mục> --routes "/=01-home"
 * Playwright KHÔNG có trong package.json (không chạy ở CI): nạp từ NODE_PATH, thư mục toàn cục của
 * npm hoặc /opt/node-tools. Cách dùng: scripts/screens/README.md.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const {
  DEFAULT_SCALE,
  DEFAULT_WAIT_MS,
  assertUniqueNames,
  parseArgs,
  parseRoutes,
  parseRoutesFile,
  parseSizes,
  shotFileName,
} = require('./lib.cjs');

const NAV_TIMEOUT_MS = 30000;
const SELECTOR_TIMEOUT_MS = 15000;

function npmGlobalRoot() {
  try {
    return execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/** Nạp Playwright mà không thêm vào package.json; báo cách cài nếu không có. */
function loadPlaywright() {
  const dirs = [
    ...(process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean),
    '/opt/node-tools/node_modules',
    npmGlobalRoot(),
  ].filter(Boolean);
  for (const dir of [null, ...dirs]) {
    try {
      return require(dir ? path.join(dir, 'playwright') : 'playwright');
    } catch {
      // thử nơi tiếp theo
    }
  }
  throw new Error(
    'Không tìm thấy Playwright. Cài toàn cục: `npm i -g playwright && npx playwright install chromium`, ' +
      'hoặc đặt NODE_PATH tới thư mục node_modules có playwright. Không thêm vào package.json của repo.',
  );
}

/**
 * Chụp mọi `entries` ở mọi `sizes`. Trả `{ shots, pageErrors, consoleErrors, failures }`; không ném
 * lỗi khi một route lỗi (ghi vào `failures`) để vẫn có các ảnh còn lại.
 */
async function shoot({ baseUrl, entries, sizes, scale = DEFAULT_SCALE, outDir, log = () => {} }) {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(outDir, { recursive: true });
  const result = { shots: [], pageErrors: [], consoleErrors: [], failures: [] };
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    throw new Error(
      `Không mở được Chromium của Playwright (${String(err.message ?? err).split('\n')[0]}). ` +
        'Chạy `npx playwright install chromium` nếu chưa cài trình duyệt.',
    );
  }
  try {
    for (const size of sizes) {
      const context = await browser.newContext({
        viewport: size,
        deviceScaleFactor: scale,
        locale: 'vi-VN',
        timezoneId: 'Asia/Ho_Chi_Minh',
      });
      for (const entry of entries) {
        const page = await context.newPage();
        const where = `${entry.route} @${size.width}x${size.height}`;
        page.on('pageerror', (e) => result.pageErrors.push(`${where}: ${String(e.message ?? e)}`));
        page.on('console', (msg) => {
          if (msg.type() === 'error') result.consoleErrors.push(`${where}: ${msg.text()}`);
        });
        try {
          await page.goto(baseUrl + entry.route, {
            waitUntil: 'networkidle',
            timeout: NAV_TIMEOUT_MS,
          });
          if (entry.waitFor) {
            await page.waitForSelector(entry.waitFor, { timeout: SELECTOR_TIMEOUT_MS });
          }
          if (entry.waitMs > 0) await page.waitForTimeout(entry.waitMs);
          const file = path.join(outDir, shotFileName(entry.name, size));
          await page.screenshot({ path: file, fullPage: Boolean(entry.fullPage) });
          result.shots.push({ route: entry.route, file, finalUrl: page.url() });
          log(`  ảnh ${path.basename(file)}  (${entry.route} -> ${new URL(page.url()).pathname})`);
        } catch (err) {
          result.failures.push(`${where}: ${String(err.message ?? err).split('\n')[0]}`);
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.baseUrl || !opts.out || !(opts.routes || opts.routesFile)) {
    throw new Error('Cần --base-url, --out và --routes (hoặc --routes-file)');
  }
  const defaults = {
    session: 'signed_in',
    waitMs: opts.waitMs === undefined ? DEFAULT_WAIT_MS : Number(opts.waitMs),
    waitFor: opts.waitFor,
    fullPage: Boolean(opts.fullPage),
  };
  const entries = opts.routesFile
    ? parseRoutesFile(fs.readFileSync(opts.routesFile, 'utf8'), defaults)
    : parseRoutes(opts.routes, defaults);
  assertUniqueNames(entries);
  const result = await shoot({
    baseUrl: opts.baseUrl.replace(/\/+$/, ''),
    entries,
    sizes: parseSizes(opts.sizes),
    scale: opts.scale ? Number(opts.scale) : DEFAULT_SCALE,
    outDir: path.resolve(opts.out),
    log: (s) => process.stdout.write(`${s}\n`),
  });
  const code = reportResult(result, Boolean(opts.allowPageErrors));
  process.exitCode = code;
}

/** In tóm tắt; trả mã thoát (1 nếu có route lỗi hoặc lỗi trang khi không cho phép). */
function reportResult(result, allowPageErrors) {
  const out = (s) => process.stdout.write(`${s}\n`);
  out(`Đã chụp ${result.shots.length} ảnh.`);
  for (const f of result.failures) out(`LỖI chụp: ${f}`);
  for (const e of result.pageErrors) out(`LỖI trang: ${e}`);
  for (const e of result.consoleErrors) out(`console.error: ${e}`);
  if (result.failures.length === 0 && result.pageErrors.length === 0) out('Lỗi trang: không có.');
  if (result.failures.length > 0) return 1;
  if (result.pageErrors.length > 0 && !allowPageErrors) return 1;
  return 0;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err.message ?? err}\n`);
    process.exitCode = 1;
  });
}

module.exports = { loadPlaywright, reportResult, shoot };
