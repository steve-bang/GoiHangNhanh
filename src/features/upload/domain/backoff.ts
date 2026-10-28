/** Số lần thử tối đa trước khi chuyển sang "cần xử lý" thay vì thử mãi. */
export const MAX_UPLOAD_ATTEMPTS = 8;

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 15 * 60_000;

/**
 * Chờ bao lâu trước lần thử kế tiếp, sau lần thất bại thứ `attempt` (bắt đầu từ 1): 5 giây, 10 giây,
 * 20 giây... tối đa 15 phút. Không ngẫu nhiên hóa để dễ kiểm thử; một thiết bị chỉ có một hàng đợi.
 */
export function retryDelayMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt, 30) - 1);
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
}
