import type { EvidenceId, ShopId } from '@/core/ids';
import { FILE_STATES, mayHaveReachedServer, type FileEvent } from '@/features/evidence';

import { MAX_UPLOAD_ATTEMPTS, retryDelayMs } from './backoff';
import { evidenceMaxBytes, UPLOAD_FILE_TOO_LARGE } from './limits';
import type {
  LocalFileHasher,
  ServerFileState,
  UploadGateway,
  UploadItem,
  UploadItemPatch,
  UploadSource,
} from './ports';

export interface UploadQueueDeps {
  /**
   * Các kho tệp hàng đợi phục vụ (tệp đóng gói, media hàng hoàn...). Mỗi nguồn đi qua CÙNG vòng đối
   * soát, giãn cách thử lại và giới hạn số lần thử; không nhân đôi hàng đợi theo loại bằng chứng.
   */
  readonly sources: readonly UploadSource[];
  readonly gateway: UploadGateway;
  readonly hasher: LocalFileHasher;
  /** Giờ THIẾT BỊ (ms). */
  readonly now: () => number;
  readonly isOnline: () => boolean;
}

export interface UploadRunSummary {
  /** `offline`/`busy`: không làm gì lượt này. */
  readonly skipped?: 'offline' | 'busy';
  readonly received: number;
  readonly failed: number;
  readonly needsAttention: number;
  readonly verified: number;
}

export interface UploadQueue {
  /** Một lượt xử lý tuần tự theo shop. Lượt chồng lên nhau bị bỏ qua (`busy`). Không ném lỗi. */
  runOnce(shopId: ShopId): Promise<UploadRunSummary>;
}

const S = FILE_STATES;

/**
 * Có đáng hỏi máy chủ về tệp này không (mỗi lần hỏi là một lượt đọc Firestore)? Dựa trên định nghĩa
 * "máy chủ có thể đã biết" dùng chung với quy tắc xóa ảnh hàng hoàn (`mayHaveReachedServer`,
 * features/evidence), trừ tệp máy chủ đã chốt (`verified`/`hash_mismatch`): không hỏi lại.
 */
export function mayBeKnownToServer(file: Parameters<typeof mayHaveReachedServer>[0]): boolean {
  return file.state !== S.VERIFIED && file.state !== S.HASH_MISMATCH && mayHaveReachedServer(file);
}

const device = (type: FileEvent['type']): FileEvent => ({ type, origin: 'device' });
const server = (type: FileEvent['type']): FileEvent => ({ type, origin: 'server' });

interface Entry {
  readonly source: UploadSource;
  readonly item: UploadItem;
}

/**
 * Hàng đợi tải lên nền (docs/architecture "hàng đợi tải lên"). Chạy qua máy trạng thái tệp:
 * - Chỉ ĐỌC tệp gốc, không bao giờ sửa/xóa; không có đường nào ở đây xóa bản cục bộ (bất biến 4).
 * - Trước khi tải, tính lại mã băm: khác mã lúc đóng tệp -> `needs_attention`, không tải bản đã đổi.
 * - Sự kiện `origin: 'server'` chỉ được tạo từ phản hồi của cổng máy chủ (xác nhận nhận đủ, trạng
 *   thái máy chủ báo); hàng đợi không tự phát ra `verified`.
 * - Tệp đang `uploading` mà app bị tắt: hỏi máy chủ trước (QA-05); máy chủ chưa có thì mới đưa về
 *   hàng đợi để thử lại.
 * - Thất bại tạm: giãn cách tăng dần, tối đa `MAX_UPLOAD_ATTEMPTS` lần rồi `needs_attention`.
 * - Nhiều nguồn (Q-28): một nguồn lỗi kho không chặn nguồn khác trong cùng lượt.
 */
