/**
 * Web (chỉ xem trước/chụp ảnh giao diện, kho bộ nhớ như `local-db.web.ts`): không có thư mục bằng chứng
 * hay tệp bền; dấu chỉ trong bộ nhớ của tab (tải lại trang là mất cùng mọi dữ liệu bộ nhớ).
 */
let marker = false;

export const LOCAL_WIPE_FILE_STEPS = {
  hasMarker: () => marker,
  setMarker: () => (marker = true),
  deleteEvidenceFiles: () => true,
  clearMarker: () => !(marker = false),
} as const;
