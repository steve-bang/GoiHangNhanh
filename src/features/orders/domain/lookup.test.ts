import type { OrderId, ShopId } from '@/core/ids';

import { classifyLookup, matchReasons } from './lookup';
import type { Order } from './types';

const order = (
  id: string,
  code: string,
  tracking: string | null,
  source: Order['source'],
): Order => ({
  id: id as OrderId,
  shopId: 's' as ShopId,
  orderCode: code,
  source,
  trackingCode: tracking,
  dataOrigin: 'entered_by_user',
  createdAtDevice: 1,
});

describe('classifyLookup', () => {
  it('không có kết quả', () => {
    expect(classifyLookup([], 'A1')).toEqual({ kind: 'none' });
  });

  it('đúng một đơn khớp mã đơn (không phân biệt hoa/thường, khoảng trắng)', () => {
    const o = order('1', 'DH-1', null, 'shopee');
    expect(classifyLookup([o], '  dh-1 ')).toEqual({
      kind: 'one',
      match: { order: o, reasons: ['orderCode'] },
    });
  });

  it('nhiều đơn (cùng mã đơn khác nguồn) là many, giữ thứ tự, KHÔNG chọn hộ', () => {
    const a = order('1', 'DH-1', null, 'shopee');
    const b = order('2', 'DH-1', null, 'lazada');
    const r = classifyLookup([b, a], 'DH-1');
    expect(r.kind).toBe('many');
    if (r.kind === 'many') expect(r.matches.map((m) => m.order.id)).toEqual(['2', '1']);
  });

  it('mã đơn của đơn này trùng mã vận đơn của đơn kia: nhiều đơn, ghi rõ lý do từng đơn', () => {
    const a = order('1', 'ABC', null, 'shopee');
    const b = order('2', 'XYZ', 'ABC', 'tiktok_shop');
    const r = classifyLookup([a, b], 'abc');
    expect(r.kind).toBe('many');
    if (r.kind === 'many') {
      expect(r.matches.map((m) => m.reasons)).toEqual([['orderCode'], ['trackingCode']]);
    }
  });

  it('bỏ đơn không thật sự khớp và đơn lặp ID', () => {
    const a = order('1', 'DH-1', null, 'shopee');
    const stray = order('2', 'KHAC', null, 'shopee');
    expect(classifyLookup([a, a, stray], 'DH-1').kind).toBe('one');
  });

  it('matchReasons: khớp cả hai', () => {
    expect(matchReasons(order('1', 'K', 'k', 'other'), 'K')).toEqual(['orderCode', 'trackingCode']);
  });
});