export function createUploadQueue(deps: UploadQueueDeps): UploadQueue {
  const { sources, gateway, hasher, now, isOnline } = deps;
  let running = false;

  const apply = (entry: Entry, event: FileEvent, patch?: UploadItemPatch) =>
    entry.source.applyEvent(entry.item.shopId, entry.item.id, event, now(), patch);

  /** Đưa tệp theo trạng thái máy chủ báo. Trả số tệp thành `verified`. */
  async function followServer(entry: Entry, state: ServerFileState): Promise<number> {
    const clear = { nextAttemptAtDevice: null, lastErrorCode: null } as const;
    if (entry.item.state !== S.UPLOADED) {
      const received = await apply(entry, server('SERVER_RECEIVED'), clear);
      if (!received.ok) return 0;
    }
    if (state === 'verified') {
      return (await apply(entry, server('SERVER_VERIFIED'))).ok ? 1 : 0;
    }
    if (state === 'hash_mismatch') {
      await apply(entry, server('SERVER_HASH_MISMATCH'));
    }
    return 0;
  }

  /** Liệt kê theo từng nguồn; nguồn lỗi bị bỏ qua (lượt sau thử lại), không chặn nguồn khác. */
  async function list(
    shopId: ShopId,
    states: readonly (typeof S)[keyof typeof S][],
  ): Promise<Entry[]> {
    const entries: Entry[] = [];
    for (const source of sources) {
      try {
        for (const item of await source.listByStates(shopId, states)) {
          entries.push({ source, item });
        }
      } catch {
        // Lỗi kho cục bộ của nguồn này: bỏ qua lượt này.
      }
    }
    return entries;
  }

  async function reconcile(shopId: ShopId, summary: Counters): Promise<void> {
    const pending = (
      await list(shopId, [S.UPLOADING, S.QUEUED, S.UPLOAD_FAILED, S.NEEDS_ATTENTION, S.UPLOADED])
    ).filter((e) => mayBeKnownToServer(e.item));
    if (pending.length === 0) return;
    let known: ReadonlyMap<EvidenceId, ServerFileState>;
    try {
      known = await gateway.fetchServerStates(
        shopId,
        pending.map((e) => e.item.id),
      );
    } catch {
      known = new Map(); // không hỏi được: tải lên idempotent theo id nên vẫn an toàn
    }
    for (const entry of pending) {
      const state = known.get(entry.item.id);
      if (state) {
        summary.verified += await followServer(entry, state);
      } else if (entry.item.state === S.UPLOADING) {
        // Máy chủ chưa có và không còn tiến trình tải nào: về hàng đợi thử lại. GHI DẤU lần thử bị gián
        // đoạn (tăng số lần thử + mã lỗi, không ghi PII) để sau khi về `queued` vẫn biết tệp đã từng
        // được đưa cho máy chủ (`mayHaveReachedServer`, Q-26j/Q-28: ảnh không được xóa).
        await apply(entry, device('UPLOAD_FAILED'), {
          attemptCount: entry.item.attemptCount + 1,
          lastErrorCode: 'UPLOAD_INTERRUPTED',
          nextAttemptAtDevice: now(),
        });
      }
    }
  }

  async function failAttempt(entry: Entry, code: string, summary: Counters): Promise<void> {
    const attempt = entry.item.attemptCount + 1;
    if (attempt >= MAX_UPLOAD_ATTEMPTS) {
      await apply(entry, device('NEEDS_ATTENTION'), {
        lastErrorCode: code,
        nextAttemptAtDevice: null,
      });
      summary.needsAttention += 1;
      return;
    }
    await apply(entry, device('UPLOAD_FAILED'), {
      attemptCount: attempt,
      lastErrorCode: code,
      nextAttemptAtDevice: now() + retryDelayMs(attempt),
    });
    summary.failed += 1;
  }

  async function uploadOne(entry: Entry, summary: Counters): Promise<void> {
    const { localPath, sizeBytes, sha256Client } = entry.item;
    if (!localPath || sizeBytes === null || !sha256Client) return; // chưa đủ chi tiết: không tải
    if (sizeBytes > evidenceMaxBytes(entry.item.kind)) {
      // Vượt trần máy chủ (Rules + Function luôn từ chối): không băm, không gửi, báo cần xử lý ngay.
      // Tệp cục bộ giữ nguyên (bất biến 4).
      await apply(entry, device('NEEDS_ATTENTION'), {
        lastErrorCode: UPLOAD_FILE_TOO_LARGE,
        nextAttemptAtDevice: null,
      });
      summary.needsAttention += 1;
      return;
    }
    const hash = await hasher.sha256(localPath);
    if (!hash.ok || hash.sha256 !== sha256Client) {
      const code = hash.ok ? 'LOCAL_HASH_CHANGED' : hash.reason;
      await apply(entry, device('NEEDS_ATTENTION'), {
        lastErrorCode: code,
        nextAttemptAtDevice: null,
      });
      summary.needsAttention += 1;
      return;
    }
    const started = await apply(entry, device('UPLOAD_STARTED'));
    if (!started.ok) return;
    const current: Entry = { source: entry.source, item: started.item };
    let outcome;
    try {
      outcome = await gateway.upload({
        evidenceId: current.item.id,
        shopId: current.item.shopId,
        owner: current.item.owner,
        kind: current.item.kind,
        createdAtDevice: current.item.createdAtDevice,
        durationMs: current.item.durationMs,
        localPath,
        sizeBytes,
        sha256Client,
      });
    } catch {
      outcome = { kind: 'retryable', code: 'UPLOAD_EXCEPTION' } as const;
    }
    if (outcome.kind === 'received') {
      const done = await apply(current, server('SERVER_RECEIVED'), {
        nextAttemptAtDevice: null,
        lastErrorCode: null,
      });
      if (done.ok) summary.received += 1;
    } else if (outcome.kind === 'attention') {
      await apply(current, device('NEEDS_ATTENTION'), {
        lastErrorCode: outcome.code,
        nextAttemptAtDevice: null,
      });
      summary.needsAttention += 1;
    } else {
      await failAttempt(current, outcome.code, summary);
    }
  }

  return {
    async runOnce(shopId) {
      const summary: Counters = { received: 0, failed: 0, needsAttention: 0, verified: 0 };
      if (running) return { ...summary, skipped: 'busy' };
      if (!isOnline()) return { ...summary, skipped: 'offline' };
      running = true;
      try {
        await reconcile(shopId, summary);
        const due = (await list(shopId, [S.UPLOAD_FAILED])).filter(
          (e) => (e.item.nextAttemptAtDevice ?? 0) <= now(),
        );
        for (const entry of due) {
          await apply(entry, device('RETRY_UPLOAD'), { nextAttemptAtDevice: null });
        }
        for (const entry of await list(shopId, [S.QUEUED])) {
          if (!isOnline()) break;
          await uploadOne(entry, summary);
        }
      } catch {
        // Lỗi kho cục bộ: dừng lượt này, trạng thái đã ghi vẫn nguyên; lượt sau chạy lại.
      } finally {
        running = false;
      }
      return summary;
    },
  };
}

interface Counters {
  received: number;
  failed: number;
  needsAttention: number;
  verified: number;
}
