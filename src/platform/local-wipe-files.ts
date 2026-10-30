import {
  clearPendingLocalWipe,
  hasPendingLocalWipe,
  setPendingLocalWipe,
} from './local-wipe-marker';
import { deleteAllEvidenceFiles } from './recording-files';

/**
 * Các bước hệ tệp của việc xóa dữ liệu trên máy sau khi xóa tài khoản (V1-15): dấu ngoài CSDL và thư mục
 * `evidence/`. Bản web (`local-wipe-files.web.ts`) không có hệ tệp bền.
 */
export const LOCAL_WIPE_FILE_STEPS = {
  hasMarker: hasPendingLocalWipe,
  setMarker: setPendingLocalWipe,
  deleteEvidenceFiles: deleteAllEvidenceFiles,
  clearMarker: clearPendingLocalWipe,
} as const;
