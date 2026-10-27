import type { SocialProvider } from '@/core/config/feature-flags';
import type { OrderSource } from '@/core/orders/order-source';

/** Tài khoản sau khi máy chủ xác nhận đã tạo. `emailVerified` false là bình thường ở bước này. */
export interface AuthAccount {
  readonly uid: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

/** Tài khoản sau khi đăng nhập: cho biết đã có shop chưa để biết đi Tổng quan hay tạo shop. */
export interface SignedInAccount extends AuthAccount {
  readonly hasShop: boolean;
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
export interface AuthGateway {
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
   * Xin mã đặt lại mật khẩu. TRUNG TÍNH: resolve như nhau dù email có tài khoản hay không (không tiết
   * lộ email đã đăng ký). `retryAfterSeconds`: bao lâu nữa được xin lại. Cách gửi mã thật chưa
   * chốt (O-22, decisions.md Q-14); giới hạn số lần xin phải nằm ở phía máy chủ.
   */
  requestPasswordRecovery(email: string): Promise<{ retryAfterSeconds?: number }>;
  /** Mã sai/hết hạn/quá số lần: `AUTH_OTP_INVALID` / `AUTH_OTP_EXPIRED` / `AUTH_TOO_MANY_REQUESTS`. */
  verifyRecoveryCode(input: VerifyRecoveryCodeInput): Promise<{ ticket: string }>;
  /** Phiên đặt lại hết hạn: `AUTH_RESET_SESSION_EXPIRED`. Máy chủ phải thu hồi phiên cũ khi thành công. */
  resetPassword(input: ResetPasswordInput): Promise<void>;
}

export interface CreateShopInput {
  /** Đã bỏ khoảng trắng đầu/cuối, 1-50 ký tự. */
  readonly name: string;
  /** Có thể rỗng (nguồn bán bỏ qua được). Không trùng, theo thứ tự chuẩn. */
  readonly sellingSources: readonly OrderSource[];
}

export interface CreatedShop {
  readonly id: string;
  readonly name: string;
  readonly sellingSources: readonly OrderSource[];
}

/**
 * Cổng tạo shop (port). Bản thật là Cloud Function callable `createShop` (ghi `members` + nhật ký
 * kiểm toán, architecture.md): chỉ resolve khi máy chủ xác nhận.
 */
export interface ShopGateway {
  createShop(input: CreateShopInput): Promise<CreatedShop>;
}

export interface Gateways {
  readonly auth: AuthGateway;
  readonly shop: ShopGateway;
}
