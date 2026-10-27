/**
 * Trạng thái luồng Quên mật khẩu -> Nhập mã -> Mật khẩu mới (UI-A07, A08, A09). CHỈ nằm trong bộ
 * nhớ của phiên chạy app: không lưu đĩa, không log (chứa "vé" xác minh). KHÔNG chứa mật khẩu hay mã
 * OTP người dùng đang gõ (các giá trị đó chỉ ở state cục bộ của từng màn).
 */
export interface RecoveryState {
  /** Email đang gõ ở màn Quên mật khẩu (giữ khi quay lại bằng "Thay đổi thông tin"). */
  readonly email: string;
  /** Có khi cổng đã nhận yêu cầu gửi mã cho email này: điều kiện để vào màn Nhập mã. */
  readonly requestedEmail: string | null;
  /** Mốc (ms) được xin lại mã; đếm ngược tính từ mốc này, không cộng dồn. */
  readonly resendAvailableAt: number | null;
  /** "Vé" sau khi mã đúng: điều kiện để vào màn Mật khẩu mới. */
  readonly ticket: string | null;
  /** Mốc (ms) vé hết hạn nếu cổng báo hạn dùng; null = cổng không báo (máy chủ vẫn kiểm tra). */
  readonly ticketExpiresAt: number | null;
  /** Vừa đặt lại mật khẩu xong: màn Đăng nhập hiện banner thành công MỘT lần rồi xóa cờ. */
  readonly resetNotice: boolean;
  /**
   * Email điền sẵn cho màn Đăng nhập, dùng MỘT lần (màn Đăng nhập xóa sau khi lấy). Thay cho việc
   * đặt email vào tham số điều hướng/URL. Chỉ email, không bao giờ mật khẩu.
   */
  readonly signInEmail: string | null;
}

export const INITIAL_RECOVERY_STATE: RecoveryState = {
  email: '',
  requestedEmail: null,
  resendAvailableAt: null,
  ticket: null,
  ticketExpiresAt: null,
  resetNotice: false,
  signInEmail: null,
};

export type RecoveryAction =
  | { type: 'email_changed'; email: string }
  | { type: 'code_requested'; email: string; resendAvailableAt: number }
  | { type: 'code_verified'; ticket: string; ticketExpiresAt?: number | null }
  | { type: 'ticket_expired' }
  /** Người dùng rời luồng khôi phục (về Đăng nhập/Chào mừng): các điều kiện vào màn sau bị xóa. */
  | { type: 'left_flow' }
  | { type: 'reset_completed' }
  | { type: 'signin_email_set'; email: string }
  | { type: 'signin_email_consumed' }
  | { type: 'notice_consumed' }
  | { type: 'reset' };

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Xóa mọi thứ cho phép vào màn Nhập mã/Mật khẩu mới (docs/09 mục 5.6: không vào được khi chưa xin mã). */
function clearGates(state: RecoveryState): RecoveryState {
  return {
    ...state,
    requestedEmail: null,
    resendAvailableAt: null,
    ticket: null,
    ticketExpiresAt: null,
  };
}

export function recoveryReducer(state: RecoveryState, action: RecoveryAction): RecoveryState {
  switch (action.type) {
    case 'email_changed':
      // Đổi sang email khác: mã đã gửi/vé của email cũ không còn dùng được.
      return state.requestedEmail !== null && !sameEmail(state.requestedEmail, action.email)
        ? { ...clearGates(state), email: action.email }
        : { ...state, email: action.email };
    case 'code_requested':
      // Xin mã (lại) làm vé cũ vô hiệu: phải nhập mã mới.
      return {
        ...state,
        requestedEmail: action.email,
        resendAvailableAt: action.resendAvailableAt,
        ticket: null,
        ticketExpiresAt: null,
      };
    case 'code_verified':
      return { ...state, ticket: action.ticket, ticketExpiresAt: action.ticketExpiresAt ?? null };
    case 'ticket_expired':
      return { ...state, ticket: null, ticketExpiresAt: null };
    case 'left_flow':
      return clearGates(state);
    case 'reset_completed':
      // Về Đăng nhập với email vừa đặt lại; mọi điều kiện vào các màn khôi phục bị xóa.
      return { ...INITIAL_RECOVERY_STATE, resetNotice: true, signInEmail: state.requestedEmail };
    case 'signin_email_set':
      return { ...state, signInEmail: action.email };
    case 'signin_email_consumed':
      return { ...state, signInEmail: null };
    case 'notice_consumed':
      return { ...state, resetNotice: false };
    case 'reset':
      return INITIAL_RECOVERY_STATE;
  }
}
