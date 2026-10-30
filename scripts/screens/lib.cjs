'use strict';
/**
 * Hàm thuần cho công cụ chụp ảnh bản web (scripts/screens). Không gọi tiến trình, không đọc mạng:
 * chỉ phân tích tham số và dựng tên tệp, để test được bằng Jest (project `tooling`).
 * Cách dùng: scripts/screens/README.md.
 */
const path = require('node:path');

/** Phiên giả hợp lệ (`EXPO_PUBLIC_FAKE_SESSION`, xem src/api/create-api.ts `resolveFakeSession`). */
const SESSIONS = ['signed_in', 'signed_out', 'no_shop'];

/** Cỡ điện thoại chuẩn của kế hoạch v1 mục 4 (điểm CSS, chụp ở hệ số 2). */
const ALL_SIZES = ['320x568', '360x800', '390x844'];
const DEFAULT_SIZES = ['390x844'];
const DEFAULT_WAIT_MS = 3500;
const DEFAULT_PORT = 5100;
const DEFAULT_SCALE = 2;

/** Bản `react-native-web`/`@expo/metro-runtime` khớp Expo SDK 58 (expo/bundledNativeModules.json). */
const WEB_PACKAGES = ['react-native-web@~0.21.4', '@expo/metro-runtime@~58.0.15'];

const FLAGS_WITH_VALUE = new Set([
  'out',
  'work',
  'routes',
  'routes-file',
  'session',
  'sizes',
  'scale',
  'wait-ms',
  'wait-for',
  'port',
  'source',
  'env',
  'base-url',
]);
const BOOLEAN_FLAGS = new Set(['skip-export', 'full-page', 'allow-page-errors', 'help']);

/**
 * Phân tích argv (không gồm `node script`). Hỗ trợ `--x v`, `--x=v`; `--env` lặp được.
 * Ném lỗi với tham số lạ hoặc thiếu giá trị.
 */
