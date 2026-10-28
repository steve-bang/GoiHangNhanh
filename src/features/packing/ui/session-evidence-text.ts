import type { UploadProblem } from '../domain';

/**
 * Câu nói về video ĐÃ lưu trên máy nhưng tải lên gặp vấn đề (A06/A07): luôn nói rõ bản trên máy vẫn còn
 * và KHÔNG bảo quay lại (khác lỗi lưu trên máy).
 */
export const PROBLEM_MESSAGE_KEY: Record<UploadProblem, string> = {
  upload_failed: 'screens:confirm.uploadFailedMessage',
  attention: 'screens:confirm.uploadAttentionMessage',
  hash_mismatch: 'screens:confirm.hashMismatchMessage',
};
