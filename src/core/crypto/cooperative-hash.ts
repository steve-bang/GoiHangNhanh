import type { Sha256 } from './sha256';

/** Lát nhỏ nhất được băm liền một mạch trước khi xét nhường luồng (V1-13). */
export const HASH_SLICE_BYTES = 256 * 1024;

/**
 * Thời gian chạy liên tục tối đa (ms) trước khi nhường luồng JS. Ước lượng (một khung hình ~16 ms);
 * con số thật trên Hermes phải đo ở cổng thiết bị G-5 (R-5).
 */
export const HASH_YIELD_BUDGET_MS = 12;

/** Quyết định khi nào nhường luồng JS trong lúc băm, và nhường thế nào. */
export interface HashYielder {
  /** Gọi sau mỗi lát; nhường (chờ một macrotask) nếu đã chạy liên tục quá ngân sách. */
  maybeYield(): Promise<void>;
}

/**
 * Nhường theo THỜI GIAN chứ không theo số khối: mỗi lần nhường bằng `setTimeout` tốn vài ms, nhường sau
 * mỗi khối 1 MB của tệp 1 GB sẽ cộng thêm hàng giây. `wait` phải là macrotask (`setTimeout`), vì `await`
 * một Promise đã xong chỉ là microtask: React Native chưa kịp xử lý chạm/vẽ.
 */
export function createTimeSliceYielder(
  options: {
    readonly budgetMs?: number;
    readonly now?: () => number;
    readonly wait?: () => Promise<void>;
  } = {},
): HashYielder {
  const budgetMs = options.budgetMs ?? HASH_YIELD_BUDGET_MS;
  const now = options.now ?? Date.now;
  const wait = options.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  let sliceStart = now();
  return {
    async maybeYield() {
      if (now() - sliceStart < budgetMs) return;
      await wait();
      sliceStart = now();
    },
  };
}

/** Đưa `data` vào bộ băm theo lát `sliceBytes`, xét nhường luồng sau mỗi lát. Kết quả băm không đổi. */
export async function updateCooperatively(
  hash: Sha256,
  data: Uint8Array,
  yielder: HashYielder,
  sliceBytes: number = HASH_SLICE_BYTES,
): Promise<void> {
  for (let offset = 0; offset < data.length; offset += sliceBytes) {
    hash.update(data.subarray(offset, Math.min(offset + sliceBytes, data.length)));
    await yielder.maybeYield();
  }
}
