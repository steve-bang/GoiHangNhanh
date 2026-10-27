import { useFocusEffect, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

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
 * Trả hàm `isActive()`: true khi màn hình còn được hiển thị (đang focus, chưa bị gỡ). Dùng sau một
 * thao tác bất đồng bộ để KHÔNG điều hướng/đặt trạng thái nếu người dùng đã bấm Back hoặc đi chỗ
 * khác trong lúc chờ. Không chặn việc rời màn. Dựa trên `useFocusEffect` của Expo Router.
 */
export function useIsScreenActive(): () => boolean {
  const activeRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      return () => {
        activeRef.current = false;
      };
    }, []),
  );
  return useCallback(() => activeRef.current, []);
}

/**
 * true khi màn đang hiển thị trên cùng (focus). Màn quét dùng để TẮT camera khi có màn khác phủ lên
 * (đang tạo đơn, mở trợ giúp) và bật lại khi quay về, thay vì quét ngầm.
 */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
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
