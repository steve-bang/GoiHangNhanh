/**
 * Cờ cấu hình tính năng: đổi ở MỘT nơi này (docs/engineering/layout.md mục "Cờ cấu hình").
 * TypeScript thuần; không đọc môi trường lúc chạy.
 */
export const SOCIAL_PROVIDERS = ['apple', 'google'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * Nút đăng nhập bằng Apple/Google ở màn Chào mừng (UI-A02). Mặc định BẬT cho cả hai, trên cả iOS
 * và Android. Đăng nhập thật chưa có (O-15): nút chỉ gọi cổng xác thực rỗng. Apple trên Android
 * cần luồng web riêng, chưa chốt (decisions.md Q-12).
 */
export const SOCIAL_SIGN_IN_FLAGS: Readonly<Record<SocialProvider, boolean>> = {
  apple: true,
  google: true,
};

/** Danh sách nhà cung cấp đang bật, theo thứ tự hiển thị (Apple, Google). */
export function getEnabledSocialProviders(
  flags: Readonly<Record<SocialProvider, boolean>> = SOCIAL_SIGN_IN_FLAGS,
): readonly SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((provider) => flags[provider]);
}
