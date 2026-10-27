import { Stack } from 'expo-router';

import { AppProviders } from '@/bootstrap/Providers';

/**
 * Route gốc (UI-A01..). Route chỉ nối đường dẫn với màn hình ở `features/<tên>/ui`; không chứa logic.
 * Nhóm `(tabs)` có thanh tab; mọi route ngoài nhóm đó (quay, tranh chấp, tài khoản, thiết lập)
 * không có thanh tab. Màn quay tắt cử chỉ vuốt quay lại để không rời nhầm (docs/09 mục 2).
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="record-pack" options={{ gestureEnabled: false }} />
        <Stack.Screen name="record-return" options={{ gestureEnabled: false }} />
      </Stack>
    </AppProviders>
  );
}
