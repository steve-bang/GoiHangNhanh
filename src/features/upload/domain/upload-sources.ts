import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId } from '@/core/ids';
import type { EvidenceFile, EvidenceFileStore } from '@/features/evidence';
import type { OrderStore } from '@/features/orders';
import type { ReturnMedia, ReturnStore } from '@/features/returns';

import type { UploadItem, UploadSource } from './ports';

const fromEvidenceFile = (f: EvidenceFile): UploadItem => ({
  id: f.id,
  shopId: f.shopId,
  owner: {
    kind: 'packing',
    orderId: f.orderId as OrderId,
    sessionId: f.sessionId as SessionId,
    packageId: f.packageId as PackageId,
  },
  kind: f.kind,
  state: f.state,
  localPath: f.localPath,
  sizeBytes: f.sizeBytes,
  durationMs: f.durationMs,
  sha256Client: f.sha256Client,
  attemptCount: f.attemptCount,
  nextAttemptAtDevice: f.nextAttemptAtDevice,
  lastErrorCode: f.lastErrorCode,
  createdAtDevice: f.createdAtDevice,
});

/**
 * Nguồn tệp bằng chứng ĐÓNG GÓI (`EvidenceFileStore`). Có `sessions` thì chỉ khai báo tệp của phiên đã
 * đăng lên máy chủ (Rules cần phiên tồn tại): phiên chưa đăng thì tệp chờ ở `queued`, không gọi máy chủ,
 * không tốn lượt (V1-02). Không có `sessions` (test cũ) = luôn sẵn sàng.
 */
export function evidenceFileSource(
  files: EvidenceFileStore,
  sessions?: Pick<OrderStore, 'isSessionPublished'>,
): UploadSource {
  return {
    ...(sessions
      ? {
          isReadyToDeclare: (item: UploadItem) =>
            item.owner.kind === 'packing'
              ? sessions.isSessionPublished(item.shopId, item.owner.sessionId)
              : Promise.resolve(false),
        }
      : {}),
    async listByStates(shopId, states) {
      return (await files.listByStates(shopId, states)).map(fromEvidenceFile);
    },
    async applyEvent(shopId, id, event, atDevice, patch) {
      const result = await files.applyEvent(shopId, id, event, atDevice, patch);
      return result.ok
        ? { ok: true, item: fromEvidenceFile(result.file) }
        : { ok: false, error: result.error };
    },
  };
}

const fromReturnMedia = (m: ReturnMedia): UploadItem => ({
  id: m.id as EvidenceId,
  shopId: m.shopId,
  owner: { kind: 'return', returnId: m.returnId as ReturnCaseId },
  kind: m.kind,
  state: m.state,
  localPath: m.localPath,
  sizeBytes: m.sizeBytes,
  // `ReturnMedia` chưa lưu thời lượng: khai báo không có `durationMs` (Rules cho phép bỏ trống).
  durationMs: null,
  sha256Client: m.sha256Client,
  attemptCount: m.attemptCount,
  nextAttemptAtDevice: m.nextAttemptAtDevice,
  lastErrorCode: m.lastErrorCode,
  createdAtDevice: m.createdAtDevice,
});

/**
 * Nguồn media HÀNG HOÀN (`ReturnStore`, Q-28). Chỉ trả media do CHÍNH tài khoản đang đăng nhập tạo và
 * thuộc hồ sơ đã đăng bản neo lên máy chủ (kho lọc); chưa đăng nhập thì không có gì để tải.
 */
export function returnMediaSource(
  store: Pick<ReturnStore, 'listMediaForUpload' | 'applyMediaEvent'>,
  currentUid: () => string | null,
): UploadSource {
  return {
    async listByStates(shopId, states) {
      const uid = currentUid();
      if (!uid) return [];
      return (await store.listMediaForUpload(shopId, states, uid)).map(fromReturnMedia);
    },
    async applyEvent(shopId, id, event, atDevice, patch) {
      const result = await store.applyMediaEvent(shopId, id, event, atDevice, patch);
      return result.ok
        ? { ok: true, item: fromReturnMedia(result.media) }
        : { ok: false, error: result.error };
    },
  };
}
