import { isAppError } from '@/core/errors/app-error';
import type { ReturnCaseId, ShopId } from '@/core/ids';
import type { FileEvent, FileEventType } from '@/features/evidence';

import {
  isMediaSavedLocally,
  MAX_RETURN_PHOTOS,
  type LocationStatus,
  type MediaLocation,
  type ReturnMedia,
} from './media';
import type { ReturnStore } from './return-store';

/** Kết quả chụp do camera trả về: tệp nằm ở thư mục TẠM của hệ điều hành. */
export type CaptureOutcome =
  | { readonly ok: true; readonly tempUri: string }
  | { readonly ok: false; readonly reason: 'CAPTURE_FAILED' };

export type PersistOutcome =
  | { readonly ok: true; readonly uri: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'STORAGE_FULL' | 'FAILED' };

export type HashOutcome =
  | { readonly ok: true; readonly sha256: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

/** Kết quả đọc vị trí thiết bị (best-effort, không bao giờ chặn việc lưu ảnh). */
export type LocateOutcome =
  | {
      readonly ok: true;
      readonly lat: number;
      readonly lng: number;
      readonly accuracyM: number | null;
      readonly atDevice: number;
    }
  | { readonly ok: false; readonly status: Exclude<LocationStatus, 'ok'> };

export interface PhotoPorts {
  readonly store: Pick<
    ReturnStore,
    'createMedia' | 'applyMediaEvent' | 'listMedia' | 'setMediaLocation'
  >;
  /**
   * Đọc vị trí thiết bị (có giới hạn thời gian ngắn ở adapter). Bỏ qua = không ghi vị trí. Được gọi
   * song song với việc chụp/lưu, KHÔNG làm chậm hay làm hỏng việc lưu ảnh; có thể ném lỗi (coi là `unavailable`).
   */
  locate?(): Promise<LocateOutcome>;
  /** Chụp một ảnh; có thể ném lỗi hoặc trả `ok: false` nếu camera không chụp được. */
  capture(): Promise<CaptureOutcome>;
  /** Chuyển tệp tạm vào thư mục bền (không sao chép); `uri` là đường dẫn tương đối để lưu. */
  persist(tempUri: string, mediaId: string, extension: string): PersistOutcome;
  hash(localPath: string): Promise<HashOutcome>;
  /** Giờ THIẾT BỊ (ms). */
  now(): number;
  newId(): string;
}

export type PhotoFailure =
  | 'LIMIT_REACHED'
  | 'ALREADY_CONFIRMED'
  | 'CAPTURE_FAILED'
  | 'STORAGE_FULL'
  | 'FILE_UNREADABLE'
  | 'SAVE_FAILED';

export type PhotoOutcome =
  | { readonly kind: 'saved'; readonly media: ReturnMedia }
  | { readonly kind: 'failed'; readonly mediaId: string | null; readonly reason: PhotoFailure };

/** Chạy `locate` và luôn trả một `MediaLocation` (lỗi -> `unavailable`), không bao giờ ném lỗi. */
function startLocate(locate: NonNullable<PhotoPorts['locate']>): Promise<MediaLocation> {
  const none = (status: Exclude<LocationStatus, 'ok'>): MediaLocation => ({
    status,
    lat: null,
    lng: null,
    accuracyM: null,
    atDevice: null,
  });
  return locate().then(
    (result): MediaLocation =>
      result.ok
        ? {
            status: 'ok',
            lat: result.lat,
            lng: result.lng,
            accuracyM: result.accuracyM,
            atDevice: result.atDevice,
          }
        : none(result.status),
    () => none('unavailable'),
  );
}

const device = (type: FileEventType): FileEvent => ({ type, origin: 'device' });

/**
 * Điều phối MỘT lần chụp ảnh hàng hoàn, theo khuôn `recording-controller` của luồng đóng gói:
 * 1. Tạo bản ghi ảnh (`recording`) TRƯỚC khi chụp, gắn sẵn với hồ sơ (bất biến 2).
 * 2. Chụp -> `STOP_RECORDING` (ghi đường dẫn tạm) -> chuyển tệp vào thư mục bền -> `LOCAL_FILE_MOVED`
 *    (ghi ngay đường dẫn mới, trước khi băm) -> băm -> `LOCAL_FILE_READABLE` (`queued`).
 * Lỗi ở bất kỳ bước nào ghi `LOCAL_WRITE_FAILED` kèm đường dẫn đã biết; KHÔNG xóa tệp tạm hay tệp đã
 * chuyển (bản gốc bất biến, bất biến 4). Không bao giờ ném lỗi. `saved` chỉ trả khi tệp đã đóng,
 * đọc được và có mã băm; ảnh dừng ở `queued` ("đã lưu trên máy"), chưa có đường tải lên. Mã băm chỉ
 * chứng minh tệp không đổi kể từ lúc tính, không chứng minh thời điểm chụp (CLAUDE.md #11).
 */
export async function capturePhoto(
  ports: PhotoPorts,
  target: { readonly shopId: ShopId; readonly returnId: ReturnCaseId },
): Promise<PhotoOutcome> {
  const { store, capture, persist, hash, now, newId, locate } = ports;
  const { shopId, returnId } = target;
  let mediaId: string | null = null;
  /** Đường dẫn tốt nhất đã biết (tạm rồi bền): mọi lỗi về sau phải giữ nó. */
  let knownPath: string | null = null;
  const fail = (reason: PhotoFailure): PhotoOutcome => ({ kind: 'failed', mediaId, reason });
  const markFailed = async (): Promise<void> => {
    if (mediaId === null) return;
    try {
      await store.applyMediaEvent(
        shopId,
        mediaId,
        device('LOCAL_WRITE_FAILED'),
        now(),
        knownPath ? { localPath: knownPath } : undefined,
      );
    } catch {
      // trạng thái giữ nguyên ở `recording`/`saving_local`; người dùng thấy "chưa lưu xong"
    }
  };

  try {
    const existing = await store.listMedia(shopId, returnId);
    if (
      existing.filter((m) => m.kind === 'photo' && isMediaSavedLocally(m)).length >=
      MAX_RETURN_PHOTOS
    ) {
      return fail('LIMIT_REACHED');
    }
    const id = newId();
    try {
      await store.createMedia({ id, shopId, returnId, kind: 'photo', atDevice: now() });
    } catch (error) {
      return fail(
        isAppError(error) && error.code === 'RETURN_ALREADY_CONFIRMED'
          ? 'ALREADY_CONFIRMED'
          : 'SAVE_FAILED',
      );
    }
    mediaId = id;

    // Vị trí đọc song song, bắt đầu ngay trước khi chụp để gần đúng lúc chụp nhất; chỉ nhận kết quả
    // SAU KHI ảnh đã lưu xong (best-effort, không chặn việc lưu).
    const locating = locate ? startLocate(locate) : null;
    let captured: CaptureOutcome;
    try {
      captured = await capture();
    } catch {
      captured = { ok: false, reason: 'CAPTURE_FAILED' };
    }
    if (!captured.ok) {
      await markFailed();
      return fail('CAPTURE_FAILED');
    }
    knownPath = captured.tempUri;
    const stopped = await store.applyMediaEvent(shopId, id, device('STOP_RECORDING'), now(), {
      localPath: captured.tempUri,
    });
    if (!stopped.ok) {
      await markFailed();
      return fail('SAVE_FAILED');
    }

    const saved = persist(captured.tempUri, id, 'jpg');
    if (!saved.ok) {
      await markFailed();
      return fail(saved.reason === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'SAVE_FAILED');
    }
    knownPath = saved.uri;
    const moved = await store.applyMediaEvent(shopId, id, device('LOCAL_FILE_MOVED'), now(), {
      localPath: saved.uri,
    });
    if (!moved.ok) {
      await markFailed();
      return fail('SAVE_FAILED');
    }

    const hashed = await hash(saved.uri);
    if (!hashed.ok) {
      await markFailed();
      return fail('FILE_UNREADABLE');
    }
    const queued = await store.applyMediaEvent(shopId, id, device('LOCAL_FILE_READABLE'), now(), {
      localPath: saved.uri,
      sizeBytes: hashed.sizeBytes,
      sha256Client: hashed.sha256,
    });
    if (!queued.ok) {
      await markFailed();
      return fail('SAVE_FAILED');
    }
    const located = locating
      ? await store.setMediaLocation(shopId, id, await locating).catch(() => null)
      : null;
    return { kind: 'saved', media: located?.ok ? located.media : queued.media };
  } catch {
    await markFailed();
    return fail('SAVE_FAILED');
  }
}
