import type { OrderLineId } from '@/core/ids';

import { makeOrder } from '../data/order-store.contract';
import { buildOrderEdit, isEditUnchanged } from './update-order';

let n = 0;
const ctx = () => ({ lineId: () => `new-${(n += 1)}` as OrderLineId, nowDevice: 777 });

describe('buildOrderEdit', () => {
  const details = makeOrder('E1', {
    tracking: 'T1',
    lines: [{ name: 'Áo', variant: 'Đen', quantity: 2 }, { name: 'Quần' }],
  });
  const [a, b] = details.lines;
  if (!a || !b) throw new Error('fixture');
  const same = {
    source: details.order.source,
    trackingCode: 'T1',
    lines: [
      { id: a.id, name: 'Áo', variant: 'Đen', quantity: 2 },
      { id: b.id, name: 'Quần', variant: '', quantity: 1 },
    ],
  };

  it('giữ ID, nguồn dữ liệu và thời điểm tạo của dòng đã lưu; không đổi thì isEditUnchanged', () => {
    const r = buildOrderEdit(details, same, ctx());
    if (!r.ok) throw new Error('phải hợp lệ');
    expect(r.edit.lines.map((l) => [l.id, l.createdAtDevice])).toEqual([
      [a.id, a.createdAtDevice],
      [b.id, b.createdAtDevice],
    ]);
    expect(isEditUnchanged(details, r.edit)).toBe(true);
  });

  it('dòng mới nhận ID mới và giờ hiện tại; dòng trống hoàn toàn bị bỏ; trim; không gộp variant', () => {
    const r = buildOrderEdit(
      details,
      {
        ...same,
        trackingCode: '  ',
        lines: [
          { id: a.id, name: ' Áo ', variant: 'Trắng', quantity: 1 },
          { id: null, name: 'Áo', variant: 'Đen', quantity: 1 },
          { id: null, name: ' ', variant: '', quantity: 1 },
        ],
      },
      ctx(),
    );
    if (!r.ok) throw new Error('phải hợp lệ');
    expect(r.edit.trackingCode).toBeNull();
    expect(r.edit.lines).toHaveLength(2);
    expect(r.edit.lines[1]).toMatchObject({
      name: 'Áo',
      variant: 'Đen',
      createdAtDevice: 777,
      position: 1,
    });
    expect(isEditUnchanged(details, r.edit)).toBe(false);
  });

  it('variant thiếu tên và số lượng sai là lỗi theo chỉ số dòng; xóa hết dòng vẫn hợp lệ', () => {
    expect(
      buildOrderEdit(
        details,
        { ...same, lines: [{ id: null, name: '', variant: 'Đen', quantity: 1 }] },
        ctx(),
      ),
    ).toEqual({ ok: false, error: { kind: 'name_required', lineIndex: 0 } });
    expect(
      buildOrderEdit(
        details,
        { ...same, lines: [{ id: a.id, name: 'Áo', variant: '', quantity: 0 }] },
        ctx(),
      ),
    ).toEqual({ ok: false, error: { kind: 'invalid_quantity', lineIndex: 0 } });
    expect(buildOrderEdit(details, { ...same, lines: [] }, ctx()).ok).toBe(true);
  });

  it('ID của dòng không thuộc đơn bị coi là dòng mới (không mượn ID lạ)', () => {
    const r = buildOrderEdit(
      details,
      { ...same, lines: [{ id: 'la-hoac' as OrderLineId, name: 'X', variant: '', quantity: 1 }] },
      ctx(),
    );
    if (!r.ok) throw new Error('phải hợp lệ');
    expect(r.edit.lines[0]?.id).not.toBe('la-hoac');
  });
});
