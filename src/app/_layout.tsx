// V1-16: cài handler lỗi JS đã lọc trước mọi module khác của app (bản build cho phép báo lỗi).
import '@/bootstrap/crash-reporting-early';

import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { AppProviders } from '@/bootstrap/Providers';
import { hideNativeSplash, holdNativeSplash } from '@/platform';

// Giữ splash hệ điều hành tới khi màn Splash của app (UI-A01) có ảnh; không giữ để chờ cổng phiên.
holdNativeSplash();

/** Mở thẳng một route khác `/` (liên kết sâu) thì Splash không chạy: vẫn phải ẩn splash hệ điều hành. */
const NATIVE_SPLASH_SAFETY_MS = 4000;

/**
 * Route gốc (UI-A01..). Route chỉ nối đường dẫn với màn hình ở `features/<tên>/ui`; không chứa logic.
 * Nhóm `(tabs)` có thanh tab; mọi route ngoài nhóm đó (quay, tranh chấp, tài khoản, thiết lập)
 * không có thanh tab. Màn quay tắt cử chỉ vuốt quay lại để không rời nhầm (docs/09 mục 2).
 */
export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(hideNativeSplash, NATIVE_SPLASH_SAFETY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="record-pack" options={{ gestureEnabled: false }} />
        <Stack.Screen name="record-return" options={{ gestureEnabled: false }} />
      </Stack>
    </AppProviders>
  );
}
