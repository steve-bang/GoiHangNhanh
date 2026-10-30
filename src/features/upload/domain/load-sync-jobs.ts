import type { EvidenceId, OrderId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import {
  uploaderRelation,
  type EvidenceFile,
  type EvidenceFileStore,
  type FileState,
} from '@/features/evidence';
import type { OrderDetails, OrderStore, PackingSession } from '@/features/orders';
import {
  returnMediaUploader,
  type ReturnCase,
  type ReturnMedia,
  type ReturnStore,
} from '@/features/returns';

import { syncJobKey, type SyncJob } from './sync-jobs';

/**
 * Các kho cục bộ Trung tâm đồng bộ cần (đọc + áp sự kiện Thử lại qua máy trạng thái). Mọi truy vấn có
 * `shopId` (bất biến 8).
 */
export interface SyncJobStores {
  readonly files: Pick<EvidenceFileStore, 'listByStates' | 'get' | 'applyEvent'>;
  readonly orders: Pick<OrderStore, 'getSession' | 'getOrder'>;
  readonly returns: Pick<ReturnStore, 'listMediaByStates' | 'getReturn' | 'applyMediaEvent'>;
}

/** Bộ đệm theo id trong MỘT lần nạp: nhiều tệp cùng phiên/đơn/hồ sơ chỉ đọc một lần. */
function memo<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    let value = cache.get(key);
    if (!value) {
      // Lỗi đọc một bản ghi phụ không làm hỏng cả danh sách: coi như không đọc được (hiện "chưa rõ").
      value = load(key).catch(() => null as V);
      cache.set(key, value);
    }
    return value;
  };
}

function readers(stores: SyncJobStores, shopId: ShopId) {
  return {
    session: memo<SessionId, PackingSession | null>((id) => stores.orders.getSession(shopId, id)),
    order: memo<OrderId, OrderDetails | null>((id) => stores.orders.getOrder(shopId, id)),
    returnCase: memo<ReturnCaseId, ReturnCase | null>(async (id) => {
      const details = await stores.returns.getReturn(shopId, id);
      return details?.returnCase ?? null;
    }),
  };
}

type Readers = ReturnType<typeof readers>;

async function fromEvidenceFile(
  file: EvidenceFile,
  read: Readers,
  uid: string | null,
): Promise<SyncJob> {
  const [session, order] = await Promise.all([
    read.session(file.sessionId),
    read.order(file.orderId),
  ]);
  const pkg = order?.packages.find((p) => p.id === file.packageId) ?? null;
  return {
    key: syncJobKey('pack', file.id),
    id: file.id,
    shopId: file.shopId,
    kind: file.kind,
    state: file.state,
    sizeBytes: file.sizeBytes,
    attemptCount: file.attemptCount,
    lastErrorCode: file.lastErrorCode,
    updatedAtDevice: file.updatedAtDevice,
    createdAtDevice: file.createdAtDevice,
    record: {
      kind: 'pack',
      orderId: file.orderId,
      orderCode: order?.order.orderCode ?? null,
      packageIndex: pkg?.index ?? null,
    },
    // Phiên không đọc được = không rõ người tạo: không kết luận là của mình (không có nút).
    uploader: session ? uploaderRelation(session.createdBy, uid) : uid ? 'unknown' : 'current',
  };
}

async function fromReturnMedia(
  media: ReturnMedia,
  read: Readers,
  uid: string | null,
): Promise<SyncJob> {
  const returnCase = await read.returnCase(media.returnId);
  return {
    key: syncJobKey('return', media.id),
    id: media.id,
    shopId: media.shopId,
    kind: media.kind,
    state: media.state,
    sizeBytes: media.sizeBytes,
    attemptCount: media.attemptCount,
    lastErrorCode: media.lastErrorCode,
    updatedAtDevice: media.updatedAtDevice,
    createdAtDevice: media.createdAtDevice,
    record: {
      kind: 'return',
      returnId: media.returnId,
      caseCode: returnCase?.code ?? null,
      caseStatus: returnCase?.status ?? null,
    },
    uploader: returnCase
      ? returnMediaUploader(media, returnCase, uid)
      : uid
        ? 'unknown'
        : 'current',
  };
}

/**
 * Đọc mọi tệp của shop (bằng chứng đóng gói + ảnh/video hàng hoàn, MỌI người tạo trên máy này) ở một
 * trong `states`, kèm tên hồ sơ và quan hệ người tạo so với `uid` đang đăng nhập. Chỉ đọc kho cục bộ,
 * không gọi mạng, không đổi gì. Cũ nhất trước.
 */
export async function loadSyncJobs(
  stores: SyncJobStores,
  shopId: ShopId,
  uid: string | null,
  states: readonly FileState[],
): Promise<SyncJob[]> {
  const read = readers(stores, shopId);
  const [files, media] = await Promise.all([
    stores.files.listByStates(shopId, states),
    stores.returns.listMediaByStates(shopId, states),
  ]);
  const jobs = await Promise.all([
    ...files.map((f) => fromEvidenceFile(f, read, uid)),
    ...media.map((m) => fromReturnMedia(m, read, uid)),
  ]);
  return jobs.sort((a, b) => a.createdAtDevice - b.createdAtDevice);
}

/** Đọc MỘT tệp theo khóa route của UI-F02 (`pack:<id>` / `return:<id>`); không có thì `null`. */
export async function loadSyncJob(
  stores: SyncJobStores,
  shopId: ShopId,
  uid: string | null,
  target: { readonly source: 'pack' | 'return'; readonly id: string },
  states: readonly FileState[],
): Promise<SyncJob | null> {
  const read = readers(stores, shopId);
  if (target.source === 'pack') {
    const file = await stores.files.get(shopId, target.id as EvidenceId);
    return file && states.includes(file.state) ? fromEvidenceFile(file, read, uid) : null;
  }
  const media = (await stores.returns.listMediaByStates(shopId, states)).find(
    (m) => m.id === target.id,
  );
  return media ? fromReturnMedia(media, read, uid) : null;
}
