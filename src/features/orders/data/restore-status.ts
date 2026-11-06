/**
 * Trạng thái khôi phục dữ liệu cho giao diện. `visible` = có nên cho người dùng thấy (máy mới/trống hoặc
 * đã thật sự lấy về bản ghi); máy đã đủ dữ liệu chỉ đối soát lặng lẽ, không hiện thẻ.
 */
export type RestoreStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly visible: boolean; readonly orders: number }
  | { readonly kind: 'waiting_network'; readonly visible: boolean; readonly orders: number }
  | { readonly kind: 'failed'; readonly visible: boolean; readonly orders: number }
  | { readonly kind: 'done'; readonly orders: number };

export const IDLE_RESTORE: RestoreStatus = { kind: 'idle' };

export interface RestoreController {
  get(): RestoreStatus;
  set(status: RestoreStatus): void;
  subscribe(listener: () => void): () => void;
  /** Yêu cầu chạy lại ngay (nút "Thử lại"); bộ chạy nền đăng ký bằng `onRetry`. */
  retry(): void;
  onRetry(handler: () => void): () => void;
}

export function createRestoreController(): RestoreController {
  let status: RestoreStatus = IDLE_RESTORE;
  const listeners = new Set<() => void>();
  const retryHandlers = new Set<() => void>();
  return {
    get: () => status,
    set(next) {
      status = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    retry() {
      for (const handler of [...retryHandlers]) handler();
    },
    onRetry(handler) {
      retryHandlers.add(handler);
      return () => void retryHandlers.delete(handler);
    },
  };
}

/** Có hiện thẻ tiến độ không (thẻ "Đã lấy lại" hiện ngắn rồi ẩn do giao diện). */
export function isRestoreVisible(status: RestoreStatus): boolean {
  return status.kind === 'done' ? status.orders > 0 : status.kind !== 'idle' && status.visible;
}
