/**
 * Tín hiệu dùng chung "đang quay video" (V1-28). Hàng đợi tải lên và băm nền (`features/upload`) đọc nó
 * để tạm dừng, nhường CPU, mạng và pin cho bộ mã hóa video; không import UI. TypeScript thuần (không
 * React/SDK), chỉ trong bộ nhớ: app bị kill thì tín hiệu tự mất (không có gì để kẹt).
 *
 * Mỗi lần quay lấy MỘT phiếu (`beginRecordingActivity`); phiếu trả lại bằng hàm `release` (idempotent).
 * Đang có phiếu nào còn mở = đang quay. Lưới an toàn: phiếu tự hết hạn sau `RECORDING_ACTIVITY_MAX_MS`
 * (quá giới hạn 10 phút của một video + dư) để cờ không thể kẹt bật vĩnh viễn nếu một đường kết thúc sót.
 */

/** 10 phút tối đa một video + 5 phút dư (dừng, lưu). Chỉ là lưới an toàn, không phải thời lượng quay. */
export const RECORDING_ACTIVITY_MAX_MS = 15 * 60 * 1000;

type Listener = (active: boolean) => void;

const tickets = new Map<symbol, ReturnType<typeof setTimeout>>();
const listeners = new Set<Listener>();

function notify(active: boolean): void {
  for (const listener of [...listeners]) {
    try {
      listener(active);
    } catch {
      // người nghe lỗi không được làm kẹt cờ hay chặn người nghe khác
    }
  }
}

/** Bắt đầu một lần quay. Trả hàm kết thúc (gọi nhiều lần vô hại). Luôn gọi trong `finally`/mọi đường kết thúc. */
export function beginRecordingActivity(): () => void {
  const id = Symbol('recording');
  const wasActive = tickets.size > 0;
  const expiry = setTimeout(() => release(), RECORDING_ACTIVITY_MAX_MS);
  // Không giữ tiến trình Node (test) sống chỉ vì lưới an toàn.
  (expiry as { unref?: () => void }).unref?.();
  tickets.set(id, expiry);
  function release(): void {
    const timer = tickets.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    tickets.delete(id);
    if (tickets.size === 0) notify(false);
  }
  if (!wasActive) notify(true);
  return release;
}

export function isRecordingActive(): boolean {
  return tickets.size > 0;
}

/** Nghe khi trạng thái "đang quay" đổi (true/false). Trả hàm hủy. */
export function subscribeRecordingActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Chỉ cho test: xóa mọi phiếu và người nghe. */
export function resetRecordingActivityForTest(): void {
  for (const timer of tickets.values()) clearTimeout(timer);
  tickets.clear();
  listeners.clear();
}
