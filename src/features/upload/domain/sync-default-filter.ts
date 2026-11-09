import type { SyncFilter } from './sync-jobs';

/** Số tệp ở từng nhóm chờ xử lý (không gồm "Đã tải lên", vốn chỉ nạp khi được chọn). */
export type SyncPendingCounts = Readonly<Record<'error' | 'uploading' | 'waiting_upload', number>>;

/**
 * Bộ lọc mở sẵn của UI-F01: nhóm đầu tiên CÓ tệp theo thứ tự Lỗi > Đang tải > Chờ tải; không nhóm nào có
 * thì "Đã tải lên". Hàm thuần, chỉ dùng để chọn tab mặc định (lựa chọn tay và tham số route vẫn thắng).
 */
export function pickDefaultSyncFilter(counts: SyncPendingCounts): SyncFilter {
  if (counts.error > 0) return 'error';
  if (counts.uploading > 0) return 'uploading';
  if (counts.waiting_upload > 0) return 'waiting_upload';
  return 'uploaded';
}
