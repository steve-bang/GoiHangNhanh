const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Dung lượng cho người đọc ("1,2 GB"): cơ số 1024, dấu phẩy thập phân kiểu Việt Nam, một chữ số thập phân
 * khi giá trị dưới 10, không thập phân từ 10 trở lên. Không nhận số âm/không hữu hạn (trả "0 B").
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  // Làm tròn TRƯỚC khi chọn số thập phân để "9,96" thành "10" chứ không "10,0".
  const tenth = Math.round(value * 10) / 10;
  const text = tenth >= 10 ? String(Math.round(value)) : tenth.toFixed(1).replace('.', ',');
  return `${text.replace(/,0$/, '')} ${UNITS[unit]}`;
}
