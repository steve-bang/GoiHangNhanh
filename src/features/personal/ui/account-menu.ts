import { ROUTES, type RouteDef } from '@/core/navigation';
import type { IconName } from '@/shared/ui';

/**
 * Trạng thái của một mục menu tab Cá nhân. MỘT CHỖ DUY NHẤT để bật/tắt mục:
 * - `available`: mở được.
 * - `coming_soon`: màn đích chưa làm; hàng bị khóa (không điều hướng) và có nhãn "Sắp có".
 * - `hidden`: không hiện (đặc tả chưa chốt, không dựng chức năng giả).
 * Khi PR tương ứng xong chỉ cần đổi `availability` của mục ở đây.
 */
export type MenuAvailability = 'available' | 'coming_soon' | 'hidden';

/**
 * Nhóm hiển thị trên UI-I01. `shopAndPlan`: mục `plan` được màn dựng thành thẻ gói (HeroCard), các mục
 * còn lại (nếu có) thành hàng dưới thẻ cửa hàng. Thẻ hồ sơ/cửa hàng/dữ liệu bằng chứng do màn dựng.
 */
export type MenuGroupId = 'shopAndPlan' | 'settings' | 'support';

export interface MenuItem {
  readonly id: string;
  readonly group: MenuGroupId;
  readonly route: RouteDef;
  readonly labelKey: `nav:account.${string}`;
  readonly icon: IconName;
  readonly availability: MenuAvailability;
}

export const ACCOUNT_MENU: readonly MenuItem[] = [
  {
    id: 'plan',
    group: 'shopAndPlan',
    route: ROUTES.plan,
    labelKey: 'nav:account.plan',
    icon: 'sparkle',
    // Bật vì UI-H01 đã có nội dung trung thực hữu ích (nguyên tắc lưu trữ, "Chưa có thông tin") và lối vào Chi tiết/Lịch sử.
    availability: 'available',
  },
  // Thành viên và quyền: mô hình thành viên/vai trò chưa chốt (O-03, O-07) nên không hiện.
  {
    id: 'members',
    group: 'shopAndPlan',
    route: ROUTES.members,
    labelKey: 'nav:account.members',
    icon: 'user',
    availability: 'hidden',
  },
  {
    id: 'notifications',
    group: 'settings',
    route: ROUTES.notifications,
    labelKey: 'nav:account.notifications',
    icon: 'notifications',
    // Bật vì UI-I04 đã có bốn công tắc lưu qua cổng cài đặt và nói rõ thông báo đẩy sắp có (Q-21ab).
    availability: 'available',
  },
  {
    id: 'security',
    group: 'settings',
    route: ROUTES.security,
    labelKey: 'nav:account.security',
    icon: 'lock',
    // Bật vì UI-I05 có Đổi mật khẩu thật (tài khoản mật khẩu); các hàng chưa làm tự khóa "Sắp có" trong màn.
    availability: 'available',
  },
  {
    id: 'help',
    group: 'support',
    route: ROUTES.help,
    labelKey: 'nav:account.help',
    icon: 'help',
    availability: 'coming_soon',
  },
];

/** Các mục hiện được của một nhóm (bỏ mục `hidden`), giữ thứ tự khai báo. */
export function visibleMenuItems(group: MenuGroupId): readonly MenuItem[] {
  return ACCOUNT_MENU.filter((item) => item.group === group && item.availability !== 'hidden');
}

/** Mục `plan` của menu (thẻ gói trên UI-I01 theo dõi `availability` của nó). */
export function planMenuItem(): MenuItem {
  const item = ACCOUNT_MENU.find((entry) => entry.id === 'plan');
  if (!item) throw new Error('ACCOUNT_MENU thiếu mục plan');
  return item;
}
