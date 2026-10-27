import { ROUTES, type RouteDef } from '@/core/navigation';
import type { IconName } from '@/shared/ui';

export interface TabDefinition {
  /** Tên tệp/thư mục của tab trong `src/app/(tabs)/` (cũng là tên màn của navigator). */
  readonly name: string;
  readonly route: RouteDef;
  readonly labelKey: `nav:tabs.${string}`;
  readonly icon: IconName;
  /**
   * `action`: nút nổi giữa thanh tab, KHÔNG chuyển tab: bấm là mở `route` (màn quét, toàn màn hình,
   * ẩn thanh tab). Tệp `(tabs)/<name>.tsx` chỉ là chỗ giữ cho navigator, không bao giờ hiển thị.
   */
  readonly action?: true;
}

/**
 * CẤU HÌNH THANH TAB DƯỚI - MỘT NƠI DUY NHẤT. Theo mẫu thiết kế docs/assets/ui/02-home-and-scan.png
 * (người dùng duyệt, D-16; thay D-11 và chốt O-18): Trang chủ · Đơn hàng · Quét (giữa) · Thông báo ·
 * Cá nhân. Hàng hoàn và Đồng bộ không còn là tab: vào từ Trang chủ (`ROUTES.returns`, `ROUTES.sync`).
 * `(tabs)/_layout.tsx` đọc danh sách này nên thêm/bớt tab không phải sửa layout.
 */
export const TAB_CONFIG = [
  { name: 'home', route: ROUTES.home, labelKey: 'nav:tabs.home', icon: 'home' },
  { name: 'orders', route: ROUTES.orders, labelKey: 'nav:tabs.orders', icon: 'orders' },
  {
    name: 'scan-tab',
    route: ROUTES.scan,
    labelKey: 'nav:tabs.scan',
    icon: 'scan',
    action: true,
  },
  {
    name: 'notifications',
    route: ROUTES.notificationList,
    labelKey: 'nav:tabs.notifications',
    icon: 'notifications',
  },
  { name: 'account', route: ROUTES.profile, labelKey: 'nav:tabs.account', icon: 'user' },
] as const satisfies readonly TabDefinition[];
