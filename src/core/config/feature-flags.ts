/**
 * Cờ cấu hình tính năng: đổi ở MỘT nơi này (docs/engineering/layout.md mục "Cờ cấu hình").
 * TypeScript thuần; không đọc môi trường lúc chạy.
 */
export const SOCIAL_PROVIDERS = ['apple', 'google'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * Nút đăng nhập bằng Apple/Google ở Chào mừng (UI-A02), Đăng nhập, Đăng ký (UI-A03). v1 TẮT cả hai
 * trên mọi bản build (O-15 v1: chỉ email + mật khẩu; decisions.md Q-29 / V1-03): đăng nhập thật chưa
 * có nên không hiện nút không làm gì. Bật lại khi có luồng thật; Apple trên Android cần luồng web
 * riêng, chưa chốt (decisions.md Q-12).
 */
export const SOCIAL_SIGN_IN_FLAGS: Readonly<Record<SocialProvider, boolean>> = {
  apple: false,
  google: false,
};

/**
 * Cách lấy lại mật khẩu (D-14; decisions.md Q-29 / V1-03):
 * - `email_link`: v1. Firebase Auth gửi thư có đường dẫn đặt lại; mật khẩu mới đặt trên trang của
 *   Firebase. Quên mật khẩu (UI-A07) -> Kiểm tra hộp thư; màn Nhập mã (UI-A08) và Mật khẩu mới
 *   (UI-A09) không có lối vào (vào thẳng thì về Đăng nhập).
 * - `otp`: mã 6 số tự xây bằng Cloud Functions (hướng B của O-22), để sau v1; giao diện đã có.
 */
export type PasswordRecoveryMode = 'email_link' | 'otp';
export const PASSWORD_RECOVERY_MODE: PasswordRecoveryMode = 'email_link';

/** Danh sách nhà cung cấp đang bật, theo thứ tự hiển thị (Apple, Google). */
export function getEnabledSocialProviders(
  flags: Readonly<Record<SocialProvider, boolean>> = SOCIAL_SIGN_IN_FLAGS,
): readonly SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((provider) => flags[provider]);
}
