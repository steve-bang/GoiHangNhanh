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
}
