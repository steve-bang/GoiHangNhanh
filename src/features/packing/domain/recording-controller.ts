import type { EvidenceId } from '@/core/ids';
import type { EvidenceFile, EvidenceFileStore, FileEventType } from '@/features/evidence';
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
  /**
   * Chuyển tệp tạm vào thư mục bền (không sao chép). `uri` trả về là đường dẫn ĐỂ LƯU trong CSDL
   * (tương đối so với thư mục tài liệu; xem `platform/recording-files.ts`).
   */
  persist(tempUri: string, evidenceId: string, extension: string): PersistOutcome;
  hash(localPath: string): Promise<HashOutcome>;
  newEvidenceId(): EvidenceId;
  /** Giờ THIẾT BỊ (ms). */
  now(): number;
  /**
   * Dung lượng trống (byte) nếu đọc được; `null` = không biết (khi đó KHÔNG chặn quay, chỉ còn lỗi hết
   * dung lượng lúc lưu). Không truyền thì bỏ qua kiểm tra (A04).
   */
  availableBytes?(): number | null;
}

/**
 * Dung lượng trống tối thiểu để bắt đầu quay (A04: `INSUFFICIENT_STORAGE`). GIÁ TRỊ TẠM (500 MB): ngưỡng
 * vận hành thật chờ O-05 và đo bitrate thực trên thiết bị; một video 5-10 phút có thể vài trăm MB.
 */
export const MIN_FREE_BYTES_TO_RECORD = 500 * 1024 * 1024;

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

const device = (type: FileEventType) => ({ type, origin: 'device' }) as const;

const extensionOf = (uri: string): string => {
  const match = /\.([A-Za-z0-9]{2,5})(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'mp4';
};

/**
 * Điều phối MỘT lần quay (docs/04 A05), nối bộ ghi với kho tệp bằng chứng và trạng thái phiên:
 * 0. Dung lượng trống dưới ngưỡng (`MIN_FREE_BYTES_TO_RECORD`) thì từ chối bắt đầu (A04), chưa tạo gì.
 * 1. ID bằng chứng + bản ghi tệp (`recording`, gắn phiên + kiện + đơn) được tạo TRƯỚC khi mở camera
 *    (bất biến 2); không tạo được thì KHÔNG quay.
 * 2. Phiên chuyển `recording` rồi mới ghi.
 * 3. Dừng: `saving_local` -> chuyển tệp vào thư mục bền -> băm -> `queued` (có đường dẫn, kích thước,
 *    mã băm). Tới đây tệp mới "đã lưu trên máy". Lỗi ở bất kỳ bước nào ghi `local_save_failed` hoặc
 *    giữ trạng thái đúng thực tế và phiên `needs_attention`/`interrupted`; KHÔNG nói đã lưu.
 *    Ngay sau khi chuyển tệp, đường dẫn MỚI được ghi vào bản ghi (`LOCAL_FILE_MOVED`) TRƯỚC khi băm
 *    (băm bằng JS có thể mất rất lâu): app bị kill lúc băm thì không mất dấu bản gốc. Mọi lỗi sau bước
 *    chuyển đều truyền đường dẫn mới.
 * 4. Không xóa tệp tạm hay tệp gốc ở bất kỳ nhánh lỗi nào (có thể là bản duy nhất).
 * Không bao giờ ném lỗi ra ngoài: kết quả nằm ở `result`. Chưa chạy trên thiết bị.
 */
export async function startRecording(
  ports: RecordingPorts,
  session: PackingSession,
): Promise<
  | ActiveRecording
  | {
      readonly kind: 'failed';
      readonly reason: 'LOCAL_STORE' | 'RECORDER_FAILED' | 'INSUFFICIENT_STORAGE';
    }
> {
  const { files, orders, recorder, newEvidenceId, now } = ports;
  // A04: kiểm dung lượng TRƯỚC khi tạo bất cứ thứ gì, để không có tệp/phiên `recording` mồ côi.
  const free = ports.availableBytes?.() ?? null;
  if (free !== null && free < MIN_FREE_BYTES_TO_RECORD) {
    return { kind: 'failed', reason: 'INSUFFICIENT_STORAGE' };
  }
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
  /** Đường dẫn bền sau khi chuyển tệp; có giá trị thì mọi lỗi về sau phải giữ nó. */
  let savedUri: string | null = null;
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
      await markFailed(ports, session, evidenceId, SESSION_STATUS.NEEDS_ATTENTION, {
        localPath: recorded.tempUri,
      });
      return fail(saved.reason === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'SAVE_FAILED');
    }
    savedUri = saved.uri;
    // Ghi vị trí mới NGAY (trước khi băm, có thể mất rất lâu): tệp đã rời thư mục tạm, CSDL không
    // được còn trỏ vào đó, nếu không app bị kill lúc băm sẽ coi bản gốc là mất.
    const moved = await files.applyEvent(shopId, evidenceId, device('LOCAL_FILE_MOVED'), now(), {
      localPath: saved.uri,
    });
    if (!moved.ok) {
      await markFailed(ports, session, evidenceId, SESSION_STATUS.NEEDS_ATTENTION, {
        localPath: saved.uri,
      });
      return fail('SAVE_FAILED');
    }
    const hashed = await hash(saved.uri);
    if (!hashed.ok) {
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
      await markFailed(ports, session, evidenceId, SESSION_STATUS.NEEDS_ATTENTION, {
        localPath: saved.uri,
      });
      return fail('SAVE_FAILED');
    }
    await orders.updateSessionStatus(shopId, session.id, SESSION_STATUS.ENDED);
    return { kind: 'saved', evidenceId };
  } catch {
    // Lỗi kho cục bộ giữa chừng: cố ghi lỗi (kèm đường dẫn bền nếu đã chuyển tệp); không được thì lần
    // mở app sau khôi phục theo trạng thái tệp và thư mục bền.
    await markFailed(
      ports,
      session,
      evidenceId,
      SESSION_STATUS.NEEDS_ATTENTION,
      savedUri ? { localPath: savedUri } : undefined,
    );
    return fail('SAVE_FAILED');
  }
}

