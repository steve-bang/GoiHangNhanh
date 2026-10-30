import type { ShopId } from '@/core/ids';
import type { FileEvent, FileEventType } from '@/features/evidence';

import type { ReturnMedia } from './media';
import type { ReturnStore } from './return-store';

export interface MediaRecoveryPorts {
  readonly store: Pick<
    ReturnStore,
    'listUnfinishedMedia' | 'applyMediaEvent' | 'getReturn' | 'saveOpeningVideoRecorded'
  >;
  /** Chuyển tệp tạm vào thư mục bền (không sao chép). */
  persist(
    tempUri: string,
    mediaId: string,
    extension: string,
  ):
    | { readonly ok: true; readonly uri: string; readonly sizeBytes: number }
    | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'STORAGE_FULL' | 'FAILED' };
  hash(
    localPath: string,
  ): Promise<
    | { readonly ok: true; readonly sha256: string; readonly sizeBytes: number }
    | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' }
  >;
  /** Đường dẫn đã lưu (tương đối hoặc tuyệt đối) còn tệp không. */
  exists(localPath: string): boolean;
  /** Tệp bền theo ID media (`evidence/<id>.<đuôi>`) nếu có, bất kể CSDL ghi đường dẫn nào. */
  findPersisted(mediaId: string): string | null;
  now(): number;
  newId(): string;
}

export interface MediaRecoveryResult {
  /** Số media dở dang bị app đóng giữa chừng (đang ghi/đang lưu). */
  readonly interrupted: number;
  /** Trong số đó, số không còn bản nào (`unrecoverable`). */
  readonly lost: number;
  /** Số media cứu được (đã vào hàng đợi). */
  readonly rescued: number;
  /** `true` nếu kho cục bộ lỗi giữa chừng nên có thể còn media chưa xử lý: bên gọi nên thử lại sau. */
  readonly storeFailed: boolean;
}

const device = (type: FileEventType): FileEvent => ({ type, origin: 'device' });

