import { useEffect, useRef } from 'react';

import type { RouteDef } from '@/core/navigation';

import {
  isSessionState,
  resolveLaunchRoute,
  SESSION_FALLBACK,
  SPLASH_MAX_WAIT_MS,
  SPLASH_MIN_VISIBLE_MS,
} from '../../domain/launch';
import type { SessionGateway, SessionState } from '../../domain/types';

interface SplashLaunchOptions {
  session: SessionGateway;
  /**
   * Splash của app đã thật sự hiện ra (ảnh minh họa tải xong/lỗi, hoặc không cần ảnh, hoặc quá hạn
   * bảo hiểm). Đồng hồ hiển thị tối thiểu chỉ chạy từ lúc này; `restore()` thì chạy ngay khi mở app.
   */
  visible: boolean;
  /** Gọi ĐÚNG MỘT LẦN khi hết Splash, với màn đầu tiên cần mở. */
  onRoute: (route: RouteDef) => void;
  minVisibleMs?: number;
  maxWaitMs?: number;
}

interface LaunchController {
  markVisible: () => void;
  dispose: () => void;
}

/**
 * Cổng khởi động của Splash: khôi phục phiên song song với thời gian hiển thị tối thiểu.
 * `T = max(visibleStart + minVisibleMs, min(restoreDoneAt, launchAt + maxWaitMs))`:
 * - `restore()` gọi ngay khi mở app (song song với việc tải ảnh); hạn chờ phiên `maxWaitMs` tính
 *   từ lúc mở app. Cổng lỗi, trả giá trị lạ hoặc quá hạn => `SESSION_FALLBACK` (chưa đăng nhập);
 *   không bao giờ báo đã đăng nhập khi chưa có xác nhận. Quá hạn rồi thì kết quả đến muộn bị bỏ.
 * - `minVisibleMs` tính từ lúc `visible` thành true (Splash của app thật sự hiện), nên splash hệ
 *   điều hành còn che thì chưa tính. Không bao giờ chuyển trước khi Splash hiện đủ `minVisibleMs`.
 * Dọn mọi timer khi gỡ màn; chịu được StrictMode (effect chạy hai lần) và chỉ chuyển một lần.
 */
export function useSplashLaunch({
  session,
  visible,
  onRoute,
  minVisibleMs = SPLASH_MIN_VISIBLE_MS,
  maxWaitMs = SPLASH_MAX_WAIT_MS,
}: SplashLaunchOptions): void {
  const sessionRef = useRef(session);
  const onRouteRef = useRef(onRoute);
  const controllerRef = useRef<LaunchController | null>(null);

  useEffect(() => {
    onRouteRef.current = onRoute;
  });

  useEffect(() => {
    let finished = false;
    let minElapsed = false;
    let minStarted = false;
    let resolved: SessionState | null = null;
    let minTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
    const tryFinish = () => {
      if (finished || resolved === null || !minElapsed) return;
      finished = true;
      clearTimers();
      onRouteRef.current(resolveLaunchRoute(resolved));
    };
    const resolve = (state: SessionState) => {
      if (resolved !== null) return;
      resolved = state;
      tryFinish();
    };

    const maxTimer = setTimeout(() => resolve(SESSION_FALLBACK), maxWaitMs);

    // Bọc trong Promise để lỗi ném đồng bộ của cổng cũng được xử lý như lỗi thường.
    void Promise.resolve()
      .then(() => sessionRef.current.restore())
      .then(
        (state) => resolve(isSessionState(state) ? state : SESSION_FALLBACK),
        () => resolve(SESSION_FALLBACK),
      );

    controllerRef.current = {
      markVisible: () => {
        if (minStarted || finished) return;
        minStarted = true;
        minTimer = setTimeout(() => {
          minElapsed = true;
          tryFinish();
        }, minVisibleMs);
      },
      dispose: () => {
        finished = true;
        clearTimers();
      },
    };

    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [minVisibleMs, maxWaitMs]);

  // Khai báo sau effect trên để StrictMode (chạy lại toàn bộ effect) gắn lại vào controller mới.
  useEffect(() => {
    if (visible) controllerRef.current?.markVisible();
  }, [visible, minVisibleMs, maxWaitMs]);
}
