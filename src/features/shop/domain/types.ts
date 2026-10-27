import type { SocialProvider } from '@/core/config/feature-flags';
import type { OrderSource } from '@/core/orders/order-source';

/**
 * Nguồn bán của shop khi thiết lập (docs/09 UI-A04): cùng tập giá trị với nguồn của đơn. Lưu dưới
 * dạng giá trị enum (shopee | tiktok_shop | lazada | other), KHÔNG lưu chuỗi hiển thị. Do người dùng
 * chọn, không phải dữ liệu xác nhận từ sàn (CLAUDE.md #10).
 */
export type SellingSource = OrderSource;

/** Tài khoản sau khi máy chủ xác nhận đã tạo. `emailVerified` false là bình thường ở bước này. */
export interface AuthAccount {
  readonly uid: string;
  readonly email: string;
  readonly emailVerified: boolean;
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
}

export interface CreateShopInput {
  /** Đã bỏ khoảng trắng đầu/cuối, 1-50 ký tự. */
  readonly name: string;
  /** Có thể rỗng (nguồn bán bỏ qua được). Không trùng, theo thứ tự chuẩn. */
  readonly sellingSources: readonly SellingSource[];
}

export interface CreatedShop {
  readonly id: string;
  readonly name: string;
  readonly sellingSources: readonly SellingSource[];
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
