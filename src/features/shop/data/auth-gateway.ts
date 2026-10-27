import type { SocialProvider } from '@/core/config/feature-flags';

/**
 * Cổng xác thực (stub). Đăng nhập thật CHƯA có: phương thức đăng nhập là câu hỏi mở O-15. Hàm này
 * cố ý không làm gì: không gọi dịch vụ, không đổi trạng thái, không báo thành công. Khi O-15 được
 * chốt, thay thân hàm bằng luồng đăng nhập thật (Apple trên Android cần luồng web riêng).
 */
export async function signInWithProvider(provider: SocialProvider): Promise<void> {
  void provider;
}
