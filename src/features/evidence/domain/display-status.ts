import type { EvidenceStatusLabel } from '@/core/theme';

import { FILE_STATES, type FileState } from './file-state';
import type { UploaderRelation } from './uploader';

/**
 * Ánh xạ trạng thái tệp -> nhãn hiển thị (docs/09 mục 3). Hai pha ghi hình dùng trạng thái riêng
 * của màn quay, không dùng sáu nhãn.
 */
export type EvidenceDisplayStatus =
  | { readonly kind: 'capture'; readonly phase: 'recording' | 'saving_local' }
  | { readonly kind: 'label'; readonly label: EvidenceStatusLabel };

export interface DisplayContext {
  /**
   * Lý do đang chờ (ví dụ mất mạng). Có lý do -> "Chờ tải lên"; không có -> "Đã lưu trên máy".
   * Cách phân biệt này là DIỄN GIẢI của docs/09 mục 3 (cả hai nhãn cùng ứng với trạng thái nghiệp
   * vụ "Chờ tải lên"); cần BA xác nhận - xem docs/engineering/decisions.md, câu hỏi Q-02.
   */
  readonly waitingReason?: string;
  /**
   * Ai đã tạo tệp so với tài khoản đang đăng nhập (`uploaderRelation`, V1-07). Khác `current` thì máy
   * này KHÔNG tải tệp (Q-24g): `queued`/`uploading` hiện "Chờ tải lên" (không "Đang tải lên" khi không có
   * gì đang gửi); bên gọi hiện lý do (`foreignUploadNote`). Trạng thái khác giữ nhãn của nó.
   */
  readonly uploader?: UploaderRelation;
}

const isForeign = (context: DisplayContext): boolean =>
  context.uploader !== undefined && context.uploader !== 'current';

const label = (l: EvidenceStatusLabel): EvidenceDisplayStatus => ({ kind: 'label', label: l });

export function toDisplayStatus(
  state: FileState,
  context: DisplayContext = {},
): EvidenceDisplayStatus {
  switch (state) {
    case FILE_STATES.RECORDING:
      return { kind: 'capture', phase: 'recording' };
    case FILE_STATES.SAVING_LOCAL:
      return { kind: 'capture', phase: 'saving_local' };
    case FILE_STATES.QUEUED:
      return label(
        context.waitingReason || isForeign(context) ? 'waiting_upload' : 'saved_on_device',
      );
    case FILE_STATES.UPLOADING:
      return label(isForeign(context) ? 'waiting_upload' : 'uploading');
    case FILE_STATES.UPLOADED:
      return label('uploaded');
    case FILE_STATES.VERIFIED:
      return label('verified');
    case FILE_STATES.LOCAL_SAVE_FAILED:
    case FILE_STATES.UPLOAD_FAILED:
    case FILE_STATES.HASH_MISMATCH:
    case FILE_STATES.NEEDS_ATTENTION:
    case FILE_STATES.UNRECOVERABLE:
      return label('error');
  }
}
