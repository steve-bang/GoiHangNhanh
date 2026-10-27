import * as SplashScreen from 'expo-splash-screen';

/**
 * Adapter splash hệ điều hành (expo-splash-screen). Gọi `holdNativeSplash()` một lần ở module gốc
 * (`src/app/_layout.tsx`) để giữ splash hệ điều hành tới khi màn Splash của app sẵn sàng; sau đó gọi
 * `hideNativeSplash()` (an toàn khi gọi nhiều lần). KHÔNG giữ để chờ cổng phiên. Mọi lỗi bị nuốt:
 * splash hệ điều hành không bao giờ được làm app không mở được. `fade` chỉ có tác dụng trên iOS;
 * Android 12+ không hỗ trợ hiệu ứng này (platform-support.md).
 */
export function holdNativeSplash(): void {
  try {
    SplashScreen.setOptions({ duration: 250, fade: true });
    void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  } catch {
    // Không có mô-đun native (ví dụ chạy trên web/Jest): bỏ qua.
  }
}

export function hideNativeSplash(): void {
  try {
    void SplashScreen.hideAsync().catch(() => undefined);
  } catch {
    // Như trên.
  }
}
