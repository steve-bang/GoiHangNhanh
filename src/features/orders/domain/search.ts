import { toCodeKey } from './codes';

/** Chuỗi tìm ngắn hơn mức này không truy vấn và không ghi vào lịch sử (tránh quét cả kho khi mới gõ 1 ký tự). */
export const MIN_SEARCH_LENGTH = 2;
/** Số mục lịch sử tìm tối đa mỗi shop. */
export const MAX_RECENT_SEARCHES = 10;
/** Số kết quả tối đa một lần tìm ở UI-B03. */
export const SEARCH_RESULT_LIMIT = 20;
/** Chờ sau lần gõ cuối rồi mới truy vấn (đặc tả: 300-500 ms). */
export const SEARCH_DEBOUNCE_MS = 350;

/**
 * Chuẩn hóa ô tìm: bỏ khoảng trắng thừa. `null` = không truy vấn (rỗng hoặc dưới `MIN_SEARCH_LENGTH`).
 * `key` là khóa so khớp (`toCodeKey`), `text` là chuỗi hiển thị đã gọn.
 */
export function normalizeSearchInput(raw: string): { text: string; key: string } | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length < MIN_SEARCH_LENGTH) return null;
  return { text, key: toCodeKey(text) };
}
