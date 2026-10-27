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
  it('không có bản ghi thì không trùng', () => {
    expect(hasDuplicates(classifyMatches([], { orderCode: 'A', source: 'other' }))).toBe(false);
  });
});
