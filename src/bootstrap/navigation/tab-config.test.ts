import { ROUTES } from '@/core/navigation';
import resources from '@/core/i18n/locales/vi/nav.json';

import { TAB_CONFIG } from './tab-config';

describe('cấu hình thanh tab (D-16, theo mẫu thiết kế docs/assets/ui/02-home-and-scan.png)', () => {
  it('đúng 5 mục theo thứ tự: Trang chủ, Đơn hàng, Quét (giữa), Thông báo, Cá nhân', () => {
    expect(
      TAB_CONFIG.map(
        (tab) =>
          resources.tabs[tab.labelKey.replace('nav:tabs.', '') as keyof typeof resources.tabs],
      ),
    ).toEqual(['Trang chủ', 'Đơn hàng', 'Quét mã đơn hàng', 'Thông báo', 'Cá nhân']);
  });

  it('nút Quét ở đúng giữa và là hành động (không chuyển tab); Hàng hoàn/Đồng bộ không còn là tab', () => {
    const names = TAB_CONFIG.map((tab) => tab.name);
    expect(names[2]).toBe('scan-tab');
    expect(TAB_CONFIG.filter((tab) => 'action' in tab).map((tab) => tab.name)).toEqual([
      'scan-tab',
    ]);
    expect(names).not.toContain('returns');
    expect(names).not.toContain('sync');
  });

  it('mỗi mục trỏ đúng route và dùng biểu tượng riêng', () => {
    expect(TAB_CONFIG.map((tab) => tab.route)).toEqual([
      ROUTES.home,
      ROUTES.orders,
      ROUTES.scan,
      ROUTES.notificationList,
      ROUTES.profile,
    ]);
    for (const tab of TAB_CONFIG) {
      if ('action' in tab) continue;
      expect(tab.route.path).toBe(`/${tab.name}`);
      expect(tab.route.tabBar).toBe(true);
    }
    expect(new Set(TAB_CONFIG.map((tab) => tab.icon)).size).toBe(TAB_CONFIG.length);
  });
});
