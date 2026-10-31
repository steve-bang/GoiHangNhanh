import type { ShopId } from '@/core/ids';
import {
  FILE_STATES,
  sumCounts,
  UNSYNCED_STATES,
  type DeviceTimeRange,
  type EvidenceFileStore,
  type FileState,
} from '@/features/evidence';
import type { OrderStore } from '@/features/orders';
import type { ReturnStore } from '@/features/returns';

import { loadSyncJobs, type SyncJobStores } from './load-sync-jobs';
import { describeSyncJob, DONE_SYNC_STATES, PENDING_SYNC_STATES } from './sync-jobs';

/**
 * Số liệu THẬT trên máy cho Trang chủ (UI-B01) và Dữ liệu bằng chứng (UI-I01), V1-10. Hàm thuần trên
 * các kho cục bộ (không mạng, không đồng hồ: giờ truyền vào). Mọi số theo MỘT shop (bất biến 8); "đã tải
 * lên"/"trên đám mây" chỉ từ trạng thái do máy chủ xác lập (bất biến 3).
 */

export interface EvidenceStatsStores extends SyncJobStores {
  readonly files: SyncJobStores['files'] & Pick<EvidenceFileStore, 'countByState'>;
  readonly orders: SyncJobStores['orders'] & Pick<OrderStore, 'countPackedOrders'>;
  readonly returns: SyncJobStores['returns'] & Pick<ReturnStore, 'countMediaByState'>;
}

/** "Hôm nay" theo giờ THIẾT BỊ (múi giờ của máy): `[0 giờ hôm nay, 0 giờ hôm sau)`. */
export function deviceDayRange(now: number): DeviceTimeRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromDevice: start.getTime(), toDevice: end.getTime() };
}

export interface TodayStats {
  /** Đơn khác nhau có phiên bắt đầu hôm nay và đã dừng ghi bình thường (có video đã lưu). */
  readonly packed: number;
  /** Tệp máy chủ đã nhận (`uploaded`/`verified`) có lần đổi trạng thái cuối trong hôm nay. */
  readonly uploaded: number;
  /** Tệp đang ở bộ lọc Lỗi của Trung tâm đồng bộ (mọi ngày: lỗi cũ vẫn cần xử lý). */
  readonly needsAction: number;
}

export async function loadTodayStats(
  stores: EvidenceStatsStores,
  shopId: ShopId,
  uid: string | null,
  now: number,
): Promise<TodayStats> {
  const today = deviceDayRange(now);
  const [packed, files, media, pending] = await Promise.all([
    stores.orders.countPackedOrders(shopId, today),
    stores.files.countByState(shopId, today),
    stores.returns.countMediaByState(shopId, today),
    loadSyncJobs(stores, shopId, uid, PENDING_SYNC_STATES),
  ]);
  // Cùng phân loại với UI-F01 (V1-08): ô Lỗi = đúng số tệp người dùng thấy ở bộ lọc Lỗi.
  const needsAction = pending.filter(
    (job) => describeSyncJob(job, { online: true, now })?.filter === 'error',
  ).length;
  return { packed, uploaded: sumCounts([files, media], DONE_SYNC_STATES), needsAction };
}

/** Trạng thái chưa (hoặc không còn) có bản đã lưu trên máy. */
const NOT_SAVED_ON_DEVICE: readonly FileState[] = [
  FILE_STATES.RECORDING,
  FILE_STATES.SAVING_LOCAL,
  FILE_STATES.LOCAL_SAVE_FAILED,
  FILE_STATES.UNRECOVERABLE,
];

export interface EvidenceTotals {
  /** Mọi tệp bằng chứng của shop trên máy này (mọi trạng thái). */
  readonly total: number;
  /** Tệp có bản đã lưu trên máy (v1 không xóa bản cục bộ sau khi tải, bất biến 4). */
  readonly onDevice: number;
  /** Tệp máy chủ chưa xác nhận đã nhận (cùng định nghĩa đếm chặn đăng xuất). */
  readonly pending: number;
  /** Tệp máy chủ đã nhận VÀ kiểm tra khớp (`verified`). */
  readonly cloud: number;
}

export async function loadEvidenceTotals(
  stores: Pick<EvidenceStatsStores, 'files' | 'returns'>,
  shopId: ShopId,
): Promise<EvidenceTotals> {
  const [files, media] = await Promise.all([
    stores.files.countByState(shopId),
    stores.returns.countMediaByState(shopId),
  ]);
  const counts = [files, media];
  const total = sumCounts(counts);
  return {
    total,
    onDevice: total - sumCounts(counts, NOT_SAVED_ON_DEVICE),
    pending: sumCounts(counts, UNSYNCED_STATES),
    cloud: sumCounts(counts, [FILE_STATES.VERIFIED]),
  };
}
