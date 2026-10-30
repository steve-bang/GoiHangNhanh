import type { SocialProvider } from '@/core/config/feature-flags';

/** Tài khoản sau khi máy chủ xác nhận đã tạo. `emailVerified` false là bình thường ở bước này. */
export interface AuthAccount {
  readonly uid: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

/** Cách tài khoản đăng nhập, suy ra từ nhà cung cấp của Auth (Apple/Google chưa nối: O-15). */
export type AccountSignInMethod = 'password' | 'apple' | 'google';

/** Tài khoản sau khi đăng nhập: cho biết đã có shop chưa để biết đi Tổng quan hay tạo shop. */
export interface SignedInAccount extends AuthAccount {
  /** Họ tên đã khai báo của tài khoản (nguồn: Auth); `null` = chưa khai báo (không bịa từ email). */
  readonly displayName: string | null;
  readonly hasShop: boolean;
  /** ID shop đang dùng của tài khoản (nguồn: máy chủ); `null` = chưa có shop. `hasShop` = `shopId !== null`. */
  readonly shopId: string | null;
}

export interface SignInWithPasswordInput {
  readonly email: string;
  readonly password: string;
}

export interface VerifyRecoveryCodeInput {
  readonly email: string;
  /** Đúng 6 chữ số. */
  readonly code: string;
}

export interface VerifiedRecovery {
  readonly ticket: string;
  /** Vé còn dùng được bao lâu (giây). Có thì app không cho vào màn Mật khẩu mới khi vé đã quá hạn. */
  readonly expiresInSeconds?: number;
}

export interface ResetPasswordInput {
  /** "Vé" do `verifyRecoveryCode` trả về; chỉ giữ trong bộ nhớ luồng. */
  readonly ticket: string;
  readonly newPassword: string;
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface DeleteAccountInput {
  /** Mật khẩu hiện tại để xác thực lại; chỉ giữ trong bộ nhớ lời gọi, không log. */
  readonly password: string;
}

/**
 * Kết quả xóa tài khoản: `deleted` = máy chủ vừa xác nhận; `already_deleted` = tài khoản Auth không còn
 * (lần gọi trước đã xóa xong nhưng app không nhận được xác nhận, hoặc máy chủ tự hoàn tất). Cả hai đều cho
 * phép xóa dữ liệu trên máy (sau khi đọc lại điều kiện).
 */
export type DeleteAccountOutcome = 'deleted' | 'already_deleted';

export interface SignUpWithEmailInput {
  readonly email: string;
  readonly password: string;
}

/**
 * Cổng xác thực (port). Lỗi nghiệp vụ được ném dưới dạng `AppError` (mã `AUTH_*`); màn hình không
 * biết SDK nào đứng sau. Bản thật (Firebase Auth) chưa có: xem decisions.md Q-13.
 */
export interface AuthApi {
  /** Chỉ resolve khi máy chủ đã xác nhận tạo tài khoản. */
  signUpWithEmail(input: SignUpWithEmailInput): Promise<AuthAccount>;
  /**
   * Đăng nhập/đăng ký bằng Apple hoặc Google. Chưa có luồng thật (O-15): resolve KHÔNG có nghĩa là
   * đã đăng nhập; bên gọi không được báo thành công hay điều hướng dựa vào kết quả này.
   */
  signInWithProvider(provider: SocialProvider): Promise<void>;
  /** Chỉ resolve khi máy chủ xác nhận đúng email + mật khẩu. Sai thông tin: `AUTH_INVALID_CREDENTIALS`. */
  signInWithPassword(input: SignInWithPasswordInput): Promise<SignedInAccount>;
  /**
   * Xin đặt lại mật khẩu cho email. TRUNG TÍNH: resolve như nhau dù email có tài khoản hay không (không
   * tiết lộ email đã đăng ký). `retryAfterSeconds`: bao lâu nữa được xin lại. v1 (`PASSWORD_RECOVERY_MODE
   * = 'email_link'`, D-14): Firebase gửi thư có đường dẫn đặt lại; chế độ `otp` (mã 6 số, O-22 hướng
   * B) để sau. Giới hạn số lần xin phải nằm ở phía máy chủ (decisions.md Q-14, Q-29 / V1-03).
   */
  requestPasswordRecovery(email: string): Promise<{ retryAfterSeconds?: number }>;
  /** Mã sai/hết hạn/quá số lần: `AUTH_OTP_INVALID` / `AUTH_OTP_EXPIRED` / `AUTH_TOO_MANY_REQUESTS`. */
  verifyRecoveryCode(input: VerifyRecoveryCodeInput): Promise<VerifiedRecovery>;
  /** Phiên đặt lại hết hạn: `AUTH_RESET_SESSION_EXPIRED`. Máy chủ phải thu hồi phiên cũ khi thành công. */
  resetPassword(input: ResetPasswordInput): Promise<void>;
  /**
   * Thoát tài khoản thật (xóa phiên Auth trên máy). Chỉ resolve khi đã thoát; lỗi thì ném `AppError`
   * và bên gọi KHÔNG được xả phiên (không báo đăng xuất giả). Không xóa dữ liệu cục bộ (Q-20h).
   */
  signOut(): Promise<void>;
  /**
   * Đổi mật khẩu của tài khoản đang đăng nhập: xác thực lại bằng mật khẩu hiện tại rồi đặt mật khẩu
   * mới. Chỉ resolve khi máy chủ xác nhận. Lỗi: `AUTH_WRONG_CURRENT_PASSWORD`, `AUTH_WEAK_PASSWORD`,
   * `AUTH_REQUIRES_RECENT_LOGIN`, `AUTH_SESSION_EXPIRED` (không còn phiên), `AUTH_TOO_MANY_REQUESTS`,
   * `AUTH_NETWORK_ERROR`. Không log, không giữ mật khẩu (V1-05).
   */
  changePassword(input: ChangePasswordInput): Promise<void>;
  /**
   * Đổi họ tên hiển thị của tài khoản đang đăng nhập (nguồn: Auth). Bên gọi đã chuẩn hóa tên. Chỉ
   * resolve khi máy chủ xác nhận; trả tên máy chủ đã nhận. Không còn phiên: `AUTH_SESSION_EXPIRED`.
   */
  updateDisplayName(displayName: string): Promise<{ readonly displayName: string }>;
  /**
   * Xóa tài khoản đang đăng nhập (V1-15; máy chủ V1-14): xác thực lại bằng mật khẩu, lấy ID token mới
   * (máy chủ đòi `auth_time` trong 5 phút) rồi gọi Function `deleteAccount`. CHỈ resolve khi máy chủ xác
   * nhận đã ghi nhận yêu cầu (tài khoản bị khóa ngay, dữ liệu cửa hàng trên máy chủ bị xóa hẳn sau 30
   * ngày, trừ khi phải giữ lại vì lý do pháp lý hoặc tranh chấp đang mở), hoặc khi tài khoản đã không còn
   * (`already_deleted`). Lỗi TRƯỚC khi gửi lời gọi xóa (chắc chắn chưa xóa gì): `AUTH_WRONG_CURRENT_PASSWORD`,
   * `AUTH_SESSION_EXPIRED`, `AUTH_TOO_MANY_REQUESTS`, `AUTH_NETWORK_ERROR`, `AUTH_SERVICE_UNAVAILABLE`.
   * Máy chủ từ chối có lý do (không đổi gì): `AUTH_REQUIRES_RECENT_LOGIN`, `ACCOUNT_DELETE_SHOP_HAS_MEMBERS`.
   * Đã gửi mà không có xác nhận rõ: `ACCOUNT_DELETE_UNCONFIRMED` (có thể đã xóa; thử lại sẽ ra
   * `already_deleted`). Hàm này KHÔNG xóa gì trên máy.
   */
  deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountOutcome>;
}
