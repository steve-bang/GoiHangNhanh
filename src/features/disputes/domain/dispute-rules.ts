import { FILE_STATES, type EvidenceFile } from '@/features/evidence';

import type { DisputeDetails } from './types';

export const formatDisputeCode = (seq: number): string => `TC-${String(seq).padStart(5, '0')}`;

/** Tệp chưa lên máy chủ hoặc đang lỗi: cảnh báo ở UI-G03 và UI-G04, không chặn chọn. */
export type EvidenceCaution = 'on_device_only' | 'failed';

export function evidenceCaution(file: Pick<EvidenceFile, 'state'>): EvidenceCaution | null {
  switch (file.state) {
    case FILE_STATES.UPLOADED:
    case FILE_STATES.VERIFIED:
      return null;
    case FILE_STATES.RECORDING:
    case FILE_STATES.SAVING_LOCAL:
    case FILE_STATES.LOCAL_SAVE_FAILED:
    case FILE_STATES.HASH_MISMATCH:
    case FILE_STATES.UNRECOVERABLE:
    case FILE_STATES.UPLOAD_FAILED:
    case FILE_STATES.NEEDS_ATTENTION:
      return 'failed';
    default:
      return 'on_device_only';
  }
}

/**
 * Điều cần nói thẳng ở bản xem trước/xuất (UI-G04). KHÔNG có mục "đầy đủ": chưa có chính sách bộ bằng
 * chứng bắt buộc (CLAUDE.md #11), nên chỉ liệt kê điều đã biết là thiếu/hạn chế.
 */
export type ExportNotice =
  'no_evidence' | 'not_on_cloud' | 'opening_evidence_limit' | 'no_order_link';

export function exportNotices(
  details: DisputeDetails,
  files: readonly Pick<EvidenceFile, 'state'>[],
): ExportNotice[] {
  const notices: ExportNotice[] = [];
  const { subject } = details.dispute;
  if (details.evidence.length === 0) notices.push('no_evidence');
  if (files.some((f) => evidenceCaution(f) !== null)) notices.push('not_on_cloud');
  if (subject.kind === 'return' && subject.openingEvidenceLimit) {
    notices.push('opening_evidence_limit');
  }
  if (subject.kind === 'return' && subject.orderId === null) notices.push('no_order_link');
  return notices;
}
