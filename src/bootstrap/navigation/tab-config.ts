import { ROUTES, type RouteDef } from '@/core/navigation';
import type { IconName } from '@/shared/ui';

export interface TabDefinition {
  /** Tên thư mục của tab trong `src/app/(tabs)/` (cũng là tên màn của navigator). */
  readonly name: string;
  readonly route: RouteDef;
  readonly labelKey: `nav:tabs.${string}`;
  readonly icon: IconName;
}

/**
 * CẤU HÌNH THANH TAB DƯỚI - MỘT NƠI DUY NHẤT. Hiện là phương án đã ghi ở D-11 / docs/09 mục 2:
 * Tổng quan · Đơn hàng · Hàng hoàn · Đồng bộ (4 tab).
 *
 * O-18 (nút Quét ở giữa, mockup 02) CHƯA chốt, không theo mockup. Nếu chốt phương án khuyến nghị
 * (Tổng quan · Đơn hàng · Quét · Hàng hoàn · Đồng bộ): thêm một mục `scan` ở vị trí giữa (route
 * `ROUTES.scan`, thư mục `(tabs)/scan/`), chuyển `home/scan` sang đó, rồi sửa test `tab-config.test.ts`.
 * `(tabs)/_layout.tsx` đọc danh sách này nên không phải sửa.
 */
export const TAB_CONFIG = [
  { name: 'home', route: ROUTES.home, labelKey: 'nav:tabs.home', icon: 'home' },
  { name: 'orders', route: ROUTES.orders, labelKey: 'nav:tabs.orders', icon: 'orders' },
  { name: 'returns', route: ROUTES.returns, labelKey: 'nav:tabs.returns', icon: 'returns' },
  { name: 'sync', route: ROUTES.sync, labelKey: 'nav:tabs.sync', icon: 'sync' },
] as const satisfies readonly TabDefinition[];