/** Đường dẫn của tệp bền: `evidence/...` tương đối, hoặc tuyệt đối chứa `/evidence/` (dữ liệu cũ). */
export const isPersistentPath = (path: string): boolean => /(^|\/)evidence\//.test(path);

export interface RecoveryPorts extends Pick<
  RecordingPorts,
  'files' | 'orders' | 'persist' | 'hash' | 'now'
> {
  /** Đường dẫn đã lưu (tương đối hoặc tuyệt đối) còn tệp không. */
  readonly exists: (localPath: string) => boolean;
  /** Tệp bền theo ID bằng chứng (`evidence/<id>.<đuôi>`) nếu có, bất kể CSDL ghi đường dẫn nào. */
  readonly findPersisted: (evidenceId: string) => string | null;
}

export interface RecoveryResult {
  /** Số lần quay dở dang (đang ghi/đang lưu) bị app đóng giữa chừng; phiên của chúng thành `interrupted`. */
  readonly interrupted: number;
  /** Trong số đó, số tệp không còn bản nào (`unrecoverable`). */
  readonly lost: number;
}

type RecoveryStep = 'queued' | 'kept' | 'lost';

const markUnrecoverable = (
  ports: RecoveryPorts,
  shopId: PackingSession['shopId'],
  id: EvidenceId,
) =>
  ports.files.applyEvent(shopId, id, { type: 'MARK_UNRECOVERABLE', origin: 'device' }, ports.now());

/**
 * Hoàn tất lưu cục bộ cho một tệp còn tồn tại (đang `saving_local`): chuyển nếu còn ở thư mục tạm,
 * ghi đường dẫn mới, băm, đưa vào hàng đợi. CHỈ `lost` khi tệp thật sự không còn (không tồn tại ở
 * đường dẫn nào); lỗi tạm thời (máy đầy, đọc lỗi, kho lỗi) thì giữ ở `local_save_failed` với đường
 * dẫn thật để thử lại ở lần mở app sau, KHÔNG đánh dấu mất.
 */
