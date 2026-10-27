import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { ROUTES, type RouteDef } from '@/core/navigation';

/**
 * Adapter mỏng trên Expo Router (ADR-008): màn hình chỉ biết `RouteDef` từ `core/navigation`, nên
 * đổi thư viện điều hướng chỉ sửa tệp này. Tham số route là chuỗi.
 */
export type RouteParams = Readonly<Record<string, string>>;

export interface AppNavigation {
  push: (route: RouteDef, params?: RouteParams) => void;
  replace: (route: RouteDef, params?: RouteParams) => void;
  /**
   * Bỏ MỌI màn trong lịch sử điều hướng rồi hiển thị `route` (kết thúc một luồng, ví dụ thiết lập
   * tài khoản xong thì vào Tổng quan và nút Back không quay lại được các màn thiết lập).
   */
  reset: (route: RouteDef, params?: RouteParams) => void;
  /** Quay lại; không có lịch sử (mở từ liên kết sâu) thì về Tổng quan để luôn có đường lui an toàn. */
  back: () => void;
}

export function useAppNavigation(): AppNavigation {
  const router = useRouter();
  return useMemo(
    () => ({
      push: (route, params) => router.push({ pathname: route.path, params: params ?? {} }),
      replace: (route, params) => router.replace({ pathname: route.path, params: params ?? {} }),
      reset: (route, params) => {
        if (router.canDismiss()) router.dismissAll();
        router.replace({ pathname: route.path, params: params ?? {} });
      },
      back: () => {
        if (router.canGoBack()) router.back();
        else router.replace(ROUTES.home.path);
      },
    }),
    [router],
  );
}

/** Tham số của route hiện tại (giá trị mảng bị bỏ; chỉ dùng tham số chuỗi). */
export function useRouteParams(): Readonly<Record<string, string | undefined>> {
  const raw = useLocalSearchParams();
  return useMemo(() => {
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(raw)) {
      out[key] = Array.isArray(value) ? value[0] : value;
    }
    return out;
  }, [raw]);
}

/**
 * Chặn rời màn hình (nút Back, cử chỉ, `router.back`, `replace`) khi `enabled`, gọi `onAttempt` để
 * UI hiện hộp thoại cảnh báo. `allowLeave()` tắt chặn (gọi TRƯỚC khi điều hướng đi nơi khác, sau khi
 * người dùng xác nhận). Dùng cho màn quay: rời khi đang quay phải đi qua cảnh báo (docs/09 mục 2,
 * docs/04 quy tắc chung). Dựa trên `usePreventRemove` của Expo Router.
 */
export function useConfirmBeforeLeave(
  enabled: boolean,
  onAttempt: () => void,
): { allowLeave: () => void } {
  const disablePrevention = usePreventRemove(enabled, onAttempt);
  return { allowLeave: disablePrevention };
}
