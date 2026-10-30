/** Lệnh không trả lời trong thời hạn (`withTimeout`). */
export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  constructor() {
    super('TIMEOUT');
  }
}

/** Lệnh bị hủy giữa chừng qua `AbortSignal` (ví dụ: máy báo mất mạng). */
export class AbortedError extends Error {
  readonly code = 'ABORTED';
  constructor() {
    super('ABORTED');
  }
}

/**
 * Chờ `task` tối đa `ms` mili giây (`null` = không giới hạn thời gian, chỉ hủy được qua `signal`); quá
 * hạn thì ném `TimeoutError`, `signal` hủy thì ném `AbortedError`.
 * KHÔNG hủy được lệnh bên dưới (ví dụ lệnh ghi Firestore vẫn nằm trong hàng chờ của SDK): chỉ giải
 * phóng người gọi để hàng đợi không treo. Vì vậy chỉ dùng cho lệnh idempotent.
 */
export function withTimeout<T>(
  task: Promise<T>,
  ms: number | null,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    task.catch(() => undefined);
    return Promise.reject(new AbortedError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new AbortedError());
    };
    const timer =
      ms === null
        ? null
        : setTimeout(() => {
            cleanup();
            reject(new TimeoutError());
          }, ms);
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort);
    task.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}
