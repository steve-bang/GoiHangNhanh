import type { FileState } from '@/features/evidence';

/**
 * Một tệp bằng chứng của đơn để liệt kê ở UI-E03. Chỉ tồn tại khi có kho tệp bằng chứng thật
 * (recorder/hàng đợi tải lên): hôm nay `loadEvidenceItems` luôn trả rỗng. Trạng thái là trạng thái
 * TỆP (`FileState`), tách khỏi phiên/đơn; nhãn hiển thị qua `summarizeOrderEvidence`/`toDisplayStatus`.
 */
export interface OrderEvidenceItem {
  readonly id: string;
  /** Nhóm của màn: bằng chứng đóng gói hoặc hàng hoàn. */
  readonly group: 'pack' | 'return';
  readonly kind: 'video' | 'photo';
  /** Thời gian THIẾT BỊ lúc ghi (không phải thời gian máy chủ). */
  readonly capturedAtDevice: number;
  readonly state: FileState;
}

export interface EvidenceCounts {
  readonly videos: number;
  readonly photos: number;
}

export function countEvidence(items: readonly OrderEvidenceItem[]): EvidenceCounts {
  return {
    videos: items.filter((i) => i.kind === 'video').length,
    photos: items.filter((i) => i.kind === 'photo').length,
  };
}
