import { ROUTES } from '@/core/navigation';
import resources from '@/core/i18n/locales/vi/nav.json';

import { TAB_CONFIG } from './tab-config';

describe('cấu hình thanh tab (D-11, docs/09 mục 2)', () => {
  it('đúng 4 tab theo thứ tự: Tổng quan, Đơn hàng, Hàng hoàn, Đồng bộ', () => {
    expect(
      TAB_CONFIG.map(
        (tab) =>
          resources.tabs[tab.labelKey.replace('nav:tabs.', '') as keyof typeof resources.tabs],
      ),
    ).toEqual(['Tổng quan', 'Đơn hàng', 'Hàng hoàn', 'Đồng bộ']);
  });

  it('không có tab Quét/Thông báo/Cá nhân của mockup (O-18 chưa chốt)', () => {
    const names = TAB_CONFIG.map((tab) => tab.name);
    expect(names).toEqual(['home', 'orders', 'returns', 'sync']);
    expect(names).not.toContain('scan');
  });

  it('mỗi tab trỏ đúng route gốc của tab và dùng biểu tượng riêng', () => {
    expect(TAB_CONFIG.map((tab) => tab.route)).toEqual([
      ROUTES.home,
      ROUTES.orders,
      ROUTES.returns,
      ROUTES.sync,
    ]);
    for (const tab of TAB_CONFIG) {
      expect(tab.route.path).toBe(`/${tab.name}`);
      expect(tab.route.tabBar).toBe(true);
    }
    expect(new Set(TAB_CONFIG.map((tab) => tab.icon)).size).toBe(TAB_CONFIG.length);
  });
});
