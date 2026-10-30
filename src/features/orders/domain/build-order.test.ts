import type { OrderId, OrderLineId, PackageId } from '@/core/ids';

import { buildNextPackage, buildOrder, type IdFactory } from './build-order';
import { LOCAL_SHOP_ID } from './local-shop';

let n = 0;
const ids: IdFactory = {
  orderId: () => `o${(n += 1)}` as OrderId,
  lineId: () => `l${(n += 1)}` as OrderLineId,
  packageId: () => `p${(n += 1)}` as PackageId,
};
const ctx = { shopId: LOCAL_SHOP_ID, ids, nowDevice: 42 };
const base = { orderCode: ' DH1 ', source: 'shopee' as const, trackingCode: ' ', lines: [] };

describe('buildOrder', () => {
  it('không có dòng nào: đơn hợp lệ (không chặn quay), kiện 1, mã vận đơn trống thành null', () => {
    const r = buildOrder(base, ctx);
    if (!r.ok) throw new Error('phải hợp lệ');
    expect(r.details.lines).toEqual([]);
    expect(r.details.packages).toHaveLength(1);
    expect(r.details.packages[0]?.index).toBe(1);
    expect(r.details.order).toMatchObject({
      orderCode: 'DH1',
      trackingCode: null,
      dataOrigin: 'entered_by_user',
      shopId: LOCAL_SHOP_ID,
      createdAtDevice: 42,
    });
  });
  it('mã trống là lỗi', () => {
    expect(buildOrder({ ...base, orderCode: '  ' }, ctx)).toEqual({
      ok: false,
      error: { kind: 'invalid_code' },
    });
  });
  it('giữ tên và variant riêng, KHÔNG gộp cùng tên khác variant; bỏ dòng trống hoàn toàn', () => {
    const r = buildOrder(
      {
        ...base,
        lines: [
          { name: 'Áo', variant: 'Đen', quantity: 1 },
          { name: ' ', variant: ' ', quantity: 1 },
          { name: 'Áo', variant: 'Trắng', quantity: 2 },
          { name: 'Áo', variant: 'Đen', quantity: 3 },
        ],
      },
      ctx,
    );
    if (!r.ok) throw new Error('phải hợp lệ');
    expect(r.details.lines.map((l) => [l.name, l.variant, l.quantity, l.position])).toEqual([
      ['Áo', 'Đen', 1, 0],
      ['Áo', 'Trắng', 2, 1],
      ['Áo', 'Đen', 3, 2],
    ]);
  });
  it('variant không kèm tên là lỗi (không bỏ mất dữ liệu người dùng nhập)', () => {
    expect(
      buildOrder({ ...base, lines: [{ name: '', variant: 'Đen', quantity: 1 }] }, ctx),
    ).toEqual({ ok: false, error: { kind: 'name_required', lineIndex: 0 } });
  });
  it('số lượng không hợp lệ là lỗi, chỉ ra dòng', () => {
    expect(
      buildOrder(
        {
          ...base,
          lines: [
            { name: 'A', variant: '', quantity: 1 },
            { name: 'B', variant: '', quantity: 0 },
          ],
        },
        ctx,
      ),
    ).toEqual({ ok: false, error: { kind: 'invalid_quantity', lineIndex: 1 } });
  });
  it('kiện kế tiếp có ID riêng và index tăng', () => {
    const r = buildOrder(base, ctx);
    if (!r.ok) throw new Error('phải hợp lệ');
    const next = buildNextPackage(r.details, { ids, nowDevice: 50 });
    expect(next.index).toBe(2);
    expect(next.id).not.toBe(r.details.packages[0]?.id);
    expect(next.orderId).toBe(r.details.order.id);
  });
});

describe('trần độ dài khớp Rules (V1-04)', () => {
  const line = (name: string, variant = '') => ({ name, variant, quantity: 1 });
  it('tên/variant đúng 200 ký tự và mã vận đơn đúng 64 ký tự vẫn hợp lệ', () => {
    const r = buildOrder(
      { ...base, trackingCode: 'T'.repeat(64), lines: [line('Á'.repeat(200), 'Đ'.repeat(200))] },
      ctx,
    );
    expect(r.ok).toBe(true);
  });
  it('vượt trần một ký tự là lỗi theo đúng ô, không cắt âm thầm', () => {
    expect(buildOrder({ ...base, trackingCode: 'T'.repeat(65) }, ctx)).toEqual({
      ok: false,
      error: { kind: 'invalid_tracking_code' },
    });
    expect(buildOrder({ ...base, lines: [line('ok'), line('a'.repeat(201))] }, ctx)).toEqual({
      ok: false,
      error: { kind: 'name_too_long', lineIndex: 1 },
    });
    expect(buildOrder({ ...base, lines: [line('ok', 'v'.repeat(201))] }, ctx)).toEqual({
      ok: false,
      error: { kind: 'variant_too_long', lineIndex: 0 },
    });
  });
});
