/**
 * Mã lỗi nghiệp vụ. Chứa mã đã có trong docs/04 và docs/05, cộng nhóm `AUTH_*` ĐỀ XUẤT cho màn thiết
 * lập tài khoản/shop, đăng nhập và đặt lại mật khẩu (UI-A03, A04, A07-A09), cùng `ORDER_SAVE_FAILED`,
 * `ORDER_HAS_SESSION`, `PACKAGE_SESSION_ACTIVE` cho lưu đơn cục bộ (UI-B04, UI-C01): tên chờ BA đặt
 * chính thức (decisions.md Q-04, Q-13, Q-14, Q-17), và 5 mã tab Cá nhân (Q-20i).
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
  // Đề xuất (chờ BA, ADR-020 R-14): kiểm tra sẵn sàng A04 thêm pin yếu và máy quá nóng
  BATTERY_LOW: 'BATTERY_LOW',
  DEVICE_OVERHEATED: 'DEVICE_OVERHEATED',
  // docs/05 - B01
  RETURN_LIST_UNAVAILABLE: 'RETURN_LIST_UNAVAILABLE',
  RETURN_SESSION_INTERRUPTED: 'RETURN_SESSION_INTERRUPTED',
  RETURN_UPLOAD_PENDING: 'RETURN_UPLOAD_PENDING',
  // docs/05 - B02
  SOURCE_ORDER_NOT_FOUND: 'SOURCE_ORDER_NOT_FOUND',
  SOURCE_ORDER_AMBIGUOUS: 'SOURCE_ORDER_AMBIGUOUS',
  RETURN_CODE_DUPLICATE: 'RETURN_CODE_DUPLICATE',
  RETURN_ORDER_CONFLICT: 'RETURN_ORDER_CONFLICT',
  // Đề xuất (chờ BA, R1 hàng hoàn): lưu hồ sơ hàng hoàn cục bộ; hồ sơ đã xác nhận không sửa được
  RETURN_SAVE_FAILED: 'RETURN_SAVE_FAILED',
  RETURN_ALREADY_CONFIRMED: 'RETURN_ALREADY_CONFIRMED',
  // Đề xuất (chờ BA, R2a hàng hoàn): chụp/lưu ảnh kiện lỗi, máy hết dung lượng, camera không mở được
  RETURN_PHOTO_FAILED: 'RETURN_PHOTO_FAILED',
  RETURN_PHOTO_STORAGE_FULL: 'RETURN_PHOTO_STORAGE_FULL',
  RETURN_CAMERA_UNAVAILABLE: 'RETURN_CAMERA_UNAVAILABLE',
  // Đề xuất (chờ BA, Q-26j): xóa ảnh chụp nhầm bị từ chối (ảnh đang nằm trong hồ sơ tranh chấp hoặc đã lên
  // máy chủ) hoặc không xóa được tệp trên máy
  RETURN_PHOTO_IN_USE: 'RETURN_PHOTO_IN_USE',
  RETURN_PHOTO_DELETE_FAILED: 'RETURN_PHOTO_DELETE_FAILED',
  // Đề xuất (chờ BA, Q-27): lưu hồ sơ tranh chấp cục bộ; hồ sơ đã đóng không sửa được
  DISPUTE_SAVE_FAILED: 'DISPUTE_SAVE_FAILED',
  DISPUTE_CLOSED: 'DISPUTE_CLOSED',
  // Đề xuất (chờ BA, Q-04/Q-17): lưu đơn/dòng/kiện cục bộ và quy tắc phiên (docs/04 A03)
  ORDER_SAVE_FAILED: 'ORDER_SAVE_FAILED',
  ORDER_HAS_SESSION: 'ORDER_HAS_SESSION',
  PACKAGE_SESSION_ACTIVE: 'PACKAGE_SESSION_ACTIVE',
  // Đề xuất (chờ BA, ADR-020 R-11, Q-23j): kiện đã quay xong / có lần quay dở thì không tạo phiên mới
  PACKAGE_ALREADY_RECORDED: 'PACKAGE_ALREADY_RECORDED',
  PACKAGE_RECORDING_UNFINISHED: 'PACKAGE_RECORDING_UNFINISHED',
  // Đề xuất (chờ BA, Q-04/Q-13): tạo tài khoản và tạo shop
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_SERVICE_UNAVAILABLE',
  AUTH_NETWORK_ERROR: 'AUTH_NETWORK_ERROR',
  AUTH_EMAIL_IN_USE: 'AUTH_EMAIL_IN_USE',
  AUTH_WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
  // Đề xuất (chờ BA, Q-04/Q-14): đăng nhập và đặt lại mật khẩu
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOO_MANY_REQUESTS: 'AUTH_TOO_MANY_REQUESTS',
  AUTH_OTP_INVALID: 'AUTH_OTP_INVALID',
  AUTH_OTP_EXPIRED: 'AUTH_OTP_EXPIRED',
  AUTH_RESET_SESSION_EXPIRED: 'AUTH_RESET_SESSION_EXPIRED',
  // Đề xuất (người dùng chốt tên, Q-20i): tab Cá nhân (đổi mật khẩu, đăng xuất, sửa hồ sơ)
  AUTH_WRONG_CURRENT_PASSWORD: 'AUTH_WRONG_CURRENT_PASSWORD',
  AUTH_REQUIRES_RECENT_LOGIN: 'AUTH_REQUIRES_RECENT_LOGIN',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_SIGN_OUT_FAILED: 'AUTH_SIGN_OUT_FAILED',
  PROFILE_SAVE_FAILED: 'PROFILE_SAVE_FAILED',
  // Đề xuất (chờ BA, Q-20n): quản lý cửa hàng (sửa tên, chuyển shop, thiếu quyền)
  SHOP_SAVE_FAILED: 'SHOP_SAVE_FAILED',
  SHOP_SWITCH_FAILED: 'SHOP_SWITCH_FAILED',
  SHOP_PERMISSION_DENIED: 'SHOP_PERMISSION_DENIED',
  // Đề xuất (chờ BA, Q-21ab): lưu lựa chọn thông báo (UI-I04)
  SETTINGS_SAVE_FAILED: 'SETTINGS_SAVE_FAILED',
  // Đề xuất (chờ BA, Q-21ae): không mở được ứng dụng email để soạn yêu cầu hỗ trợ (UI-I06)
  SUPPORT_MAIL_UNAVAILABLE: 'SUPPORT_MAIL_UNAVAILABLE',
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
