import { FILE_STATES, type FileState } from './file-state';

/**
 * Mã lỗi phát sinh TRƯỚC khi gửi gì lên máy chủ (kiểm tra cục bộ): máy chủ chưa thể biết tệp này.
 * Hàng đợi tải lên ghi các mã này khi tệp mất/đổi/không đọc được trước khi khai báo.
 */
export const LOCAL_ONLY_ERROR_CODES: readonly string[] = [
  'LOCAL_HASH_CHANGED',
  'FILE_MISSING',
  'FILE_UNREADABLE',
];

const S = FILE_STATES;

/**
 * Máy chủ có thể đã biết tệp này (đã khai báo, đã nhận một phần hoặc đủ) không? Dùng cho (1) hàng đợi
 * tải lên: chỉ đáng hỏi máy chủ (mỗi lần hỏi là một lượt đọc Firestore) khi có thể đã biết; (2) quy tắc
 * xóa ảnh hàng hoàn (Q-28): tệp ĐÃ TỪNG được đưa cho máy chủ thì không xóa được, vì máy chủ có thể đã
 * nhận một phần hoặc nhận đủ mà app mất phản hồi (QA-05).
 *
 * Đúng khi: đang tải/đã tải/đã xác minh/lệch mã băm, tải lỗi (có thể máy chủ nhận mà app mất phản
 * hồi), cần xử lý trừ khi lỗi là kiểm tra cục bộ, hoặc đang chờ lại sau một lần thử (đã có lần thử hoặc
 * mã lỗi). Tệp `queued` chưa từng thử thì chưa khai báo, máy chủ chắc chắn chưa có.
 */
export function mayHaveReachedServer(file: {
  readonly state: FileState;
  readonly attemptCount: number;
  readonly lastErrorCode: string | null;
}): boolean {
  switch (file.state) {
    case S.UPLOADING:
    case S.UPLOADED:
    case S.VERIFIED:
    case S.HASH_MISMATCH:
    case S.UPLOAD_FAILED:
      return true;
    case S.NEEDS_ATTENTION:
      return !file.lastErrorCode || !LOCAL_ONLY_ERROR_CODES.includes(file.lastErrorCode);
    case S.QUEUED:
      return file.attemptCount > 0 || file.lastErrorCode !== null;
    default:
      return false;
  }
}
