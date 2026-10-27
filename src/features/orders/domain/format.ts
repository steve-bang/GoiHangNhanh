const pad = (n: number) => String(n).padStart(2, '0');

/** "27/10/2026 09:30" theo giờ máy. Đây là thời gian THIẾT BỊ, không phải thời gian máy chủ. */
export function formatDeviceDateTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
