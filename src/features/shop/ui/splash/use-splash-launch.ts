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
  /** Gọi ĐÚNG MỘT LẦN khi hết Splash, với màn đầu tiên cần mở. */
  onRoute: (route: RouteDef) => void;
  minVisibleMs?: number;
  maxWaitMs?: number;
}

/**
 * Cổng khởi động của Splash: khôi phục phiên song song với thời gian hiển thị tối thiểu. Chuyển
 * khi (phiên xong VÀ đủ `minVisibleMs`), nhưng không quá `maxWaitMs` kể từ khi hook chạy lần đầu
 * (màn hiện). Cổng lỗi, trả giá trị lạ hoặc quá hạn => coi như chưa đăng nhập (`SESSION_FALLBACK`);
 * không treo màn và không bao giờ báo đã đăng nhập khi chưa có xác nhận. Dọn timer khi màn gỡ.
 */
export function useSplashLaunch({
  session,
  onRoute,
  minVisibleMs = SPLASH_MIN_VISIBLE_MS,
  maxWaitMs = SPLASH_MAX_WAIT_MS,
}: SplashLaunchOptions): void {
  const sessionRef = useRef(session);
  const onRouteRef = useRef(onRoute);

  useEffect(() => {
    onRouteRef.current = onRoute;
  });

  useEffect(() => {
    let finished = false;
    let minElapsed = false;
    let restored: SessionState | null = null;

    const finish = (state: SessionState) => {
      if (finished) return;
      finished = true;
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      onRouteRef.current(resolveLaunchRoute(state));
    };
    const tryFinish = () => {
      if (restored !== null && minElapsed) finish(restored);
    };

    const minTimer = setTimeout(() => {
      minElapsed = true;
      tryFinish();
    }, minVisibleMs);
    const maxTimer = setTimeout(() => finish(SESSION_FALLBACK), maxWaitMs);

    // Bọc trong Promise để lỗi ném đồng bộ của cổng cũng được xử lý như lỗi thường.
    void Promise.resolve()
      .then(() => sessionRef.current.restore())
      .then(
        (state) => {
          restored = isSessionState(state) ? state : SESSION_FALLBACK;
        },
        () => {
          restored = SESSION_FALLBACK;
        },
      )
      .then(tryFinish);

    return () => {
      finished = true;
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [minVisibleMs, maxWaitMs]);
}
