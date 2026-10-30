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
 * Nhóm hiển thị trên UI-I01. `shopAndPlan`: mục `plan` được màn dựng thành thẻ gói (HeroCard; hôm nay `hidden`, Q-21ag), các mục
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
    // Ẩn theo yêu cầu người dùng (Q-21ag): chưa có dữ liệu gói/thanh toán (O-06, O-16). Ẩn cả mục menu lẫn thẻ gói
    // ở UI-I01. Mã và route UI-H01 giữ nguyên; bật lại: đổi dòng này thành 'available'.
    availability: 'hidden',
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
    // Ẩn ở v1 (V1-05, decisions.md Q-29 / V1-05): app chưa gửi thông báo nào và bản Firebase chưa có nơi lưu
    // lựa chọn, nên không mời người dùng chỉnh cài đặt không có tác dụng. Màn UI-I04 và route giữ nguyên (Q-21ab);
    // bật lại: đổi dòng này thành 'available' khi có thông báo đẩy và nơi lưu thật.
    availability: 'hidden',
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
    // Bật vì UI-I06 đã có Trung tâm trợ giúp với bài viết tĩnh trung thực, Liên hệ hỗ trợ và Điều khoản (khóa "Sắp có" khi chưa có URL).
    availability: 'available',
  },
];

/** Các mục hiện được của một nhóm (bỏ mục `hidden`), giữ thứ tự khai báo. */
export function visibleMenuItems(group: MenuGroupId): readonly MenuItem[] {
  return ACCOUNT_MENU.filter((item) => item.group === group && item.availability !== 'hidden');
}

/** Mục `plan` của menu (thẻ gói trên UI-I01 chỉ hiện khi `availability` của nó khác `hidden`). */
export function planMenuItem(): MenuItem {
  const item = ACCOUNT_MENU.find((entry) => entry.id === 'plan');
  if (!item) throw new Error('ACCOUNT_MENU thiếu mục plan');
  return item;
}