function parseArgs(argv) {
  const opts = { env: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Tham số không hợp lệ: ${arg}`);
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (BOOLEAN_FLAGS.has(key)) {
      if (eq !== -1) throw new Error(`--${key} không nhận giá trị`);
      opts[toCamel(key)] = true;
      continue;
    }
    if (!FLAGS_WITH_VALUE.has(key)) throw new Error(`Tham số lạ: --${key}`);
    let value;
    if (eq !== -1) {
      value = arg.slice(eq + 1);
    } else {
      value = argv[i + 1];
      i += 1;
    }
    if (value === undefined || value === '') throw new Error(`--${key} cần giá trị`);
    if (key === 'env') opts.env.push(value);
    else opts[toCamel(key)] = value;
  }
  return opts;
}

function toCamel(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** `"390x844,360x800"` hoặc `"all"` -> `[{ width, height }]`. */
function parseSizes(value) {
  const list = !value ? DEFAULT_SIZES : value === 'all' ? ALL_SIZES : value.split(',');
  return list.map((raw) => {
    const m = /^(\d{3,4})x(\d{3,4})$/.exec(raw.trim());
    if (!m) throw new Error(`Cỡ không hợp lệ: "${raw}" (dạng 390x844)`);
    return { width: Number(m[1]), height: Number(m[2]) };
  });
}

/** Tên tệp mặc định từ route: `/` -> `root`, `/account/help` -> `account-help`. */
function slugForRoute(route) {
  const slug = route
    .split('?')[0]
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'root';
}

function assertName(name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new Error(`Tên ảnh không hợp lệ: "${name}" (chỉ chữ, số, . _ -)`);
  }
  return name;
}

function assertSession(session) {
  if (!SESSIONS.includes(session)) {
    throw new Error(`Phiên giả không hợp lệ: "${session}" (${SESSIONS.join(' | ')})`);
  }
  return session;
}

function assertRoute(route) {
  if (typeof route !== 'string' || !route.startsWith('/')) {
    throw new Error(`Route phải bắt đầu bằng "/": "${route}"`);
  }
  return route;
}

/**
 * `"/=01-home,/account=02-account,/sync"` -> danh sách mục chụp. Không có `=tên` thì tên lấy từ route.
 * Mọi mục dùng phiên/chờ mặc định (ghi đè từng mục: dùng `--routes-file`).
 */
function parseRoutes(value, defaults) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const eq = item.indexOf('=');
      const route = eq === -1 ? item : item.slice(0, eq);
      const name = eq === -1 ? undefined : item.slice(eq + 1);
      return normalizeEntry({ route, name }, defaults);
    });
}

/**
 * Nội dung JSON của `--routes-file`: mảng `{ route, name?, session?, waitFor?, waitMs?, fullPage? }`.
 */
function parseRoutesFile(json, defaults) {
  const data = JSON.parse(json);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Tệp route phải là mảng JSON không rỗng');
  }
  return data.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Mỗi mục route phải là object');
    return normalizeEntry(entry, defaults);
  });
}

function normalizeEntry(entry, defaults) {
  const route = assertRoute(entry.route);
  const waitMs = entry.waitMs === undefined ? defaults.waitMs : Number(entry.waitMs);
  if (!Number.isFinite(waitMs) || waitMs < 0) throw new Error(`waitMs không hợp lệ ở ${route}`);
  return {
    route,
    name: assertName(entry.name ?? slugForRoute(route)),
    session: assertSession(entry.session ?? defaults.session),
    waitFor: entry.waitFor ?? defaults.waitFor,
    waitMs,
    fullPage: entry.fullPage ?? defaults.fullPage,
  };
}

/** Tên tệp ảnh: `<tên>-<W>x<H>.png` (kế hoạch v1 mục 4.3). */
function shotFileName(name, size) {
  return `${name}-${size.width}x${size.height}.png`;
}

/** Tên ảnh không được trùng (ảnh sau ghi đè ảnh trước một cách âm thầm). */
function assertUniqueNames(entries) {
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.name)) throw new Error(`Tên ảnh trùng: "${e.name}"`);
    seen.add(e.name);
  }
}

/** `["A=1","B=x=y"]` -> `{ A: "1", B: "x=y" }`; chỉ nhận khóa `EXPO_PUBLIC_*`. */
function parseEnvPairs(pairs) {
  const out = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    if (eq === -1 || !/^EXPO_PUBLIC_[A-Z0-9_]+$/.test(key)) {
      throw new Error(`--env cần dạng EXPO_PUBLIC_TEN=giatri: "${pair}"`);
    }
    out[key] = pair.slice(eq + 1);
  }
  return out;
}

/**
 * Biến môi trường cho `expo export --platform web`: luôn cổng giả, phiên giả đã chọn, không Firebase
 * Emulator, không môi trường prod (V1-01 chặn cờ giả ở prod).
 */
function exportEnv(baseEnv, session, extra) {
  const env = { ...baseEnv };
  delete env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  delete env.EXPO_PUBLIC_APP_ENV;
  return {
    ...env,
    ...extra,
    APP_ENV: 'dev',
    CI: '1',
    EXPO_PUBLIC_USE_FAKE_BACKEND: '1',
    EXPO_PUBLIC_BACKEND: 'fake',
    EXPO_PUBLIC_FAKE_SESSION: session,
  };
}

/** `child` nằm trong (hoặc bằng) `parent`? */
function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Đường dẫn tệp tĩnh cho một URL (SPA: không có tệp thì trả `index.html`). `exists(p)` là hàm kiểm
 * tệp; trả `null` nếu URL thoát khỏi thư mục gốc.
 */
function resolveStaticFile(root, urlPath, exists) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const index = path.join(root, 'index.html');
  const candidate = path.join(root, decoded);
  if (!isInside(candidate, root)) return null;
  if (path.resolve(candidate) === path.resolve(root)) return index;
  const tries = [candidate, `${candidate}.html`, path.join(candidate, 'index.html')];
  for (const p of tries) {
    if (exists(p)) return p;
  }
  return index;
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function contentTypeFor(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

module.exports = {
  ALL_SIZES,
  DEFAULT_PORT,
  DEFAULT_SCALE,
  DEFAULT_SIZES,
  DEFAULT_WAIT_MS,
  SESSIONS,
  WEB_PACKAGES,
  assertUniqueNames,
  contentTypeFor,
  exportEnv,
  isInside,
  parseArgs,
  parseEnvPairs,
  parseRoutes,
  parseRoutesFile,
  parseSizes,
  resolveStaticFile,
  shotFileName,
  slugForRoute,
};
