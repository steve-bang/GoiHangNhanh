// Đọc giá trị token từ src/styles/tokens.css (nguồn duy nhất của màu web) cho chỗ không dùng được CSS var,
// ví dụ <meta name="theme-color">. Không viết hex ở nơi khác.
import tokensCss from '../styles/tokens.css?raw';

export function tokenValue(name: string): string {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`Không thấy token --${name} trong tokens.css`);
  const v = m[1].trim();
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/);
  return ref ? tokenValue(ref[1]) : v;
}
