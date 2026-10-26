/**
 * DỮ LIỆU MINH HỌA cho khung giao diện - KHÔNG phải dữ liệu thật và không giả làm dữ liệu từ sàn.
 * Gom ở MỘT tệp để dễ tìm và xóa khi có dữ liệu thật; khi nối Firestore, thay từng chỗ import
 * `ILLUSTRATIVE_*` bằng hook ở lớp data của feature. Mã đơn bên dưới là chuỗi bịa, chỉ để hiển thị.
 */
import type { OrderSource } from '@/core/orders/order-source';
import type { EvidenceStatusLabel } from '@/core/theme';

import type { ProductLine } from '../ui';

export interface IllustrativeOrder {
  id: string;
  orderCode: string;
  source: OrderSource;
  trackingCode?: string;
  dateLabel: string;
  videoCount: number;
  status?: EvidenceStatusLabel;
  lines: readonly ProductLine[];
}

export const ILLUSTRATIVE_SHOP_NAME = 'Shop minh họa';

export const ILLUSTRATIVE_ORDERS: readonly IllustrativeOrder[] = [
  {
    id: 'demo-order-1',
    orderCode: 'DEMO-0001',
    source: 'tiktok_shop',
    trackingCode: 'DEMO-VD-0001',
    dateLabel: '26/10/2026 14:05',
    videoCount: 1,
    status: 'saved_on_device',
    lines: [{ id: 'demo-line-1', name: 'Áo thun cotton', variant: 'Đen / XL', quantity: 2 }],
  },
  {
    id: 'demo-order-2',
    orderCode: 'DEMO-0002',
    source: 'shopee',
    dateLabel: '26/10/2026 13:40',
    videoCount: 1,
    status: 'uploading',
    lines: [],
  },
  {
    id: 'demo-order-3',
    orderCode: 'DEMO-0003',
    source: 'lazada',
    dateLabel: '25/10/2026 17:22',
    videoCount: 2,
    status: 'verified',
    lines: [{ id: 'demo-line-2', name: 'Bình giữ nhiệt', variant: '500 ml', quantity: 1 }],
  },
  {
    id: 'demo-order-4',
    orderCode: 'DEMO-0004',
    source: 'other',
    dateLabel: '25/10/2026 09:10',
    videoCount: 1,
    status: 'error',
    lines: [],
  },
  {
    id: 'demo-order-5',
    orderCode: 'DEMO-0005',
    source: 'shopee',
    dateLabel: '24/10/2026 16:45',
    videoCount: 1,
    status: 'uploaded',
    lines: [],
  },
  {
    id: 'demo-order-6',
    orderCode: 'DEMO-0006',
    source: 'tiktok_shop',
    dateLabel: '24/10/2026 11:03',
    videoCount: 1,
    status: 'waiting_upload',
    lines: [],
  },
];

export const ILLUSTRATIVE_SYNC_COUNTS = { uploading: 1, waiting_upload: 1, error: 1 } as const;

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
