import type { ReturnCaseId, ShopId } from '@/core/ids';
import type { FileEvent, FileEventType } from '@/features/evidence';

import { isMediaSavedLocally, type ReturnMedia } from './media';
import type { ReturnStore } from './return-store';
import type { OpeningVideo } from './types';

/** Kết quả ghi do bộ ghi (camera) trả về khi dừng: tệp nằm ở thư mục TẠM của hệ điều hành. */
export type VideoRecordResult =
  | { readonly ok: true; readonly tempUri: string }
  | { readonly ok: false; readonly reason: 'RECORDER_FAILED' };

export interface VideoRecordingHandle {
  /** Hoàn tất khi dừng (người dùng hoặc lỗi). */
  readonly done: Promise<VideoRecordResult>;
  stop(): void;
}

/** Cùng hình dạng với bộ ghi của luồng đóng gói (`platform/camera-recorder`). */
export interface VideoRecorder {
  /** Ném lỗi (đồng bộ hoặc bất đồng bộ) nếu camera không bắt đầu được. */
  record(options?: { readonly maxDurationSec?: number }): VideoRecordingHandle;
}

export type VideoPersistOutcome =
  | { readonly ok: true; readonly uri: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'STORAGE_FULL' | 'FAILED' };

export type VideoHashOutcome =
  | { readonly ok: true; readonly sha256: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

export interface VideoPorts {
  readonly store: Pick<
    ReturnStore,
    'getReturn' | 'listMedia' | 'createMedia' | 'applyMediaEvent' | 'saveOpeningVideoRecorded'
  >;
  readonly recorder: VideoRecorder;
  /** Chuyển tệp tạm vào thư mục bền (không sao chép); `uri` là đường dẫn tương đối để lưu. */
  persist(tempUri: string, mediaId: string, extension: string): VideoPersistOutcome;
  hash(localPath: string): Promise<VideoHashOutcome>;
  /** Giờ THIẾT BỊ (ms). */
  now(): number;
  newId(): string;
  /** Dung lượng trống (byte) nếu đọc được; `null` = không biết (không chặn quay). Bỏ qua = không kiểm. */
  availableBytes?(): number | null;
  /** Dung lượng trống tối thiểu để cho bắt đầu quay (theo chính sách thời lượng tối đa, O-05). */
  readonly minFreeBytes: number;
  /** Giới hạn thời lượng một lần quay (giây); camera tự dừng và trả tệp hợp lệ khi tới hạn. */
  readonly maxDurationSec?: number;
}

/** Vì sao KHÔNG bắt đầu quay (chưa tạo bản ghi nào, trừ `LOCAL_STORE`/`RECORDER_FAILED`). */
export type VideoStartFailure =
  /** Hồ sơ không có (hoặc ở shop khác) hoặc chưa/không còn ở bước mở kiện (chưa ghi tình trạng bên ngoài, đã xác nhận). */
  | 'NOT_READY'
  /** Hồ sơ đã có video hoặc đã ghi "không có video": không quay thêm/thay thế (bất biến 4, 6). */
  | 'ALREADY_RECORDED'
  /** Đã từng có một lần quay cho hồ sơ này (kể cả lưu lỗi): kiện có thể đã mở, không "quay bù" (bất biến 6). */
  | 'ATTEMPTED'
  | 'INSUFFICIENT_STORAGE'
  | 'LOCAL_STORE'
  | 'RECORDER_FAILED';

export type VideoFailure = 'RECORDER_FAILED' | 'STORAGE_FULL' | 'SAVE_FAILED' | 'FILE_UNREADABLE';

export type VideoOutcome =
  | {
      readonly kind: 'saved';
      readonly mediaId: string;
      /**
       * Hồ sơ đã ghi nhận video này chưa. `false`: video ĐÃ an toàn trong hàng đợi nhưng chưa ghi được vào
       * hồ sơ (lỗi kho); bên gọi thử lại bằng `saveOpeningVideoRecorded`, không được báo "chưa lưu video".
       */
      readonly recordedInCase: boolean;
    }
  | { readonly kind: 'failed'; readonly mediaId: string | null; readonly reason: VideoFailure };

export interface ActiveVideo {
  readonly mediaId: string;
  stop(): void;
  /** Luôn hoàn tất, không ném lỗi. */
  readonly result: Promise<VideoOutcome>;
}

const device = (type: FileEventType): FileEvent => ({ type, origin: 'device' });

const extensionOf = (uri: string): string => {
  const match = /\.([A-Za-z0-9]{2,5})(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'mp4';
};

/**
 * Điều phối MỘT lần quay video mở kiện (docs/05 B04-B05), theo khuôn `recording-controller` của luồng
 * đóng gói (ADR-020):
 * 0. Kiểm hồ sơ: đúng shop, đang ở bước mở kiện, chưa có video/lần quay nào (không quay bù, không thay
 *    thế: bất biến 4, 6). Dung lượng trống dưới ngưỡng thì từ chối (A04). Chưa tạo gì.
 * 1. Bản ghi media (`recording`, gắn sẵn với hồ sơ) được tạo TRƯỚC khi mở camera (bất biến 2).
 * 2. Dừng: `STOP_RECORDING` (ghi đường dẫn tạm) -> chuyển vào thư mục bền -> `LOCAL_FILE_MOVED` (ghi NGAY
 *    đường dẫn mới, TRƯỚC khi băm vì băm JS có thể rất lâu) -> băm -> `LOCAL_FILE_READABLE` (`queued`).
 *    Tới đây video mới "đã lưu trên máy" và mới được ghi vào hồ sơ (`saveOpeningVideoRecorded`).
 * 3. Lỗi ở bất kỳ bước nào ghi `LOCAL_WRITE_FAILED` kèm đường dẫn thật đang giữ tệp; KHÔNG xóa tệp tạm hay
 *    tệp đã chuyển (có thể là bản duy nhất); KHÔNG ghi vào hồ sơ là đã có video.
 * Không bao giờ ném lỗi ra ngoài; không thu tiếng (O-09 chưa quyết, do bộ ghi). Chưa chạy trên thiết bị.
 */
export async function startOpeningVideo(
  ports: VideoPorts,
  target: { readonly shopId: ShopId; readonly returnId: ReturnCaseId },
): Promise<ActiveVideo | { readonly kind: 'failed'; readonly reason: VideoStartFailure }> {
  const { store, recorder, newId, now } = ports;
  const { shopId, returnId } = target;
  let mediaId: string;
  try {
    const details = await store.getReturn(shopId, returnId);
    const status = details?.returnCase.status;
    if (!details || (status !== 'opening' && status !== 'checking')) {
      return { kind: 'failed', reason: 'NOT_READY' };
    }
    if (details.returnCase.openingVideo !== null) {
      return { kind: 'failed', reason: 'ALREADY_RECORDED' };
    }
    const existing = await store.listMedia(shopId, returnId);
    if (existing.some((m) => m.kind === 'video')) return { kind: 'failed', reason: 'ATTEMPTED' };
  } catch {
    return { kind: 'failed', reason: 'LOCAL_STORE' };
  }
  // A04: kiểm dung lượng TRƯỚC khi tạo bất cứ thứ gì, để không có bản ghi `recording` mồ côi.
  const free = ports.availableBytes?.() ?? null;
  if (free !== null && free < ports.minFreeBytes) {
    return { kind: 'failed', reason: 'INSUFFICIENT_STORAGE' };
  }
  try {
    mediaId = newId();
    await store.createMedia({ id: mediaId, shopId, returnId, kind: 'video', atDevice: now() });
  } catch {
    return { kind: 'failed', reason: 'LOCAL_STORE' };
  }

  let handle: VideoRecordingHandle;
  try {
    handle = recorder.record(
      ports.maxDurationSec !== undefined ? { maxDurationSec: ports.maxDurationSec } : undefined,
    );
  } catch {
    await markFailed(ports, shopId, mediaId);
    return { kind: 'failed', reason: 'RECORDER_FAILED' };
  }
  const result = handle.done.then(
    (recorded) => finish(ports, { shopId, returnId, mediaId }, recorded),
    () => finish(ports, { shopId, returnId, mediaId }, { ok: false, reason: 'RECORDER_FAILED' }),
  );
  return { mediaId, stop: () => handle.stop(), result };
}

async function markFailed(
  ports: VideoPorts,
  shopId: ShopId,
  mediaId: string,
  localPath?: string,
): Promise<void> {
  try {
    await ports.store.applyMediaEvent(
      shopId,
      mediaId,
      device('LOCAL_WRITE_FAILED'),
      ports.now(),
      localPath ? { localPath } : undefined,
    );
  } catch {
    // trạng thái giữ nguyên ở `recording`/`saving_local`; lần mở app sau khôi phục theo thư mục bền
  }
}

async function finish(
  ports: VideoPorts,
  target: { shopId: ShopId; returnId: ReturnCaseId; mediaId: string },
  recorded: VideoRecordResult,
): Promise<VideoOutcome> {
  const { store, persist, hash, now, newId } = ports;
  const { shopId, returnId, mediaId } = target;
  const fail = (reason: VideoFailure): VideoOutcome => ({ kind: 'failed', mediaId, reason });
  /** Đường dẫn bền sau khi chuyển tệp; có giá trị thì mọi lỗi về sau phải giữ nó. */
  let savedUri: string | null = null;
  try {
    if (!recorded.ok) {
      await markFailed(ports, shopId, mediaId);
      return fail('RECORDER_FAILED');
    }
    const stopped = await store.applyMediaEvent(shopId, mediaId, device('STOP_RECORDING'), now(), {
      localPath: recorded.tempUri,
    });
    if (!stopped.ok) return fail('SAVE_FAILED');

    const saved = persist(recorded.tempUri, mediaId, extensionOf(recorded.tempUri));
    if (!saved.ok) {
      await markFailed(ports, shopId, mediaId, recorded.tempUri);
      return fail(saved.reason === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'SAVE_FAILED');
    }
    savedUri = saved.uri;
    // Ghi đường dẫn MỚI ngay, trước khi băm: app bị kill lúc băm không được mất dấu bản gốc.
    const moved = await store.applyMediaEvent(shopId, mediaId, device('LOCAL_FILE_MOVED'), now(), {
      localPath: saved.uri,
    });
    if (!moved.ok) {
      await markFailed(ports, shopId, mediaId, saved.uri);
      return fail('SAVE_FAILED');
    }
    const hashed = await hash(saved.uri);
    if (!hashed.ok) {
      await markFailed(ports, shopId, mediaId, saved.uri);
      return fail('FILE_UNREADABLE');
    }
    const queued = await store.applyMediaEvent(
      shopId,
      mediaId,
      device('LOCAL_FILE_READABLE'),
      now(),
      { localPath: saved.uri, sizeBytes: hashed.sizeBytes, sha256Client: hashed.sha256 },
    );
    if (!queued.ok) {
      await markFailed(ports, shopId, mediaId, saved.uri);
      return fail('SAVE_FAILED');
    }
    // Từ đây video ĐÃ an toàn trong hàng đợi: ghi vào hồ sơ chỉ là cố gắng. Lỗi ở đây KHÔNG được làm UI
    // báo "chưa lưu được video"; màn mở lại sẽ đối chiếu (video đã lưu mà hồ sơ chưa ghi nhận).
    const recordedInCase = await store
      .saveOpeningVideoRecorded(shopId, returnId, {
        mediaId,
        interrupted: false,
        atDevice: now(),
        eventId: newId(),
      })
      .then(
        () => true,
        () => false, // lỗi kho hoặc hồ sơ đã có kết luận khác (hiếm): video vẫn nằm trong hàng đợi
      );
    return { kind: 'saved', mediaId, recordedInCase };
  } catch {
    // Lỗi kho cục bộ giữa chừng: cố ghi lỗi (kèm đường dẫn bền nếu đã chuyển tệp).
    await markFailed(ports, shopId, mediaId, savedUri ?? undefined);
    return fail('SAVE_FAILED');
  }
}

/** Video đã lưu bền của hồ sơ mà hồ sơ chưa ghi nhận (lần ghi vào hồ sơ trước đó lỗi); `null` nếu không có. */
export function findUnrecordedVideo(
  openingVideo: OpeningVideo,
  media: readonly ReturnMedia[],
): ReturnMedia | null {
  if (openingVideo !== null) return null;
  return media.find((m) => m.kind === 'video' && isMediaSavedLocally(m)) ?? null;
}
