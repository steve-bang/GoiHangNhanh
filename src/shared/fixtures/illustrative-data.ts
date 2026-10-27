/**
 * DỮ LIỆU MINH HỌA cho khung giao diện - KHÔNG phải dữ liệu thật và không giả làm dữ liệu từ sàn.
 * Gom ở MỘT tệp để dễ tìm và xóa khi có dữ liệu thật; khi nối Firestore, thay từng chỗ import
 * `ILLUSTRATIVE_*` bằng hook ở lớp data của feature. Mã đơn bên dưới là chuỗi bịa, chỉ để hiển thị.
 */
import type { EvidenceStatusLabel } from '@/core/theme';

export const ILLUSTRATIVE_SHOP_NAME = 'Shop minh họa';

export const ILLUSTRATIVE_SYNC_COUNTS = { uploading: 1, waiting_upload: 1, error: 1 } as const;

/** Số liệu "hôm nay" của Trang chủ (minh họa; nhãn theo docs/09 mục 3, không phải "Đã đồng bộ"). */
export const ILLUSTRATIVE_TODAY_STATS = { packed: 12, uploaded: 11, error: 1 } as const;

export type IllustrativeReturnStage =
  'receiving' | 'checking' | 'checked' | 'discrepancy' | 'unsynced';

export interface IllustrativeReturnCase {
  id: string;
  /** Mã hoàn / mã vận đơn hiển thị (chỉ là chuỗi tìm kiếm). */
  code: string;
  /** Mã đơn gốc; vắng = hồ sơ chưa liên kết đơn gốc (CLAUDE.md #5). */
  originalOrderCode?: string;
  stage: IllustrativeReturnStage;
  dateLabel: string;
  status: EvidenceStatusLabel;
}

export const ILLUSTRATIVE_RETURN_CASES: readonly IllustrativeReturnCase[] = [
  {
    id: 'demo-return-1',
    code: 'DEMO-HOAN-01',
    originalOrderCode: 'DEMO-0003',
    stage: 'checking',
    dateLabel: '26/10/2026 10:15',
    status: 'uploading',
  },
  {
    id: 'demo-return-2',
    code: 'DEMO-HOAN-02',
    stage: 'receiving',
    dateLabel: '26/10/2026 09:30',
    status: 'saved_on_device',
  },
  {
    id: 'demo-return-3',
    code: 'DEMO-HOAN-03',
    originalOrderCode: 'DEMO-0001',
    stage: 'discrepancy',
    dateLabel: '23/10/2026 15:00',
    status: 'verified',
  },
];

export type IllustrativeSyncFilter = 'uploading' | 'waiting_upload' | 'error' | 'uploaded';

export interface IllustrativeSyncJob {
  id: string;
  /** Tên hồ sơ hiển thị: đơn + kiện. */
  recordLabel: string;
  sizeLabel: string;
  status: EvidenceStatusLabel;
  progressPercent?: number;
  /** Mã lý do chờ (dịch ở màn hình); chỉ có khi trạng thái là Chờ tải lên. */
  reason?: 'waiting_network';
}

export const ILLUSTRATIVE_SYNC_JOBS: readonly IllustrativeSyncJob[] = [
  {
    id: 'demo-job-1',
    recordLabel: 'DEMO-0002 · Kiện 1',
    sizeLabel: '182 MB',
    status: 'uploading',
    progressPercent: 45,
  },
  {
    id: 'demo-job-2',
    recordLabel: 'DEMO-0006 · Kiện 1',
    sizeLabel: '96 MB',
    status: 'waiting_upload',
    reason: 'waiting_network',
  },
  { id: 'demo-job-3', recordLabel: 'DEMO-0004 · Kiện 1', sizeLabel: '210 MB', status: 'error' },
  { id: 'demo-job-4', recordLabel: 'DEMO-0005 · Kiện 1', sizeLabel: '140 MB', status: 'uploaded' },
];