async function completeLocalSave(
  ports: RecoveryPorts,
  shopId: PackingSession['shopId'],
  file: EvidenceFile,
  location: { readonly path: string; readonly durable: boolean },
): Promise<RecoveryStep> {
  const { files, persist, hash, now, exists } = ports;
  let path = location.path;
  const keepSafe = async (): Promise<RecoveryStep> => {
    await files.applyEvent(shopId, file.id, device('LOCAL_WRITE_FAILED'), now(), {
      localPath: path,
    });
    return 'kept';
  };
  const lose = async (): Promise<RecoveryStep> => {
    await markUnrecoverable(ports, shopId, file.id);
    return 'lost';
  };
  try {
    if (!location.durable) {
      const saved = persist(path, file.id, extensionOf(path));
      if (!saved.ok) {
        return saved.reason === 'FILE_MISSING' && !exists(path) ? await lose() : await keepSafe();
      }
      path = saved.uri;
      const moved = await files.applyEvent(shopId, file.id, device('LOCAL_FILE_MOVED'), now(), {
        localPath: path,
      });
      if (!moved.ok) return await keepSafe();
    }
    const hashed = await hash(path);
    if (!hashed.ok) {
      return hashed.reason === 'FILE_MISSING' && !exists(path) ? await lose() : await keepSafe();
    }
    const queued = await files.applyEvent(shopId, file.id, device('LOCAL_FILE_READABLE'), now(), {
      localPath: path,
      sizeBytes: hashed.sizeBytes,
      sha256Client: hashed.sha256,
    });
    return queued.ok ? 'queued' : await keepSafe();
  } catch {
    // Lỗi kho cục bộ: không đổi gì, tệp vẫn ở trạng thái hiện tại và được thử lại lần mở app sau.
    return 'kept';
  }
}

/**
 * Phục hồi sau khi app bị đóng/kill giữa chừng (A05: không tự nhận là video đầy đủ). Chạy lúc mở app:
 * - `recording`: KHÔNG biết tệp tạm ở đâu (`expo-camera` tự đặt tên trong thư mục tạm, ta chưa có đường
 *   dẫn; quét thư mục tạm rồi đoán tệp thuộc phiên nào là tự liên kết, vi phạm bất biến 5, và tệp ghi dở
 *   thường không phát được) -> `unrecoverable`, phiên `interrupted`: ghi nhận thiếu, không dựng video
 *   giả (bất biến 6). Tệp tạm nếu còn trên đĩa KHÔNG bị xóa.
 * - `saving_local`: tìm tệp ở thư mục bền theo ID bằng chứng và ở đường dẫn đã ghi. Còn tệp thì chuyển
 *   (nếu cần), băm, đưa vào hàng đợi; chỉ khi KHÔNG còn tệp nào mới `unrecoverable`. Lỗi tạm thời thì giữ
 *   `local_save_failed` kèm đường dẫn thật.
 * - `local_save_failed` còn đường dẫn tệp: thử lại cùng quy trình (không đổi trạng thái phiên).
 * Phiên của tệp dở dang luôn `interrupted` dù cứu được tệp (có thể thiếu phần cuối). Không ném lỗi.
 */
export async function recoverInterruptedRecordings(
  ports: RecoveryPorts,
  shopId: PackingSession['shopId'],
): Promise<RecoveryResult> {
  const { files, orders, now, exists, findPersisted } = ports;
  let interrupted = 0;
  let lost = 0;
  try {
    for (const file of await files.listByStates(shopId, [
      'recording',
      'saving_local',
      'local_save_failed',
    ])) {
      const wasInterrupted = file.state !== 'local_save_failed';
      if (file.state === 'local_save_failed' && !file.localPath) continue; // lỗi trước khi có tệp
      let step: RecoveryStep;
      if (file.state === 'recording') {
        await markUnrecoverable(ports, shopId, file.id);
        step = 'lost';
      } else {
        const durable = findPersisted(file.id);
        const recorded = file.localPath && exists(file.localPath) ? file.localPath : null;
        const location = durable
          ? { path: durable, durable: true }
          : recorded
            ? { path: recorded, durable: isPersistentPath(recorded) }
            : null;
        if (!location) {
          await markUnrecoverable(ports, shopId, file.id);
          step = 'lost';
        } else {
          if (file.state === 'local_save_failed') {
            const retry = await files.applyEvent(
              shopId,
              file.id,
              device('RETRY_LOCAL_SAVE'),
              now(),
            );
            if (!retry.ok) continue;
          }
          step = await completeLocalSave(ports, shopId, file, location);
        }
      }
      if (!wasInterrupted) continue;
      interrupted += 1;
      if (step === 'lost') lost += 1;
      // Phiên bị gián đoạn: dù cứu được tệp, video có thể thiếu phần cuối nên không tự nhận là đầy đủ.
      await orders
        .updateSessionStatus(shopId, file.sessionId, SESSION_STATUS.INTERRUPTED)
        .catch(() => undefined);
    }
  } catch {
    // lỗi kho cục bộ: dừng, lần mở app sau chạy lại
  }
  return { interrupted, lost };
}
