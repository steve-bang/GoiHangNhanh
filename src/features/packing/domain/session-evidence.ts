import type { EvidenceStatusLabel } from '@/core/theme';
import { toDisplayStatus, type EvidenceFile, type FileState } from '@/features/evidence';

/** Vấn đề tải lên của video ĐÃ lưu trên máy (không làm mất bản trên máy). */
export type UploadProblem = 'upload_failed' | 'attention' | 'hash_mismatch';

export interface SessionEvidenceSummary {
  /** Số tệp thật của phiên (mọi trạng thái). */
  readonly total: number;
  /** Số video đã lưu bền trên máy (đã đóng, đọc được, có mã băm): từ chờ tải lên trở đi, kể cả khi tải lên lỗi. */
  readonly saved: number;
  /** Số tệp CHƯA lưu được trên máy (`local_save_failed`, `unrecoverable`). */
  readonly notSaved: number;
  /** Số tệp còn đang ghi/đang lưu. */
  readonly inProgress: number;
  /** Vấn đề tải lên nặng nhất trong các video đã lưu, nếu có. */
  readonly problem: UploadProblem | null;
  /** Nhãn của video "yếu nhất" trong các video đã lưu (docs/09 mục 3); `null` nếu chưa có video nào đã lưu. */
  readonly label: EvidenceStatusLabel | null;
}

const NOT_SAVED: readonly FileState[] = ['local_save_failed', 'unrecoverable'];
const IN_PROGRESS: readonly FileState[] = ['recording', 'saving_local'];
const PROBLEM_OF: Partial<Record<FileState, UploadProblem>> = {
  upload_failed: 'upload_failed',
  needs_attention: 'attention',
  hash_mismatch: 'hash_mismatch',
};
const PROBLEM_RANK: readonly UploadProblem[] = ['hash_mismatch', 'attention', 'upload_failed'];
/** Tiến độ tăng dần: nhãn của cả phiên là nhãn của video đi chậm nhất. */
const PROGRESS: readonly EvidenceStatusLabel[] = [
  'saved_on_device',
  'waiting_upload',
  'uploading',
  'uploaded',
  'verified',
];

/**
 * Gộp MỌI tệp của một phiên thành điều có thể nói thật cho người dùng (A06/A08). Tệp lỗi LƯU CỤC BỘ
 * khác tệp lỗi TẢI LÊN: video tải lên lỗi vẫn nằm trên máy, nên không được nói "chưa lưu được".
 * Không nói "đã lưu" cho tệp chưa lưu được, và không để một tệp tốt che tệp lỗi (bất biến 3, 11).
 */
export function summarizeSessionEvidence(
  files: readonly Pick<EvidenceFile, 'state'>[],
): SessionEvidenceSummary {
  let notSaved = 0;
  let inProgress = 0;
  let saved = 0;
  let problem: UploadProblem | null = null;
  let slowest = -1;
  let label: EvidenceStatusLabel | null = null;
  for (const { state } of files) {
    if (NOT_SAVED.includes(state)) {
      notSaved += 1;
      continue;
    }
    if (IN_PROGRESS.includes(state)) {
      inProgress += 1;
      continue;
    }
    saved += 1;
    const found = PROBLEM_OF[state];
    if (found) {
      if (!problem || PROBLEM_RANK.indexOf(found) < PROBLEM_RANK.indexOf(problem)) problem = found;
      continue;
    }
    const display = toDisplayStatus(state);
    if (display.kind !== 'label') continue;
    const rank = PROGRESS.indexOf(display.label);
    if (slowest < 0 || rank < slowest) {
      slowest = rank;
      label = display.label;
    }
  }
  return {
    total: files.length,
    saved,
    notSaved,
    inProgress,
    problem,
    label: saved === 0 ? null : problem ? 'error' : label,
  };
}

/**
 * Còn tệp đang TỰ đổi trạng thái (đang ghi/lưu, chờ/đang tải lên, `uploaded` chờ xác minh): màn nên đọc
 * lại định kỳ. Trạng thái dừng chờ người dùng hoặc đã tới đích (`verified`, lỗi lưu, `upload_failed`,
 * `needs_attention`, `hash_mismatch`, `unrecoverable`) KHÔNG poll: đổi tiếp chỉ do một thao tác khác, và
 * màn đọc lại khi lấy lại focus.
 */
export const hasPendingEvidence = (files: readonly Pick<EvidenceFile, 'state'>[]): boolean =>
  files.some(
    (f) =>
      ![
        'verified',
        'unrecoverable',
        'local_save_failed',
        'hash_mismatch',
        'upload_failed',
        'needs_attention',
      ].includes(f.state),
  );
