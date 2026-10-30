import { FILE_STATES, type FileState } from './file-state';

/**
 * Quan hệ giữa tài khoản đã tạo tệp (người tạo PHIÊN với bằng chứng đóng gói, người chụp/quay với media
 * hàng hoàn) và tài khoản đang đăng nhập trên máy này (Q-24g, V1-07). Máy này chỉ tải lên tệp `current`.
 * - `current`: cùng tài khoản, hoặc CHƯA biết ai đang đăng nhập (không kết luận; hàng đợi cũng không chạy).
 * - `other`: tài khoản khác đã tạo trên máy này; chỉ tài khoản đó đăng nhập lại mới tải lên được.
 * - `unknown`: không rõ người tạo (tạo khi chưa biết tài khoản); không tài khoản nào tải lên được.
 * - `case_owner`: tệp của tài khoản hiện tại nhưng nằm trong hồ sơ CHƯA gửi lên máy chủ do tài khoản khác
 *   tạo (hàng hoàn, V1-07): chỉ tải được sau khi người tạo hồ sơ đăng nhập lại trên máy và gửi hồ sơ.
 */
export type UploaderRelation = 'current' | 'other' | 'unknown' | 'case_owner';

export function uploaderRelation(
  createdBy: string | null | undefined,
  currentUid: string | null,
): UploaderRelation {
  if (!currentUid) return 'current';
  if (!createdBy) return 'unknown';
  return createdBy === currentUid ? 'current' : 'other';
}

/** Trạng thái còn chờ máy chủ, nơi tệp của tài khoản khác bị kẹt (máy này không tải hộ). */
const WAITING_FOR_SERVER: readonly FileState[] = [
  FILE_STATES.QUEUED,
  FILE_STATES.UPLOADING,
  FILE_STATES.UPLOAD_FAILED,
  FILE_STATES.NEEDS_ATTENTION,
];

/**
 * Lý do cần nói thêm cạnh nhãn trạng thái: tệp còn chờ máy chủ nhưng máy này sẽ không tải vì do tài
 * khoản khác (hoặc không rõ tài khoản) tạo. `null` = không có gì cần nói. Chỉ là hiển thị: không đổi
 * trạng thái tệp (bất biến 3), không gán lại tệp cho tài khoản hiện tại (bất biến 5).
 */
export function foreignUploadNote(
  state: FileState,
  relation: UploaderRelation,
): Exclude<UploaderRelation, 'current'> | null {
  if (relation === 'current' || !WAITING_FOR_SERVER.includes(state)) return null;
  return relation;
}
