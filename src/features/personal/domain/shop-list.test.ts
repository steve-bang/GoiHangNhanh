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

  it('đ và Đ đều thành d, cả khi chuỗi đã ở dạng tổ hợp (NFD)', () => {
    expect(foldForSearch('đĐ')).toBe('dd');
    expect(foldForSearch('Đồ'.normalize('NFD'))).toBe('do');
  });

  it('môi trường không hỗ trợ normalize: không crash, vẫn so khớp chữ thường (đ vẫn thành d)', () => {
    const original = String.prototype.normalize;
    try {
      // @ts-expect-error mô phỏng môi trường thiếu normalize
      delete String.prototype.normalize;
      expect(foldForSearch('  Shop ĐỒ Chơi ')).toBe('shop dồ chơi');
      String.prototype.normalize = () => {
        throw new RangeError('không hỗ trợ');
      };
      expect(foldForSearch('Shop Đồ')).toBe('shop dồ');
      expect(filterShopsByName(SHOPS, 'shop')).toHaveLength(3);
    } finally {
      String.prototype.normalize = original;
    }
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
