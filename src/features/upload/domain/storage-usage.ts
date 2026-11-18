import type { ShopId } from '@/core/ids';
import { FILE_STATES, type FileState } from '@/features/evidence';

import { NOT_SAVED_ON_DEVICE, type EvidenceStatsStores } from './evidence-stats';
import { loadSyncJobs } from './load-sync-jobs';
import { DONE_SYNC_STATES } from './sync-jobs';

/**
 * Dung lượng tệp bằng chứng trên máy này (UI-F03, V1-30). Hàm thuần trên các kho cục bộ, không mạng.
 * CHỈ tính tệp của shop đang dùng VÀ do chính tài khoản đang đăng nhập tạo (bất biến 8; người dùng chốt).
 * Tệp của tài khoản khác hoặc không rõ người tạo (`other`/`unknown`) không được cộng, chỉ được đếm riêng (`otherAccountFiles`).
 * "Đã lên máy chủ" chỉ là trạng thái do máy chủ xác lập (bất biến 3): `uploaded`/`verified`.
 */

export interface UsageGroup {
  /** Số tệp trong nhóm. */
  readonly files: number;
  /** Tổng byte của các tệp ĐÃ biết cỡ. */
  readonly bytes: number;
  /** Số tệp chưa biết cỡ (`sizeBytes` null): tổng `bytes` chỉ là mức tối thiểu, không coi là 0. */
  readonly unknownSize: number;
}

export interface StorageUsage {
  /** Máy chủ đã nhận (`uploaded`/`verified`). */
  readonly onServer: UsageGroup;
  /** Máy chủ chưa xác nhận đã nhận (chờ, đang tải, lỗi, không khớp mã băm...). */
  readonly notOnServer: UsageGroup;
  /** Chưa có (hoặc không còn) bản lưu trên máy: đang ghi, lưu máy lỗi, không khôi phục được. */
  readonly noLocalCopy: UsageGroup;
  /** Tệp của tài khoản khác/không rõ người tạo trên máy này: KHÔNG nằm trong ba nhóm trên. */
  readonly otherAccountFiles: number;
}

const EMPTY: UsageGroup = { files: 0, bytes: 0, unknownSize: 0 };

const add = (group: UsageGroup, sizeBytes: number | null): UsageGroup => {
  const known = sizeBytes !== null && Number.isFinite(sizeBytes) && sizeBytes >= 0;
  return {
    files: group.files + 1,
    bytes: group.bytes + (known ? sizeBytes : 0),
    unknownSize: group.unknownSize + (known ? 0 : 1),
  };
};

const ALL_STATES: readonly FileState[] = Object.values(FILE_STATES);

export async function loadStorageUsage(
  stores: EvidenceStatsStores,
  shopId: ShopId,
  uid: string | null,
): Promise<StorageUsage> {
  const jobs = await loadSyncJobs(stores, shopId, uid, ALL_STATES);
  let onServer = EMPTY;
  let notOnServer = EMPTY;
  let noLocalCopy = EMPTY;
  let otherAccountFiles = 0;
  for (const job of jobs) {
    // Phòng thủ: kho đã lọc theo shop, nhưng không bao giờ cộng tệp của shop khác (bất biến 8).
    if (job.shopId !== shopId) continue;
    // `case_owner`: ảnh do CHÍNH tài khoản này chụp nhưng hồ sơ do người khác tạo: vẫn là tệp của mình.
    if (job.uploader !== 'current' && job.uploader !== 'case_owner') {
      otherAccountFiles += 1;
    } else if (DONE_SYNC_STATES.includes(job.state)) {
      onServer = add(onServer, job.sizeBytes);
    } else if (NOT_SAVED_ON_DEVICE.includes(job.state)) {
      noLocalCopy = add(noLocalCopy, job.sizeBytes);
    } else {
      notOnServer = add(notOnServer, job.sizeBytes);
    }
  }
  return { onServer, notOnServer, noLocalCopy, otherAccountFiles };
}
