/**
 * Cổng phiên cho màn nghiệp vụ (V1-06, decisions.md `Q-29 / V1-06`). TypeScript thuần.
 *
 * `hydration` cho biết phiên trong bộ nhớ đã được đối chiếu với phiên lưu trên máy chưa:
 * - `pending`: chưa có câu trả lời (vừa mở app, đang nạp);
 * - `failed`: lần nạp gần nhất lỗi (ví dụ offline và chưa có bộ nhớ đệm `userShops`), đang chờ thử lại;
 * - `settled`: đã có câu trả lời dứt khoát (có danh tính, chưa đăng nhập, hoặc đã đăng nhập/đăng xuất
 *   trong app).
 */
export type SessionHydration = 'pending' | 'failed' | 'settled';

export interface SessionGateInput {
  /** Chế độ chặt: bản Firebase/"chưa kết nối". Cổng giả (dev, test, bản web) = `false`. */
  readonly strict: boolean;
  readonly status: 'signed_out' | 'signed_in';
  readonly shopId: string | null;
  readonly hydration: SessionHydration;
}

/**
 * - `open`: hiện màn.
 * - `loading`: đang nạp phiên, chưa hiện màn (không để màn đọc/ghi dưới shop chưa biết).
 * - `unreachable`: chưa nạp được thông tin cửa hàng (thường do mạng), cho thử lại.
 * - `signed_out`: chưa đăng nhập, về Chào mừng.
 * - `no_shop`: đã đăng nhập nhưng chưa có cửa hàng, về Tạo cửa hàng.
 */
export type SessionGate = 'open' | 'loading' | 'unreachable' | 'signed_out' | 'no_shop';

export function evaluateSessionGate(input: SessionGateInput): SessionGate {
  if (!input.strict) return 'open';
  if (input.status === 'signed_in') return input.shopId ? 'open' : 'no_shop';
  switch (input.hydration) {
    case 'settled':
      return 'signed_out';
    case 'failed':
      return 'unreachable';
    case 'pending':
      return 'loading';
  }
}
