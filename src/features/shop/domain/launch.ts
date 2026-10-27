import { ROUTES, type RouteDef } from '@/core/navigation';

import type { SessionState } from './types';

/**
 * Thời gian màn Splash (UI-A01), đặt ở MỘT nơi để chỉnh. Splash hiện mỗi lần mở app, chỉ vài giây:
 * - tối thiểu `SPLASH_MIN_VISIBLE_MS` kể từ lúc Splash của app THẬT SỰ hiện (ảnh minh họa sẵn sàng,
 *   splash hệ điều hành đã ẩn), để người dùng kịp thấy thương hiệu, không nháy;
 * - chuyển khi cổng phiên xong VÀ đủ thời gian tối thiểu;
 * - cổng phiên không quá `SPLASH_MAX_WAIT_MS` kể từ lúc mở app (không phải lúc Splash hiện): quá
 *   hạn thì coi như chưa đăng nhập, không treo màn và không báo thành công giả (CLAUDE.md #3, #11);
 * - ảnh quá `SPLASH_HERO_MAX_WAIT_MS` thì coi như đã hiện (khớp đường bảo hiểm ở `_layout.tsx`).
 */
export const SPLASH_MIN_VISIBLE_MS = 2000;
export const SPLASH_MAX_WAIT_MS = 3000;
export const SPLASH_HERO_MAX_WAIT_MS = 4000;

/** Trạng thái dùng khi cổng phiên lỗi hoặc quá hạn: không bao giờ suy ra "đã đăng nhập". */
export const SESSION_FALLBACK: SessionState = 'signed_out';

/** Màn đầu tiên sau Splash theo trạng thái phiên (chưa chặn truy cập: route guard là việc sau). */
export function resolveLaunchRoute(state: SessionState): RouteDef {
  switch (state) {
    case 'signed_out':
      return ROUTES.welcome;
    case 'signed_in_no_shop':
      return ROUTES.createShop;
    case 'signed_in':
      return ROUTES.home;
  }
}

const SESSION_STATES: readonly SessionState[] = ['signed_out', 'signed_in_no_shop', 'signed_in'];

/** Giá trị cổng trả về có đúng là một trạng thái phiên không (cổng thật có thể trả sai kiểu). */
export function isSessionState(value: unknown): value is SessionState {
  return SESSION_STATES.includes(value as SessionState);
}
