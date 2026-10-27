'use strict';
/**
 * `npm run check:tokens` - kiểm tra cấu trúc hệ thống Design Token (docs/design-token-spec.md mục 7).
 * Phần "giá trị thiết kế viết thẳng trong giao diện" do ESLint rule `design-tokens/no-raw-design-values`
 * đảm nhiệm (npm run lint); script này kiểm những gì ESLint không thấy:
 *  1. Phạm vi không bị mục: mỗi mẫu ngoài-phạm vi vẫn khớp ít nhất một tệp.
 *  2. Một nguồn hex: mã màu chỉ ở primitives.ts và khối @frozen của colors.ts.
 *  3. Kiến trúc tầng: primitives không import ai; semantic/components chỉ import tầng dưới.
 *  4. Ngoại lệ không phình ra: số `token-exception` không vượt baseline đã duyệt.
 *  5. (Cảnh báo) PR chạm vào tệp ngoài phạm vi.
 * Thoát mã 1 khi vi phạm 1-4.
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

// 5. Cảnh báo: PR chạm tệp ngoài phạm vi
try {
  const changed = execSync('git diff --name-only origin/main...HEAD', {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .split('\n')
    .filter(Boolean);
  const touched = changed.filter(
    (f) =>
      /^src\//.test(f) &&
      EXCLUDED_PATTERNS.some((re) => re.test(f)) &&
      !/^src\/core\/theme\//.test(f) &&
      !/\.test\./.test(f),
  );
  if (touched.length)
    warnings.push(
      `Nhánh này sửa tệp NGOÀI phạm vi Design Token (màn đã được khách hàng xác nhận):\n  ${touched.join('\n  ')}`,
    );
} catch {
  warnings.push('Không so sánh được với origin/main (bỏ qua kiểm tra tệp ngoài phạm vi).');
}

for (const w of warnings) console.warn(`cảnh báo: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`lỗi: ${e}`);
  process.exit(1);
}
console.log(
  `check:tokens OK - ${files.filter(isInScope).length} tệp trong phạm vi, ${total} ngoại lệ có chú thích.`,
);
