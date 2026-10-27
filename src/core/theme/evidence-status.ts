import type { StatusTokenKey } from './semantic';

/**
 * Chuẩn hiển thị trạng thái bằng chứng - docs/09 mục 3 ("Chuẩn hiển thị trạng thái bằng chứng").
 * Sáu nhãn thống nhất toàn app. Nhãn chữ nằm trong i18n (khóa `evidence:status.<nhãn>`).
 *
 * Quy tắc cứng (có test):
 * - Mỗi nhãn có biểu tượng RIÊNG; `uploaded` và `verified` cùng sắc xanh nhưng khác biểu tượng.
 * - `saved_on_device` KHÔNG được dùng biểu tượng dấu tick / màu thành công (mockup 04 bị sửa vì
 *   điều này - docs/09 mục 5.5, mục A.2).
 * - Chỉ `verified` được dùng cụm "Đã lưu an toàn trên máy chủ".
 */
export type EvidenceStatusLabel =
  'saved_on_device' | 'waiting_upload' | 'uploading' | 'uploaded' | 'verified' | 'error';

/** Tên biểu tượng trừu tượng; ánh xạ sang bộ icon cụ thể ở lớp ui khi chọn thư viện icon. */
export type StatusIconName =
  'device-saved' | 'clock' | 'cloud-upload' | 'cloud-done' | 'shield-check' | 'alert-triangle';

export interface StatusPresentation {
  readonly labelKey: `evidence:status.${EvidenceStatusLabel}`;
  readonly hintKey: `evidence:statusHint.${EvidenceStatusLabel}`;
  readonly icon: StatusIconName;
  /** Khóa màu trong `semantic.status` - riêng từng nhãn, không dùng chung `success`. */
  readonly statusToken: StatusTokenKey;
}

export const EVIDENCE_STATUS_PRESENTATION: Readonly<
  Record<EvidenceStatusLabel, StatusPresentation>
> = {
  saved_on_device: {
    labelKey: 'evidence:status.saved_on_device',
    hintKey: 'evidence:statusHint.saved_on_device',
    icon: 'device-saved',
    statusToken: 'savedOnDevice',
  },
  waiting_upload: {
    labelKey: 'evidence:status.waiting_upload',
    hintKey: 'evidence:statusHint.waiting_upload',
    icon: 'clock',
    statusToken: 'waitingUpload',
  },
  uploading: {
    labelKey: 'evidence:status.uploading',
    hintKey: 'evidence:statusHint.uploading',
    icon: 'cloud-upload',
    statusToken: 'uploading',
  },
  uploaded: {
    labelKey: 'evidence:status.uploaded',
    hintKey: 'evidence:statusHint.uploaded',
    icon: 'cloud-done',
    statusToken: 'uploaded',
  },
  verified: {
    labelKey: 'evidence:status.verified',
    hintKey: 'evidence:statusHint.verified',
    icon: 'shield-check',
    statusToken: 'verified',
  },
  error: {
    labelKey: 'evidence:status.error',
    hintKey: 'evidence:statusHint.error',
    icon: 'alert-triangle',
    statusToken: 'error',
  },
};
