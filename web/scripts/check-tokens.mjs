// So khớp màu web với token app: mỗi primitive trong web/src/styles/tokens.css phải bằng giá trị cùng tên
// trong src/core/theme/primitives.ts (palette), và không còn mã màu cứng ngoài tokens.css.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const app = readFileSync(join(root, '../src/core/theme/primitives.ts'), 'utf8');
const errors = [];

// Phân tích palette: khối `họ: { 50: '#...', ... }` hoặc `họ: { 700: '#...', ... }`.
const appColors = {};
for (const m of app.matchAll(/^\s{2}(\w+): \{([^}]*)\}/gm)) {
  for (const c of m[2].matchAll(/(\d+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
    appColors[`${m[1]}-${c[1]}`] = c[2].toLowerCase();
  }
}
appColors['black'] = '#000000';

let n = 0;
for (const m of css.matchAll(/^\s*--([a-z]+-\d+):\s*(#[0-9a-fA-F]{6});/gm)) {
  n++;
  const want = appColors[m[1]];
  if (!want) errors.push(`--${m[1]} không có trong palette của app`);
  else if (want !== m[2].toLowerCase()) errors.push(`--${m[1]} = ${m[2]} nhưng app = ${want}`);
}
const neutral0 = /--neutral-0:\s*#ffffff/i.test(css);
if (!neutral0) errors.push('--neutral-0 phải là #ffffff');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const f of [...walk(join(root, 'src')), ...walk(join(root, 'scripts'))]) {
  if (f.endsWith('tokens.css') || f.endsWith('check-tokens.mjs') || !/\.(astro|css|ts|mjs)$/.test(f)) continue;
  const t = readFileSync(f, 'utf8');
  if (/#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(t.replace(/&#\d+;/g, ''))) errors.push(`${f}: còn mã màu hex`);
  if (/\brgba?\(/.test(t)) errors.push(`${f}: còn rgb()/rgba()`);
}
if (errors.length) {
  console.error('LỖI token màu web:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Token màu web khớp app (${n} primitive hex), không còn màu cứng ngoài tokens.css.`);
