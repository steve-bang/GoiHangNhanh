/**
 * Số lần MÁY CHỦ TỪ CHỐI (hoặc lỗi không rõ) tối đa trước khi chuyển sang "cần xử lý" thay vì thử mãi.
 * Lỗi mạng không tính vào đây (Q-24h): mất mạng bao lâu cũng không làm tệp thành "cần xử lý".
 */
export const MAX_UPLOAD_ATTEMPTS = 8;

const BASE_DELAY_MS = 5_000;
/** Trần giãn cách giữa hai lần thử (cả lỗi mạng lẫn lỗi máy chủ). */
export const MAX_RETRY_DELAY_MS = 15 * 60_000;

/**
 * Chờ bao lâu trước lần thử kế tiếp, sau lần thất bại thứ `attempt` (bắt đầu từ 1; với lỗi mạng là số
 * lần lỗi mạng LIÊN TIẾP): 5 giây, 10 giây, 20 giây... tối đa 15 phút. Không ngẫu nhiên hóa để dễ kiểm thử; một thiết bị chỉ có một hàng đợi.
 */
export function retryDelayMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt, 30) - 1);
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS);
}