const extensionOf = (uri: string, fallback: string): string => {
  const match = /\.([A-Za-z0-9]{2,5})(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() ?? fallback;
};

const isPersistentPath = (path: string): boolean => /(^|\/)evidence\//.test(path);

type Step = 'queued' | 'kept' | 'lost';

/**
 * Hoàn tất lưu cục bộ cho một media còn tệp: chuyển nếu còn ở thư mục tạm, ghi đường dẫn mới, băm, đưa
 * vào hàng đợi. CHỈ `lost` khi tệp thật sự không còn; lỗi tạm thời (máy đầy, đọc lỗi, kho lỗi) thì giữ ở
 * `local_save_failed` kèm đường dẫn thật để thử lại lần mở app sau, KHÔNG đánh dấu mất.
 */
async function completeLocalSave(
  ports: MediaRecoveryPorts,
  media: ReturnMedia,
  location: { readonly path: string; readonly durable: boolean },
): Promise<Step> {
  const { store, persist, hash, now, exists } = ports;
  const { shopId, id } = media;
  let path = location.path;
  const keepSafe = async (): Promise<Step> => {
    await store.applyMediaEvent(shopId, id, device('LOCAL_WRITE_FAILED'), now(), {
      localPath: path,
    });
    return 'kept';
  };
  const lose = async (): Promise<Step> => {
    await store.applyMediaEvent(shopId, id, device('MARK_UNRECOVERABLE'), now());
    return 'lost';
  };
  try {
    if (!location.durable) {
      const saved = persist(path, id, extensionOf(path, media.kind === 'video' ? 'mp4' : 'jpg'));
      if (!saved.ok) {
        return saved.reason === 'FILE_MISSING' && !exists(path) ? await lose() : await keepSafe();
      }
      path = saved.uri;
      const moved = await store.applyMediaEvent(shopId, id, device('LOCAL_FILE_MOVED'), now(), {
        localPath: path,
      });
      if (!moved.ok) return await keepSafe();
    }
    const hashed = await hash(path);
    if (!hashed.ok) {
      return hashed.reason === 'FILE_MISSING' && !exists(path) ? await lose() : await keepSafe();
    }
    const queued = await store.applyMediaEvent(shopId, id, device('LOCAL_FILE_READABLE'), now(), {
      localPath: path,
      sizeBytes: hashed.sizeBytes,
      sha256Client: hashed.sha256,
    });
    return queued.ok ? 'queued' : await keepSafe();
  } catch {
    return 'kept'; // lỗi kho cục bộ: không đổi gì, thử lại lần mở app sau
  }
}

/**
 * Khôi phục sau khi app bị đóng/kill giữa lúc chụp/quay/lưu media hàng hoàn (ảnh và video; trả nợ hạn chế
 * R2a "ảnh dở dang chưa khôi phục"). Chỉ xử lý media tạo TRƯỚC `startedBefore` (tàn dư của lần chạy
 * trước); media của lần chạy này (đang chụp/quay/lưu) không bao giờ bị đụng:
 * - `recording`: KHÔNG biết tệp tạm ở đâu (camera tự đặt tên) và đoán tệp là tự liên kết (bất biến 5) ->
 *   `unrecoverable`; ghi nhận thiếu, không dựng video giả (bất biến 6). Tệp tạm nếu còn KHÔNG bị xóa.
 * - `saving_local`: tìm tệp ở thư mục bền theo ID và ở đường dẫn đã ghi. Còn tệp thì chuyển, băm, đưa vào
 *   hàng đợi; chỉ khi KHÔNG còn tệp nào mới `unrecoverable`. Lỗi tạm thì giữ `local_save_failed`.
 * - `local_save_failed` còn đường dẫn: thử lại cùng quy trình.
 * Video cứu được từ `saving_local` mà hồ sơ chưa có kết luận về video thì ghi vào hồ sơ là GIÁN ĐOẠN
 * (A05: không tự nhận là đầy đủ); video cứu từ `local_save_failed` ghi là đầy đủ TRỪ KHI bản ghi mang cờ
 * gián đoạn bền (`ReturnMedia.interrupted`, V1-13: vào nền/camera ngắt sớm rồi lưu lỗi). Ảnh không ảnh hưởng hồ sơ. Không bao giờ xóa tệp. Không ném lỗi (lỗi kho báo qua `storeFailed`).
 */
export async function recoverInterruptedMedia(
  ports: MediaRecoveryPorts,
  startedBefore: number,
): Promise<MediaRecoveryResult> {
  const { store, now, exists, findPersisted, newId } = ports;
  let interrupted = 0;
  let lost = 0;
  let rescued = 0;
  let storeFailed = false;
  try {
    for (const listed of await store.listUnfinishedMedia()) {
      if (listed.createdAtDevice >= startedBefore) continue;
      const media = listed;
      if (media.state === 'local_save_failed' && !media.localPath) continue; // lỗi trước khi có tệp
      const wasInterrupted = media.state !== 'local_save_failed';
      let step: Step;
      if (media.state === 'recording') {
        await store.applyMediaEvent(media.shopId, media.id, device('MARK_UNRECOVERABLE'), now());
        step = 'lost';
      } else {
        const durable = findPersisted(media.id);
        const recorded = media.localPath && exists(media.localPath) ? media.localPath : null;
        const location = durable
          ? { path: durable, durable: true }
          : recorded
            ? { path: recorded, durable: isPersistentPath(recorded) }
            : null;
        if (!location) {
          await store.applyMediaEvent(media.shopId, media.id, device('MARK_UNRECOVERABLE'), now());
          step = 'lost';
        } else {
          if (media.state === 'local_save_failed') {
            const retry = await store.applyMediaEvent(
              media.shopId,
              media.id,
              device('RETRY_LOCAL_SAVE'),
              now(),
            );
            if (!retry.ok) continue;
          }
          step = await completeLocalSave(ports, media, location);
        }
      }
      if (wasInterrupted) interrupted += 1;
      if (step === 'lost') lost += 1;
      if (step !== 'queued') continue;
      rescued += 1;
      if (media.kind === 'video') {
        // Video đã an toàn trong hàng đợi: ghi vào hồ sơ nếu hồ sơ chưa có kết luận (cố gắng, bỏ qua lỗi).
        // Gián đoạn = bị app đóng giữa chừng HOẶC cờ bền màn quay đã ghi (vào nền/camera ngắt sớm, rồi lưu
        // lỗi; V1-13): không bao giờ đoán `false` cho video đã đánh dấu.
        const interruptedVideo = wasInterrupted || media.interrupted === true;
        await recordRescuedVideo(ports, media.shopId, media, interruptedVideo, newId());
      }
    }
  } catch {
    // lỗi kho cục bộ: dừng; bên gọi thử lại có giới hạn, hết lượt thì lần mở app sau chạy lại
    storeFailed = true;
  }
  return { interrupted, lost, rescued, storeFailed };
}

async function recordRescuedVideo(
  ports: MediaRecoveryPorts,
  shopId: ShopId,
  media: ReturnMedia,
  interrupted: boolean,
  eventId: string,
): Promise<void> {
  try {
    const details = await ports.store.getReturn(shopId, media.returnId);
    if (!details || details.returnCase.openingVideo !== null) return;
    await ports.store.saveOpeningVideoRecorded(shopId, media.returnId, {
      mediaId: media.id,
      interrupted,
      atDevice: ports.now(),
      eventId,
    });
  } catch {
    // hồ sơ chưa ở bước mở kiện hoặc lỗi kho: video vẫn nằm trong hàng đợi; màn D04 đối chiếu khi mở
  }
}
