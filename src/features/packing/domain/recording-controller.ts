import type { EvidenceId } from '@/core/ids';
import type { EvidenceFileStore } from '@/features/evidence';
import type { OrderStore, PackingSession } from '@/features/orders';

/** Kết quả ghi do bộ ghi (camera) trả về khi dừng. */
export type RecordResult =
  | { readonly ok: true; readonly tempUri: string }
  | { readonly ok: false; readonly reason: 'RECORDER_FAILED' };

export interface RecordingHandle {
  /** Hoàn tất khi dừng (người dùng hoặc lỗi). */
  readonly done: Promise<RecordResult>;
  stop(): void;
}

export interface Recorder {
  /** Bắt đầu ghi một video. Ném lỗi (đồng bộ hoặc bất đồng bộ) nếu camera không bắt đầu được. */
  record(): RecordingHandle;
}

export type PersistOutcome =
  | { readonly ok: true; readonly uri: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'STORAGE_FULL' | 'FAILED' };

export type HashOutcome =
  | { readonly ok: true; readonly sha256: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

export interface RecordingPorts {
  readonly files: EvidenceFileStore;
  readonly orders: Pick<OrderStore, 'updateSessionStatus'>;
  readonly recorder: Recorder;
  /** Chuyển tệp tạm vào thư mục bền (không sao chép). */
  persist(tempUri: string, evidenceId: string, extension: string): PersistOutcome;
  hash(localPath: string): Promise<HashOutcome>;
  newEvidenceId(): EvidenceId;
  /** Giờ THIẾT BỊ (ms). */
  now(): number;
}

export type RecordingOutcome =
  | { readonly kind: 'saved'; readonly evidenceId: EvidenceId }
  | {
      readonly kind: 'failed';
      readonly evidenceId: EvidenceId | null;
      readonly reason:
        'LOCAL_STORE' | 'RECORDER_FAILED' | 'STORAGE_FULL' | 'SAVE_FAILED' | 'FILE_UNREADABLE';
    };

export interface ActiveRecording {
  readonly evidenceId: EvidenceId;
  stop(): void;
  /** Luôn hoàn tất, không ném lỗi. */
  readonly result: Promise<RecordingOutcome>;
}

/** Trạng thái phiên cục bộ trong luồng ghi (khớp trạng thái Rules cho phép khi đăng lên máy chủ). */
export const SESSION_STATUS = {
  RECORDING: 'recording',
  ENDED: 'ended',
  INTERRUPTED: 'interrupted',
  NEEDS_ATTENTION: 'needs_attention',
} as const;

const device = (type: 'STOP_RECORDING' | 'LOCAL_FILE_READABLE' | 'LOCAL_WRITE_FAILED') =>
  ({ type, origin: 'device' }) as const;

const extensionOf = (uri: string): string => {
  const match = /\.([A-Za-z0-9]{2,5})(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'mp4';
};

/**
 * Điều phối MỘT lần quay (docs/04 A05), nối bộ ghi với kho tệp bằng chứng và trạng thái phiên:
 * 1. ID bằng chứng + bản ghi tệp (`recording`, gắn phiên + kiện + đơn) được tạo TRƯỚC khi mở camera
 *    (bất biến 2); không tạo được thì KHÔNG quay.
 * 2. Phiên chuyển `recording` rồi mới ghi.
 * 3. Dừng: `saving_local` -> chuyển tệp vào thư mục bền -> băm -> `queued` (có đường dẫn, kích thước,
 *    mã băm). Tới đây tệp mới "đã lưu trên máy". Lỗi ở bất kỳ bước nào ghi `local_save_failed` hoặc
 *    giữ trạng thái đúng thực tế và phiên `needs_attention`/`interrupted`; KHÔNG nói đã lưu.
 * 4. Không xóa tệp tạm hay tệp gốc ở bất kỳ nhánh lỗi nào (có thể là bản duy nhất).
 * Không bao giờ ném lỗi ra ngoài: kết quả nằm ở `result`. Chưa chạy trên thiết bị.
 */
export async function startRecording(
  ports: RecordingPorts,
  session: PackingSession,
): Promise<
  ActiveRecording | { readonly kind: 'failed'; readonly reason: 'LOCAL_STORE' | 'RECORDER_FAILED' }
> {
  const { files, orders, recorder, newEvidenceId, now } = ports;
  const evidenceId = newEvidenceId();
  const shopId = session.shopId;
  try {
    await files.create({
      id: evidenceId,
      shopId,
      orderId: session.orderId,
      packageId: session.packageId,
      sessionId: session.id,
      group: 'pack',
      kind: 'video',
      createdAtDevice: now(),
    });
    await orders.updateSessionStatus(shopId, session.id, SESSION_STATUS.RECORDING);
  } catch {
    return { kind: 'failed', reason: 'LOCAL_STORE' };
  }

  let handle: RecordingHandle;
  try {
    handle = recorder.record();
  } catch {
    await markFailed(ports, session, evidenceId, SESSION_STATUS.INTERRUPTED);
    return { kind: 'failed', reason: 'RECORDER_FAILED' };
  }

  const result = handle.done.then(
    (recorded) => finish(ports, session, evidenceId, recorded),
    () => finish(ports, session, evidenceId, { ok: false, reason: 'RECORDER_FAILED' }),
  );
  return { evidenceId, stop: () => handle.stop(), result };
}

async function markFailed(
  ports: RecordingPorts,
  session: PackingSession,
  evidenceId: EvidenceId,
  sessionStatus: string,
  patch?: { localPath: string },
): Promise<void> {
  try {
    await ports.files.applyEvent(
      session.shopId,
      evidenceId,
      device('LOCAL_WRITE_FAILED'),
      ports.now(),
      patch,
    );
  } catch {
    // trạng thái tệp giữ nguyên; phiên vẫn được đánh dấu bên dưới
  }
  try {
    await ports.orders.updateSessionStatus(session.shopId, session.id, sessionStatus);
  } catch {
    // không ghi được trạng thái phiên: lần mở app sau sẽ phục hồi theo trạng thái tệp
  }
}

async function finish(
  ports: RecordingPorts,
  session: PackingSession,
  evidenceId: EvidenceId,
  recorded: RecordResult,
): Promise<RecordingOutcome> {
  const { files, orders, persist, hash, now } = ports;
  const shopId = session.shopId;
  const fail = (
    reason: Extract<RecordingOutcome, { kind: 'failed' }>['reason'],
  ): RecordingOutcome => ({ kind: 'failed', evidenceId, reason });
  try {
    if (!recorded.ok) {
      await markFailed(ports, session, evidenceId, SESSION_STATUS.INTERRUPTED);
      return fail('RECORDER_FAILED');
    }
    // Ghi đường dẫn tệp tạm ngay khi dừng để phục hồi được nếu app bị kill trước khi chuyển tệp.
    const stopped = await files.applyEvent(shopId, evidenceId, device('STOP_RECORDING'), now(), {
      localPath: recorded.tempUri,
    });
    if (!stopped.ok) return fail('SAVE_FAILED');

    const saved = persist(recorded.tempUri, evidenceId, extensionOf(recorded.tempUri));
    if (!saved.ok) {
      await markFailed(ports, session, evidenceId, SESSION_STATUS.NEEDS_ATTENTION);
      return fail(saved.reason === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'SAVE_FAILED');
    }
    const hashed = await hash(saved.uri);
    if (!hashed.ok) {
      // Ghi vị trí thật của tệp (đã nằm ở thư mục bền) để không mất dấu bản này.
      await markFailed(ports, session, evidenceId, SESSION_STATUS.NEEDS_ATTENTION, {
        localPath: saved.uri,
      });
      return fail('FILE_UNREADABLE');
    }
    const queued = await files.applyEvent(
      shopId,
      evidenceId,
      device('LOCAL_FILE_READABLE'),
      now(),
      {
        localPath: saved.uri,
        sizeBytes: hashed.sizeBytes,
        sha256Client: hashed.sha256,
      },
    );
    if (!queued.ok) {
      await markFailed(ports, session, evidenceId, SESSION_STATUS.NEEDS_ATTENTION);
      return fail('SAVE_FAILED');
    }
    await orders.updateSessionStatus(shopId, session.id, SESSION_STATUS.ENDED);
    return { kind: 'saved', evidenceId };
  } catch {
    return fail('SAVE_FAILED');
  }
}

/**
 * Phục hồi sau khi app bị đóng/kill giữa chừng (A05: không tự nhận là video đầy đủ). Chạy lúc mở app:
 * - `recording`: không biết tệp tạm ở đâu -> `unrecoverable`, phiên `interrupted` (ghi nhận thiếu, không
 *   dựng video giả; bất biến 6).
 * - `saving_local`: còn tệp (tạm hoặc bền) thì chuyển vào thư mục bền nếu cần, băm và đưa vào hàng
 *   đợi (`queued`); mất tệp thì `unrecoverable`. Phiên luôn `interrupted` (không tự nhận là đầy đủ).
 * Trả số tệp đã xử lý. Không ném lỗi.
 */
export async function recoverInterruptedRecordings(
  ports: Pick<RecordingPorts, 'files' | 'orders' | 'persist' | 'hash' | 'now'> & {
    readonly exists: (localPath: string) => boolean;
  },
  shopId: PackingSession['shopId'],
): Promise<number> {
  const { files, orders, persist, hash, now, exists } = ports;
  let handled = 0;
  try {
    for (const file of await files.listByStates(shopId, ['recording', 'saving_local'])) {
      let queued = false;
      if (file.state === 'saving_local' && file.localPath && exists(file.localPath)) {
        // Tệp còn ở thư mục tạm thì chuyển vào thư mục bền trước; đã ở thư mục bền thì băm luôn.
        const alreadyPersistent = file.localPath.includes('/evidence/');
        const saved = alreadyPersistent
          ? ({ ok: true, uri: file.localPath } as const)
          : persist(file.localPath, file.id, extensionOf(file.localPath));
        const hashed = saved.ok ? await hash(saved.uri) : null;
        if (saved.ok && hashed?.ok) {
          const result = await files.applyEvent(
            shopId,
            file.id,
            device('LOCAL_FILE_READABLE'),
            now(),
            {
              localPath: saved.uri,
              sizeBytes: hashed.sizeBytes,
              sha256Client: hashed.sha256,
            },
          );
          queued = result.ok;
        }
      }
      if (!queued) {
        await files.applyEvent(
          shopId,
          file.id,
          { type: 'MARK_UNRECOVERABLE', origin: 'device' },
          now(),
        );
      }
      // Phiên bị gián đoạn: dù cứu được tệp, video có thể thiếu phần cuối nên không tự nhận là đầy đủ.
      await orders
        .updateSessionStatus(shopId, file.sessionId, SESSION_STATUS.INTERRUPTED)
        .catch(() => undefined);
      handled += 1;
    }
  } catch {
    // lỗi kho cục bộ: dừng, lần mở app sau chạy lại
  }
  return handled;
}
