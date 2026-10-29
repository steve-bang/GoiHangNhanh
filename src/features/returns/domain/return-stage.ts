import type { ReturnSummary } from './types';

/** Giai đoạn hiển thị ở danh sách (UI-D01). `discrepancy` ưu tiên khi hồ sơ chưa xác nhận mà đã có sai lệch. */
export type ReturnStage = 'receiving' | 'opening' | 'checking' | 'discrepancy' | 'confirmed';

export function stageOf(summary: ReturnSummary): ReturnStage {
  const { status } = summary.returnCase;
  if (status === 'confirmed') return 'confirmed';
  if (summary.discrepancyCount > 0 && status === 'checking') return 'discrepancy';
  return status;
}

/** Bộ lọc danh sách: một giai đoạn hoặc "chưa liên kết đơn gốc" (không tự ghép, chờ xác minh). */
export type ReturnFilter = 'all' | ReturnStage | 'unlinked';

export function matchesFilter(summary: ReturnSummary, filter: ReturnFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unlinked') return summary.returnCase.sourceOrderId === null;
  return stageOf(summary) === filter;
}
