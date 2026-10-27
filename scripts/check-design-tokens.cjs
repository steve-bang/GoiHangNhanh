'use strict';
/**
 * `npm run check:tokens` - kiểm tra cấu trúc hệ thống Design Token (docs/design-token-spec.md mục 7).
 * Phần "giá trị thiết kế viết thẳng trong giao diện" do ESLint rule `design-tokens/no-raw-design-values`
 * đảm nhiệm (npm run lint); script này kiểm những gì ESLint không thấy:
 *  1. Phạm vi không bị mục: mỗi mẫu ngoài-phạm vi vẫn khớp ít nhất một tệp.
 *  2. Một nguồn hex: mã màu chỉ ở primitives.ts và khối @frozen của colors.ts.
 *  3. Kiến trúc tầng: primitives không import ai; semantic/components chỉ import tầng dưới.
 *  4. Ngoại lệ không phình ra: số `token-exception` không vượt baseline đã duyệt.
 *  5. Nhánh sửa tệp ngoài phạm vi (so với merge-base với origin/main) là lỗi, trừ tệp có trong
 *     scripts/design-token-frozen-allow.json (kèm lý do). Không có origin/main: cảnh báo (CI: lỗi).
 * Thoát mã 1 khi vi phạm 1-5.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { EXCLUDED_PATTERNS, isInScope } = require('./design-token-scope.cjs');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function tracked() {
  const out = execSync('git ls-files src; git ls-files -o --exclude-standard src', { cwd: ROOT });
  return [...new Set(out.toString().split('\n').filter(Boolean))].filter((f) =>
    fs.existsSync(path.join(ROOT, f)),
  );
}
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const files = tracked();

// 1. Phạm vi
for (const re of EXCLUDED_PATTERNS) {
  if (!files.some((f) => re.test(f)))
    errors.push(`Mẫu ngoài-phạm vi không khớp tệp nào (đã đổi tên/xóa?): ${re}`);
}

// 2. Một nguồn hex
const HEX = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;
for (const f of files.filter(
  (x) => /^src\/core\/theme\/[^/]+\.ts$/.test(x) && !/\.test\./.test(x),
)) {
  const base = path.basename(f);
  const lines = read(f).split('\n');
  const frozenFrom = base === 'colors.ts' ? lines.findIndex((l) => l.includes('@frozen')) : -1;
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || !HEX.test(line)) return;
    const allowed = base === 'primitives.ts' || (frozenFrom >= 0 && i > frozenFrom);
    if (!allowed)
      errors.push(`${f}:${i + 1}: mã màu ngoài primitives.ts/khối @frozen: ${line.trim()}`);
  });
}

// 3. Kiến trúc tầng
const importsOf = (f) => [...read(f).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
const LAYERS = {
  'src/core/theme/primitives.ts': [],
  'src/core/theme/typography.ts': ['./primitives'],
  'src/core/theme/semantic.ts': ['./primitives', './typography'],
  'src/core/theme/components.ts': ['./primitives'],
};
for (const [f, allowed] of Object.entries(LAYERS)) {
  for (const imp of importsOf(f)) {
    if (!allowed.includes(imp))
      errors.push(
        `${f}: import "${imp}" phá kiến trúc tầng (chỉ được: ${allowed.join(', ') || 'không import gì'})`,
      );
  }
}

// 4. Ngoại lệ không phình ra
const baselinePath = path.join(__dirname, 'design-token-exceptions.json');
const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  : {};
const counts = {};
for (const f of files.filter(isInScope)) {
  const n = (read(f).match(/token-exception:/g) || []).length;
  if (n) counts[f] = n;
}
for (const [f, n] of Object.entries(counts)) {
  if (n > (baseline[f] ?? 0))
    errors.push(
      `${f}: ${n} token-exception (baseline ${baseline[f] ?? 0}). Thêm ngoại lệ phải được duyệt: cập nhật scripts/design-token-exceptions.json kèm lý do trong PR.`,
    );
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);

// 5. Sửa tệp ngoài phạm vi (màn khách hàng đã xác nhận) là LỖI, trừ tệp có trong allowlist có lý do
const allowPath = path.join(__dirname, 'design-token-frozen-allow.json');
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, 'utf8')) : {};
for (const [f, reason] of Object.entries(allow)) {
  if (typeof reason !== 'string' || reason.trim().length < 10)
    errors.push(`design-token-frozen-allow.json: "${f}" phải kèm lý do (>= 10 ký tự).`);
}

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
}
/** Điểm gốc để so sánh: merge-base với origin/main, rồi main cục bộ; null nếu không tìm được. */
function findBase() {
  for (const ref of ['origin/main', 'main']) {
    try {
      return { ref, sha: git(`merge-base ${ref} HEAD`) };
    } catch {
      // thử ứng viên tiếp theo
    }
  }
  return null;
}

const base = findBase();
if (!base) {
  const msg =
    'KHÔNG so sánh được với origin/main (thiếu ref hoặc clone nông): bỏ qua kiểm tra "sửa tệp ngoài phạm vi". Chạy `git fetch origin main` (CI cần fetch-depth: 0).';
  if (process.env.CI) errors.push(msg);
  else warnings.push(msg);
} else {
  // So với cây làm việc (gồm cả thay đổi chưa commit) tại điểm gốc chung.
  const changed = [
    ...git(`diff --name-only ${base.sha}`).split('\n'),
    ...git('ls-files -o --exclude-standard src').split('\n'),
  ].filter(Boolean);
  const touched = [...new Set(changed)].filter(
    (f) =>
      /^src\//.test(f) &&
      EXCLUDED_PATTERNS.some((re) => re.test(f)) &&
      !/^src\/(core\/theme\/|shared\/ui\/theme\.ts$)/.test(f) &&
      !/\.test\./.test(f) &&
      !allow[f],
  );
  if (touched.length)
    errors.push(
      `Nhánh này sửa tệp NGOÀI phạm vi Design Token (màn đã được khách hàng xác nhận, không được đổi hiển thị):\n  ${touched.join('\n  ')}\n  Nếu thật sự cần (ví dụ sửa lỗi không đổi giao diện), thêm tệp + lý do vào scripts/design-token-frozen-allow.json để reviewer thấy.`,
    );
}

for (const w of warnings) console.warn(`cảnh báo: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`lỗi: ${e}`);
  process.exit(1);
}
console.log(
  `check:tokens OK - ${files.filter(isInScope).length} tệp trong phạm vi, ${total} ngoại lệ có chú thích.`,
);
