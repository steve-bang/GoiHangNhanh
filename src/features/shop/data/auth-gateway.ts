import type { SocialProvider } from '@/core/config/feature-flags';

import { getDefaultGateways } from './gateways';

/**
 * Đăng nhập bằng Apple/Google qua cổng mặc định. Chưa có luồng thật (O-15): bản giả không làm gì,
 * bản "chưa kết nối" ném `AUTH_SERVICE_UNAVAILABLE`. Kết quả KHÔNG có nghĩa là đã đăng nhập.
 * Màn hình có chỗ hiển thị lỗi (Tạo tài khoản) dùng cổng từ `OnboardingFlowProvider`.
 */
export async function signInWithProvider(provider: SocialProvider): Promise<void> {
  await getDefaultGateways().auth.signInWithProvider(provider);
}
