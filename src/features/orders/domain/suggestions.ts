import type { OrderLine } from './types';

type HistoryLine = Pick<OrderLine, 'name' | 'variant' | 'createdAtDevice'>;

const keyOf = (value: string) => value.trim().toLowerCase();

/**
 * Gợi ý tên sản phẩm từ lịch sử đã nhập: mỗi tên một lần (không phân biệt hoa thường), mới nhất
 * trước, lọc theo chữ đang gõ. CHỈ là tên: variant gợi ý riêng (`suggestVariants`), không gộp.
 */
export function suggestProductNames(
  history: readonly HistoryLine[],
  query: string,
  limit = 5,
): string[] {
  const needle = keyOf(query);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...history].sort((a, b) => b.createdAtDevice - a.createdAtDevice)) {
    const key = keyOf(line.name);
    if (key.length === 0 || seen.has(key)) continue;
    if (needle.length > 0 && !key.includes(needle)) continue;
    // Đang gõ đúng nguyên tên này thì không cần gợi ý lại chính nó.
    if (needle.length > 0 && key === needle) continue;
    seen.add(key);
    out.push(line.name.trim());
    if (out.length >= limit) break;
  }
  return out;
}

/** Variant gần đây của đúng sản phẩm có tên này (các variant khác nhau là các gợi ý riêng). */
export function suggestVariants(
  history: readonly HistoryLine[],
  productName: string,
  limit = 5,
): string[] {
  const nameKey = keyOf(productName);
  if (nameKey.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...history].sort((a, b) => b.createdAtDevice - a.createdAtDevice)) {
    if (keyOf(line.name) !== nameKey || !line.variant) continue;
    const key = keyOf(line.variant);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(line.variant.trim());
    if (out.length >= limit) break;
  }
  return out;
}
