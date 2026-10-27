import { Redirect } from 'expo-router';

import { ROUTES } from '@/core/navigation';

/**
 * UI-A01 Splash. Hiện chỉ chuyển sang Tổng quan: kiểm tra phiên/shop/đồng bộ ở nền và màn splash
 * thật thuộc tính năng shop (đăng nhập, O-15). Chưa có luồng đăng nhập nên chưa chặn truy cập.
 */
export default function SplashRoute() {
  return <Redirect href={ROUTES.home.path} />;
}
