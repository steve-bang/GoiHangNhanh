import type { OrderId, ShopId } from '@/core/ids';

import { classifyMatches, hasDuplicates } from './duplicates';
import type { Order } from './types';

const order = (
  id: string,
  code: string,
  source: Order['source'],
  tracking: string | null,
): Order => ({
  id: id as OrderId,
  shopId: 's' as ShopId,
  orderCode: code,
  source,
  trackingCode: tracking,
  dataOrigin: 'entered_by_user',
  createdAtDevice: 0,
});

describe('tìm trùng (A02, ADR-011)', () => {
  const matches = [
    order('1', 'dh-1', 'shopee', null),
    order('2', 'DH-1', 'lazada', null),
    order('3', 'DH-9', 'shopee', 'spx 1'),
  ];
  it('phân loại theo (mã đơn + nguồn), cùng mã khác nguồn, cùng mã vận đơn', () => {
    const found = classifyMatches(matches, {
      orderCode: ' DH-1 ',
      source: 'shopee',
      trackingCode: 'SPX 1',
    });
    expect(found.sameOrder.map((o) => o.id)).toEqual(['1']);
    expect(found.sameCodeOtherSource.map((o) => o.id)).toEqual(['2']);
    expect(found.sameTracking.map((o) => o.id)).toEqual(['3']);
    expect(hasDuplicates(found)).toBe(true);
  });
  it('cùng mã khác nguồn một mình KHÔNG phải trùng', () => {
    const found = classifyMatches([order('2', 'DH-1', 'lazada', null)], {
      orderCode: 'DH-1',
      source: 'shopee',
    });
    expect(found.sameCodeOtherSource).toHaveLength(1);
    expect(hasDuplicates(found)).toBe(false);
  });
  it('cùng mã khác nguồn NHƯNG trùng mã vận đơn: là trùng (sameTracking), không rơi vào nhóm "chỉ khác nguồn"', () => {
    const found = classifyMatches([order('2', 'DH-1', 'lazada', 'spx 1')], {
      orderCode: 'DH-1',
      source: 'shopee',
      trackingCode: 'SPX 1',
    });
    expect(found.sameTracking.map((o) => o.id)).toEqual(['2']);
    expect(found.sameCodeOtherSource).toEqual([]);
    expect(found.sameOrder).toEqual([]);
    expect(hasDuplicates(found)).toBe(true);
  });
  it('cùng mã cùng nguồn và cùng mã vận đơn chỉ tính một lần (sameOrder)', () => {
    const found = classifyMatches([order('1', 'DH-1', 'shopee', 'spx 1')], {
      orderCode: 'DH-1',
      source: 'shopee',
      trackingCode: 'spx 1',
    });
    expect(found.sameOrder).toHaveLength(1);
    expect(found.sameTracking).toEqual([]);
  });
  it('khác mã đơn, cùng nguồn, cùng mã vận đơn: trùng (sameTracking)', () => {
    const found = classifyMatches([order('9', 'DH-9', 'shopee', 'spx 1')], {
      orderCode: 'DH-1',
      source: 'shopee',
      trackingCode: 'SPX 1',
    });
    expect(found.sameTracking.map((o) => o.id)).toEqual(['9']);
  });
  it('không có bản ghi thì không trùng', () => {
    expect(hasDuplicates(classifyMatches([], { orderCode: 'A', source: 'other' }))).toBe(false);
  });
});
