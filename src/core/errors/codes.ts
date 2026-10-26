/**
 * Mã lỗi nghiệp vụ. CHỈ chứa mã đã có trong docs/04 và docs/05.
 * Cần mã mới -> đề xuất để BA đưa vào tài liệu trước (xem docs/engineering/decisions.md, mục
 * "Mã lỗi đề xuất"), không tự đặt rời rạc trong mã.
 */
export const ERROR_CODES = {
  // docs/04 - A02
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_DUPLICATE: 'ORDER_DUPLICATE',
  INVALID_CODE: 'INVALID_CODE',
  SEARCH_UNAVAILABLE: 'SEARCH_UNAVAILABLE',
  // docs/04 - A04
  CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
  MIC_PERMISSION_DENIED: 'MIC_PERMISSION_DENIED',
  INSUFFICIENT_STORAGE: 'INSUFFICIENT_STORAGE',
  LOCAL_SAVE_UNAVAILABLE: 'LOCAL_SAVE_UNAVAILABLE',
  // docs/05 - B01
  RETURN_LIST_UNAVAILABLE: 'RETURN_LIST_UNAVAILABLE',
  RETURN_SESSION_INTERRUPTED: 'RETURN_SESSION_INTERRUPTED',
  RETURN_UPLOAD_PENDING: 'RETURN_UPLOAD_PENDING',
  // docs/05 - B02
  SOURCE_ORDER_NOT_FOUND: 'SOURCE_ORDER_NOT_FOUND',
  SOURCE_ORDER_AMBIGUOUS: 'SOURCE_ORDER_AMBIGUOUS',
  RETURN_CODE_DUPLICATE: 'RETURN_CODE_DUPLICATE',
  RETURN_ORDER_CONFLICT: 'RETURN_ORDER_CONFLICT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Mã mà docs chỉ mô tả "hành vi" chứ chưa có câu thông báo người dùng (docs/05 - B01).
 * Chưa có khóa i18n `errors.<CODE>` cho các mã này; BA cần bổ sung thông báo ba phần.
 */
export const CODES_WITHOUT_DOCUMENTED_MESSAGE: readonly ErrorCode[] = [
  ERROR_CODES.RETURN_LIST_UNAVAILABLE,
  ERROR_CODES.RETURN_SESSION_INTERRUPTED,
  ERROR_CODES.RETURN_UPLOAD_PENDING,
];
