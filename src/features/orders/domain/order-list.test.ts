import type { OrderId, ShopId } from '@/core/ids';

import {
  EMPTY_FILTERS,
  compareListItems,
  countAdvancedFilters,
  hasActiveFilters,
  isAfterCursor,
  lastActivityOf,
  matchesListQuery,
  periodStart,
  toListQuery,
} from './order-list';
import type { Order } from './types';

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1' as OrderId,
  shopId: 's' as ShopId,
  orderCode: 'dh-1',
  source: 'shopee',
  trackingCode: 'spx 9',
  dataOrigin: 'entered_by_user',
  createdAtDevice: 1000,
  ...over,
});

describe('bộ lọc danh sách đơn', () => {
  it('bộ lọc rỗng: không có bộ lọc nào bật; truy vấn rỗng', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(countAdvancedFilters(EMPTY_FILTERS)).toBe(0);
    expect(toListQuery(EMPTY_FILTERS, 0)).toEqual({});
  });

  it('từ khóa chỉ có khoảng trắng coi như không tìm; từ khóa thật được chuẩn hóa như khóa mã', () => {
    expect(toListQuery({ ...EMPTY_FILTERS, search: '   ' }, 0)).toEqual({});
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '  ' })).toBe(false);
    expect(toListQuery({ ...EMPTY_FILTERS, search: '  dh   1 ' }, 0)).toEqual({
      searchKey: 'DH 1',
    });
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'a' })).toBe(true);
  });

  it('chip Chưa có video, nguồn, khai báo, thời gian đều đi vào truy vấn; chip không tính là bộ lọc nâng cao', () => {
    const filters = {
      ...EMPTY_FILTERS,
      status: 'no_video' as const,
      source: 'lazada' as const,
      declaration: 'undeclared' as const,
      period: 'today' as const,
    };
    const q = toListQuery(filters, new Date(2026, 9, 27, 15, 30).getTime());
    expect(q).toEqual({
      withoutVideo: true,
      source: 'lazada',
      declaration: 'undeclared',
      createdSinceDevice: new Date(2026, 9, 27, 0, 0).getTime(),
    });
    expect(countAdvancedFilters(filters)).toBe(3);
    expect(countAdvancedFilters({ ...EMPTY_FILTERS, status: 'no_video' })).toBe(0);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, status: 'no_video' })).toBe(true);
  });

  it('khoảng thời gian tính theo ngày lịch giờ máy, gồm hôm nay', () => {
    const now = new Date(2026, 9, 27, 23, 59).getTime();
    expect(periodStart('today', now)).toBe(new Date(2026, 9, 27).getTime());
    expect(periodStart('last7days', now)).toBe(new Date(2026, 9, 21).getTime());
    expect(periodStart('last30days', now)).toBe(new Date(2026, 8, 28).getTime());
    // qua ranh giới tháng/năm
    expect(periodStart('last7days', new Date(2026, 0, 3, 10).getTime())).toBe(
      new Date(2025, 11, 28).getTime(),
    );
  });
});

describe('thứ tự và con trỏ', () => {
  const item = (id: string, at: number) => ({
    order: { id: id as OrderId },
    lastActivityDevice: at,
  });

  it('mới nhất trước, trùng thời điểm thì id giảm dần', () => {
    const list = [item('a', 5), item('c', 9), item('b', 9)].sort(compareListItems);
    expect(list.map((i) => i.order.id)).toEqual(['c', 'b', 'a']);
  });

  it('isAfterCursor khớp với thứ tự (chính thẻ ở con trỏ không nằm sau nó)', () => {
    const cursor = { lastActivityDevice: 9, orderId: 'b' as OrderId };
    expect(isAfterCursor(item('b', 9), cursor)).toBe(false);
    expect(isAfterCursor(item('c', 9), cursor)).toBe(false);
    expect(isAfterCursor(item('a', 9), cursor)).toBe(true);
    expect(isAfterCursor(item('z', 8), cursor)).toBe(true);
    expect(isAfterCursor(item('a', 10), cursor)).toBe(false);
  });

  it('mốc hoạt động = max(thời điểm tạo, phiên mới nhất)', () => {
    expect(lastActivityOf({ createdAtDevice: 10 }, [])).toBe(10);
    expect(lastActivityOf({ createdAtDevice: 10 }, [{ startedAtDevice: 5 }])).toBe(10);
    expect(
      lastActivityOf({ createdAtDevice: 10 }, [{ startedAtDevice: 5 }, { startedAtDevice: 40 }]),
    ).toBe(40);
  });
});

describe('matchesListQuery', () => {
  it('tìm theo chuỗi con của mã đơn hoặc mã vận đơn, không phân biệt hoa/thường', () => {
    expect(matchesListQuery(order(), 0, { searchKey: 'DH-' })).toBe(true);
    expect(matchesListQuery(order(), 0, { searchKey: 'SPX 9' })).toBe(true);
    expect(matchesListQuery(order(), 0, { searchKey: 'ZZ' })).toBe(false);
    expect(matchesListQuery(order({ trackingCode: null }), 0, { searchKey: 'SPX' })).toBe(false);
  });

  it('khai báo suy ra từ số dòng: undeclared chỉ khi 0 dòng', () => {
    expect(matchesListQuery(order(), 0, { declaration: 'undeclared' })).toBe(true);
    expect(matchesListQuery(order(), 1, { declaration: 'undeclared' })).toBe(false);
    expect(matchesListQuery(order(), 1, { declaration: 'declared' })).toBe(true);
    expect(matchesListQuery(order(), 0, { declaration: 'declared' })).toBe(false);
  });

  it('nguồn và mốc tạo', () => {
    expect(matchesListQuery(order(), 0, { source: 'lazada' })).toBe(false);
    expect(matchesListQuery(order(), 0, { createdSinceDevice: 1000 })).toBe(true);
    expect(matchesListQuery(order(), 0, { createdSinceDevice: 1001 })).toBe(false);
  });
});
