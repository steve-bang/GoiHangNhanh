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
  /** Vừa đặt lại mật khẩu xong: màn Đăng nhập hiện banner thành công MỘT lần rồi xóa cờ. */
  readonly resetNotice: boolean;
}

export const INITIAL_RECOVERY_STATE: RecoveryState = {
  email: '',
  requestedEmail: null,
  resendAvailableAt: null,
  ticket: null,
  resetNotice: false,
};

export type RecoveryAction =
  | { type: 'email_changed'; email: string }
  | { type: 'code_requested'; email: string; resendAvailableAt: number }
  | { type: 'code_verified'; ticket: string }
  | { type: 'reset_completed' }
  | { type: 'notice_consumed' }
  | { type: 'reset' };

export function recoveryReducer(state: RecoveryState, action: RecoveryAction): RecoveryState {
  switch (action.type) {
    case 'email_changed':
      return { ...state, email: action.email };
    case 'code_requested':
      // Xin mã (lại) làm vé cũ vô hiệu: phải nhập mã mới.
      return {
        ...state,
        requestedEmail: action.email,
        resendAvailableAt: action.resendAvailableAt,
        ticket: null,
      };
    case 'code_verified':
      return { ...state, ticket: action.ticket };
    case 'reset_completed':
      return { ...INITIAL_RECOVERY_STATE, resetNotice: true };
    case 'notice_consumed':
      return { ...state, resetNotice: false };
    case 'reset':
      return INITIAL_RECOVERY_STATE;
  }
}
