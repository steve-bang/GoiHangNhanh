import type { EvidenceId, ShopId } from '@/core/ids';
import {
  FILE_STATES,
  type EvidenceFile,
  type EvidenceFilePatch,
  type EvidenceFileStore,
  type FileEvent,
} from '@/features/evidence';

import { MAX_UPLOAD_ATTEMPTS, retryDelayMs } from './backoff';
import type { LocalFileHasher, ServerFileState, UploadGateway } from './ports';

export interface UploadQueueDeps {
  readonly files: EvidenceFileStore;
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
const device = (type: FileEvent['type']): FileEvent => ({ type, origin: 'device' });
const server = (type: FileEvent['type']): FileEvent => ({ type, origin: 'server' });

/**
 * Hàng đợi tải lên nền (docs/architecture "hàng đợi tải lên"). Chạy qua máy trạng thái tệp:
 * - Chỉ ĐỌC tệp gốc, không bao giờ sửa/xóa; không có đường nào ở đây xóa bản cục bộ (bất biến 4).
 * - Trước khi tải, tính lại mã băm: khác mã lúc đóng tệp -> `needs_attention`, không tải bản đã đổi.
 * - Sự kiện `origin: 'server'` chỉ được tạo từ phản hồi của cổng máy chủ (xác nhận nhận đủ, trạng
 *   thái máy chủ báo); hàng đợi không tự phát ra `verified`.
 * - Tệp đang `uploading` mà app bị tắt: hỏi máy chủ trước (QA-05); máy chủ chưa có thì mới đưa về
 *   hàng đợi để thử lại.
 * - Thất bại tạm: giãn cách tăng dần, tối đa `MAX_UPLOAD_ATTEMPTS` lần rồi `needs_attention`.
 */
export function createUploadQueue(deps: UploadQueueDeps): UploadQueue {
  const { files, gateway, hasher, now, isOnline } = deps;
  let running = false;

  const apply = (file: EvidenceFile, event: FileEvent, patch?: EvidenceFilePatch) =>
    files.applyEvent(file.shopId, file.id, event, now(), patch);

  /** Đưa tệp theo trạng thái máy chủ báo. Trả số tệp thành `verified`. */
  async function followServer(file: EvidenceFile, state: ServerFileState): Promise<number> {
    const clear = { nextAttemptAtDevice: null, lastErrorCode: null } as const;
    if (file.state !== S.UPLOADED) {
      const received = await apply(file, server('SERVER_RECEIVED'), clear);
      if (!received.ok) return 0;
    }
    if (state === 'verified') {
      return (await apply(file, server('SERVER_VERIFIED'))).ok ? 1 : 0;
    }
    if (state === 'hash_mismatch') {
      await apply(file, server('SERVER_HASH_MISMATCH'));
    }
    return 0;
  }

  async function reconcile(shopId: ShopId, summary: Counters): Promise<void> {
    const pending = await files.listByStates(shopId, [
      S.UPLOADING,
      S.QUEUED,
      S.UPLOAD_FAILED,
      S.NEEDS_ATTENTION,
      S.UPLOADED,
    ]);
    if (pending.length === 0) return;
    let known: ReadonlyMap<EvidenceId, ServerFileState>;
    try {
      known = await gateway.fetchServerStates(
        shopId,
        pending.map((f) => f.id),
      );
    } catch {
      known = new Map(); // không hỏi được: tải lên idempotent theo id nên vẫn an toàn
    }
    for (const file of pending) {
      const state = known.get(file.id);
      if (state) {
        summary.verified += await followServer(file, state);
      } else if (file.state === S.UPLOADING) {
        // Máy chủ chưa có và không còn tiến trình tải nào: về hàng đợi thử lại.
        await apply(file, device('UPLOAD_FAILED'), { nextAttemptAtDevice: now() });
      }
    }
  }

  async function failAttempt(file: EvidenceFile, code: string, summary: Counters): Promise<void> {
    const attempt = file.attemptCount + 1;
    if (attempt >= MAX_UPLOAD_ATTEMPTS) {
      await apply(file, device('NEEDS_ATTENTION'), {
        lastErrorCode: code,
        nextAttemptAtDevice: null,
      });
      summary.needsAttention += 1;
      return;
    }
    await apply(file, device('UPLOAD_FAILED'), {
      attemptCount: attempt,
      lastErrorCode: code,
      nextAttemptAtDevice: now() + retryDelayMs(attempt),
    });
    summary.failed += 1;
  }

  async function uploadOne(file: EvidenceFile, summary: Counters): Promise<void> {
    const { localPath, sizeBytes, sha256Client } = file;
    if (!localPath || sizeBytes === null || !sha256Client) return; // chưa đủ chi tiết: không tải
    const hash = await hasher.sha256(localPath);
    if (!hash.ok || hash.sha256 !== sha256Client) {
      const code = hash.ok ? 'LOCAL_HASH_CHANGED' : hash.reason;
      await apply(file, device('NEEDS_ATTENTION'), {
        lastErrorCode: code,
        nextAttemptAtDevice: null,
      });
      summary.needsAttention += 1;
      return;
    }
    const started = await apply(file, device('UPLOAD_STARTED'));
    if (!started.ok) return;
    let outcome;
    try {
      outcome = await gateway.upload({
        evidenceId: file.id,
        shopId: file.shopId,
        orderId: file.orderId,
        sessionId: file.sessionId,
        packageId: file.packageId,
        kind: file.kind,
        createdAtDevice: file.createdAtDevice,
        durationMs: file.durationMs,
        localPath,
        sizeBytes,
        sha256Client,
      });
    } catch {
      outcome = { kind: 'retryable', code: 'UPLOAD_EXCEPTION' } as const;
    }
    const current = started.file;
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
        const due = (await files.listByStates(shopId, [S.UPLOAD_FAILED])).filter(
          (f) => (f.nextAttemptAtDevice ?? 0) <= now(),
        );
        for (const file of due) {
          await apply(file, device('RETRY_UPLOAD'), { nextAttemptAtDevice: null });
        }
        for (const file of await files.listByStates(shopId, [S.QUEUED])) {
          if (!isOnline()) break;
          await uploadOne(file, summary);
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
