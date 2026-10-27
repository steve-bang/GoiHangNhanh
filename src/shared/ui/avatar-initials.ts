/** Chữ cái đầu để vẽ avatar: tối đa 2 ký tự (từ đầu và từ cuối), viết hoa; rỗng nếu không có tên. */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return '';
  const first = Array.from(words[0] ?? '')[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1] ?? '')[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('vi');
}
