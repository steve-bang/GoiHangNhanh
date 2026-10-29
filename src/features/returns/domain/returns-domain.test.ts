import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import type { OrderDetails } from '@/features/orders';

import { blankReceivedLine, buildNewReturn, expectedLinesFromOrder } from './build-return';
import { compareLine, isLineComplete, suggestDiscrepancyKinds } from './compare';
import { evidenceLimits } from './evidence-limits';
import { hasDamageSign, isExteriorChosen, toggleExteriorSign } from './exterior';
import { formatReturnCode } from './return-rules';
import { matchesFilter, stageOf } from './return-stage';
import type { ReturnCase, ReturnDetails, ReturnSummary } from './types';

const baseCase: ReturnCase = {
  id: 'r1' as ReturnCaseId,
  shopId: 's' as ShopId,
  seq: 1,
  code: 'RH-00001',
  status: 'receiving',
  sourceOrderId: null,
  observedCode: null,
  exterior: null,
  openedBefore: null,
  openingVideo: null,
  finalNote: '',
  confirmedAtDevice: null,
  createdAtDevice: 1,
  updatedAtDevice: 1,
};
const details = (patch: Partial<ReturnCase>): ReturnDetails => ({
  returnCase: { ...baseCase, ...patch },
  links: [],
  lines: [],
  discrepancies: [],
  events: [],
});
const summary = (patch: Partial<ReturnCase>, discrepancyCount = 0): ReturnSummary => ({
  returnCase: { ...baseCase, ...patch },
  discrepancyCount,
});

describe('mã hồ sơ', () => {
  it('RH- và 5 chữ số', () => {
    expect(formatReturnCode(1)).toBe('RH-00001');
    expect(formatReturnCode(82)).toBe('RH-00082');
    expect(formatReturnCode(123456)).toBe('RH-123456');
  });
});

describe('tình trạng bên ngoài kiện (B03)', () => {
  it('bắt đầu rỗng: không mặc định "nguyên vẹn"', () => {
    expect(isExteriorChosen([])).toBe(false);
    expect(isExteriorChosen(['unknown'])).toBe(true);
  });

  it('chọn được nhiều dấu hiệu cùng lúc và bỏ chọn được', () => {
    let signs = toggleExteriorSign([], 'dented');
    signs = toggleExteriorSign(signs, 'wet');
    signs = toggleExteriorSign(signs, 'label_unreadable');
    expect(signs).toEqual(['dented', 'wet', 'label_unreadable']);
    expect(toggleExteriorSign(signs, 'wet')).toEqual(['dented', 'label_unreadable']);
  });

  it('"Nguyên vẹn" loại trừ dấu hiệu hư hỏng và ngược lại; nhãn khó đọc/khác vẫn đi kèm được', () => {
    expect(toggleExteriorSign(['dented', 'torn', 'label_unreadable'], 'intact')).toEqual([
      'intact',
      'label_unreadable',
    ]);
    expect(toggleExteriorSign(['intact', 'other'], 'torn')).toEqual(['other', 'torn']);
    expect(toggleExteriorSign(['intact'], 'label_unreadable')).toEqual([
      'intact',
      'label_unreadable',
    ]);
  });

  it('"Chưa xác định" loại trừ mọi dấu hiệu khác và bị bỏ khi chọn dấu hiệu cụ thể', () => {
    expect(toggleExteriorSign(['dented', 'wet'], 'unknown')).toEqual(['unknown']);
    expect(toggleExteriorSign(['unknown'], 'dented')).toEqual(['dented']);
  });

  it('nhận ra dấu hiệu hư hỏng (nên chụp vị trí đó trước khi mở)', () => {
    expect(hasDamageSign(['dented'])).toBe(true);
    expect(hasDamageSign(['intact', 'label_unreadable'])).toBe(false);
    expect(hasDamageSign(['unknown'])).toBe(false);
  });
});

describe('so sánh hàng thực nhận với dự kiến (B06)', () => {
  const expected = { orderLineId: 'l', name: 'Áo', variant: null, quantity: 2 };

  it('chưa nhập số lượng thì chưa so sánh (không mặc định bằng dự kiến)', () => {
    expect(compareLine({ receivedQuantity: null, expected })).toBe('unentered');
  });

  it('chưa có dữ liệu đối chiếu KHÔNG bị hiểu là dự kiến 0', () => {
    expect(compareLine({ receivedQuantity: 3, expected: null })).toBe('no_reference');
    expect(compareLine({ receivedQuantity: 0, expected: null })).toBe('no_reference');
  });

  it('khớp, thiếu, thừa', () => {
    expect(compareLine({ receivedQuantity: 2, expected })).toBe('matched');
    expect(compareLine({ receivedQuantity: 1, expected })).toBe('short');
    expect(compareLine({ receivedQuantity: 0, expected })).toBe('short');
    expect(compareLine({ receivedQuantity: 5, expected })).toBe('excess');
  });

  it('chỉ GỢI Ý loại sai lệch theo số lượng và tình trạng; bình thường thì không gợi ý', () => {
    expect(suggestDiscrepancyKinds({ receivedQuantity: 1, expected, condition: 'normal' })).toEqual(
      ['missing'],
    );
    expect(
      suggestDiscrepancyKinds({ receivedQuantity: 3, expected, condition: 'damaged' }),
    ).toEqual(['excess', 'damaged']);
    expect(suggestDiscrepancyKinds({ receivedQuantity: 2, expected, condition: 'normal' })).toEqual(
      [],
    );
    expect(suggestDiscrepancyKinds({ receivedQuantity: null, expected, condition: null })).toEqual(
      [],
    );
    expect(
      suggestDiscrepancyKinds({
        receivedQuantity: 1,
        expected: null,
        condition: 'missing_accessory',
      }),
    ).toEqual(['missing_accessory']);
  });

  it('dòng đủ để kiểm kê: có tên và đã nhập số lượng (kể cả 0)', () => {
    expect(isLineComplete({ name: 'Áo', receivedQuantity: 0 })).toBe(true);
    expect(isLineComplete({ name: ' ', receivedQuantity: 1 })).toBe(false);
    expect(isLineComplete({ name: 'Áo', receivedQuantity: null })).toBe(false);
  });
});

