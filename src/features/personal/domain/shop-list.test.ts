import { filterShopsByName, foldForSearch, SHOP_SEARCH_MIN_SHOPS } from './shop-list';
import type { ShopSummary } from './types';

const shop = (id: string, name: string): ShopSummary => ({
  id,
  name,
  role: 'owner',
  status: 'active',
  canEdit: true,
});
const SHOPS = [
  shop('1', 'Shop Thời Trang'),
  shop('2', 'Shop Mỹ Phẩm'),
  shop('3', 'Shop Gia Dụng'),
  shop('4', 'Đồ Chơi Bé'),
];

describe('foldForSearch', () => {
  it('bỏ dấu tiếng Việt (kể cả đ), đổi chữ thường, cắt khoảng trắng đầu cuối', () => {
    expect(foldForSearch('  Đồ Chơi Mỹ Phẩm  ')).toBe('do choi my pham');
  });
});

describe('filterShopsByName', () => {
  it('chuỗi tìm rỗng hoặc chỉ khoảng trắng: giữ nguyên danh sách', () => {
    expect(filterShopsByName(SHOPS, '')).toBe(SHOPS);
    expect(filterShopsByName(SHOPS, '   ')).toBe(SHOPS);
  });

  it('khớp không phân biệt dấu và hoa thường', () => {
    expect(filterShopsByName(SHOPS, 'my pham').map((s) => s.id)).toEqual(['2']);
    expect(filterShopsByName(SHOPS, 'THỜI').map((s) => s.id)).toEqual(['1']);
    expect(filterShopsByName(SHOPS, 'do choi').map((s) => s.id)).toEqual(['4']);
  });

  it('khớp nhiều cửa hàng theo thứ tự gốc; không khớp thì rỗng', () => {
    expect(filterShopsByName(SHOPS, 'shop').map((s) => s.id)).toEqual(['1', '2', '3']);
    expect(filterShopsByName(SHOPS, 'khong co')).toEqual([]);
  });
});

describe('SHOP_SEARCH_MIN_SHOPS', () => {
  it('là số nguyên dương (ngưỡng hiện ô tìm)', () => {
    expect(Number.isInteger(SHOP_SEARCH_MIN_SHOPS)).toBe(true);
    expect(SHOP_SEARCH_MIN_SHOPS).toBeGreaterThan(1);
  });
});
