/**
 * Đồng hồ ĐƠN ĐIỆU (ms) để đo khoảng thời gian (bộ đếm giới hạn quay): không nhảy khi giờ máy bị chỉnh
 * hoặc đồng bộ mạng, khác với `Date.now()` (giờ treo tường, dùng cho dấu thời gian). Giá trị chỉ có nghĩa
 * khi so với một lần đọc khác của chính hàm này. Không có `performance.now` thì rơi về `Date.now()`.
 * Test giả lập bằng `jest.useFakeTimers` (giả cả `performance`) hoặc mock hàm này.
 */
export function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}