describe('hạn chế bằng chứng', () => {
  it('hồ sơ vừa tạo chưa có hạn chế nào được ghi', () => {
    expect(evidenceLimits(details({}))).toEqual(['not_linked']);
  });

  it('thiếu video, kiện mở trước, chưa có ảnh ngoài, chưa liên kết: nói rõ từng điều, không bao giờ "đầy đủ"', () => {
    const limits = evidenceLimits(
      details({
        exterior: { signs: ['dented'], note: '', recordedAtDevice: 1 },
        openedBefore: { reason: 'x', markedAtDevice: 1 },
        openingVideo: { kind: 'missing', reason: 'user_skipped', atDevice: 1 },
      }),
    );
    expect(limits).toEqual([
      'no_opening_video',
      'opened_before_recording',
      'no_exterior_photo',
      'not_linked',
    ]);
  });

  it('đã liên kết đơn gốc thì bỏ "chưa liên kết"', () => {
    expect(evidenceLimits(details({ sourceOrderId: 'o1' as OrderId }))).not.toContain('not_linked');
  });
});

describe('giai đoạn và bộ lọc danh sách', () => {
  it('giai đoạn theo trạng thái; có sai lệch khi đang kiểm tra thì hiện "có sai lệch"', () => {
    expect(stageOf(summary({ status: 'receiving' }))).toBe('receiving');
    expect(stageOf(summary({ status: 'opening' }, 2))).toBe('opening');
    expect(stageOf(summary({ status: 'checking' }))).toBe('checking');
    expect(stageOf(summary({ status: 'checking' }, 1))).toBe('discrepancy');
    expect(stageOf(summary({ status: 'confirmed' }, 1))).toBe('confirmed');
  });

  it('lọc theo giai đoạn hoặc "chưa liên kết"', () => {
    const linked = summary({ status: 'checking', sourceOrderId: 'o' as OrderId });
    const unlinked = summary({ status: 'receiving' });
    expect(matchesFilter(linked, 'all')).toBe(true);
    expect(matchesFilter(linked, 'checking')).toBe(true);
    expect(matchesFilter(linked, 'receiving')).toBe(false);
    expect(matchesFilter(unlinked, 'unlinked')).toBe(true);
    expect(matchesFilter(linked, 'unlinked')).toBe(false);
  });
});

describe('dựng hồ sơ mới', () => {
  let n = 0;
  const newId = () => `id-${(n += 1)}`;
  const order = {
    order: { id: 'o1' as OrderId },
    lines: [
      { id: 'l2', name: 'Quần', variant: null, quantity: 1, position: 1 },
      { id: 'l1', name: 'Áo', variant: 'Trắng M', quantity: 2, position: 0 },
      { id: 'l3', name: 'Áo', variant: 'Đen M', quantity: 1, position: 2 },
    ],
    packages: [],
  } as unknown as OrderDetails;

  it('dòng dự kiến theo thứ tự đơn, là bản sao, số thực nhận để trống, hai variant là hai dòng', () => {
    const lines = expectedLinesFromOrder(order, newId);
    expect(lines.map((l) => [l.name, l.variant, l.expected?.quantity, l.receivedQuantity])).toEqual(
      [
        ['Áo', 'Trắng M', 2, null],
        ['Quần', null, 1, null],
        ['Áo', 'Đen M', 1, null],
      ],
    );
    expect(lines.every((l) => l.condition === null && l.note === '')).toBe(true);
    expect(new Set(lines.map((l) => l.id)).size).toBe(3);
  });

  it('dòng trống do người dùng thêm không có dữ liệu dự kiến', () => {
    const line = blankReceivedLine(newId);
    expect(line.expected).toBeNull();
    expect(line.receivedQuantity).toBeNull();
  });

  it('hồ sơ chưa liên kết không có liên kết và không có dòng', () => {
    const input = buildNewReturn({
      id: 'r' as ReturnCaseId,
      shopId: 's' as ShopId,
      atDevice: 5,
      observedCode: 'SPX1',
      source: null,
      newId,
    });
    expect(input.link).toBeNull();
    expect(input.lines).toEqual([]);
    expect(input.observedCode).toBe('SPX1');
  });

  it('hồ sơ liên kết đơn mang căn cứ liên kết và dòng dự kiến', () => {
    const input = buildNewReturn({
      id: 'r' as ReturnCaseId,
      shopId: 's' as ShopId,
      atDevice: 5,
      observedCode: null,
      source: { details: order, basis: 'chosen_from_candidates' },
      newId,
    });
    expect(input.link).toMatchObject({ orderId: 'o1', basis: 'chosen_from_candidates' });
    expect(input.lines).toHaveLength(3);
  });
});
