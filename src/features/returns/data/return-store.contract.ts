import { AppError } from '@/core/errors/app-error';
import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';

import type { NewReceivedLine, NewReturnInput, ReturnStore } from '../domain/return-store';

const SHOP = 'shop-a' as ShopId;
const OTHER = 'shop-b' as ShopId;

let counter = 0;
const nid = () => `rid-${(counter += 1)}`;

export function makeNewReturn(
  overrides: Partial<NewReturnInput> & { orderId?: string } = {},
): NewReturnInput {
  const { orderId, ...rest } = overrides;
  return {
    id: `ret-${(counter += 1)}` as ReturnCaseId,
    shopId: SHOP,
    atDevice: 1000,
    eventId: nid(),
    observedCode: null,
    link: orderId
      ? { linkId: nid(), orderId: orderId as OrderId, basis: 'code_match_confirmed' }
      : null,
    lines: [],
    ...rest,
  };
}

export const expectedLine = (name: string, quantity: number, variant: string | null = null) =>
  ({
    id: nid(),
    name,
    variant,
    receivedQuantity: null,
    condition: null,
    note: '',
    expected: { orderLineId: `ol-${name}`, name, variant, quantity },
  }) satisfies NewReceivedLine;

export const manualLine = (name: string, quantity: number | null) =>
  ({
    id: nid(),
    name,
    variant: null,
    receivedQuantity: quantity,
    condition: 'normal',
    note: '',
    expected: null,
  }) satisfies NewReceivedLine;

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof AppError ? error.code : 'OTHER';
  }
  return 'NONE';
}

const exterior = (at = 2000) => ({
  exterior: { signs: ['dented' as const], note: 'móp góc', recordedAtDevice: at },
  openedBefore: null,
  eventId: nid(),
  openedEventId: nid(),
});

/** Hợp đồng chung cho mọi cài đặt `ReturnStore` (bộ nhớ, SQLite). */
export function runReturnStoreContract(name: string, create: () => Promise<ReturnStore>): void {
  describe(`ReturnStore (${name})`, () => {
    it('tạo hồ sơ chưa liên kết: mã RH tăng dần theo shop, trạng thái tiếp nhận, có lịch sử "created"', async () => {
      const store = await create();
      const a = await store.createReturn(makeNewReturn({ observedCode: 'SPX123' }));
      const b = await store.createReturn(makeNewReturn());
      const other = await store.createReturn(makeNewReturn({ shopId: OTHER }));
      expect(a.returnCase.code).toBe('RH-00001');
      expect(b.returnCase.code).toBe('RH-00002');
      expect(other.returnCase.code).toBe('RH-00001');
      expect(a.returnCase.status).toBe('receiving');
      expect(a.returnCase.sourceOrderId).toBeNull();
      expect(a.returnCase.observedCode).toBe('SPX123');
      expect(a.links).toHaveLength(0);
      expect(a.events.map((e) => e.kind)).toEqual(['created']);
    });

    it('tạo hồ sơ liên kết đơn gốc: có sự kiện liên kết và dòng dự kiến là bản sao, số thực nhận để trống', async () => {
      const store = await create();
      const created = await store.createReturn(
        makeNewReturn({
          orderId: 'order-1',
          lines: [expectedLine('Áo', 2, 'Trắng M'), expectedLine('Quần', 1)],
        }),
      );
      expect(created.returnCase.sourceOrderId).toBe('order-1');
      expect(created.links).toHaveLength(1);
      expect(created.links[0]?.basis).toBe('code_match_confirmed');
      expect(created.lines.map((l) => [l.name, l.receivedQuantity, l.expected?.quantity])).toEqual([
        ['Áo', null, 2],
        ['Quần', null, 1],
      ]);
      expect(created.lines[0]?.variant).toBe('Trắng M');
    });

    it('cô lập shop: ID của shop khác coi như không tồn tại', async () => {
      const store = await create();
      const mine = await store.createReturn(makeNewReturn());
      expect(await store.getReturn(OTHER, mine.returnCase.id)).toBeNull();
      expect(await store.listReturns(OTHER, 10)).toHaveLength(0);
      expect(await code(store.saveExterior(OTHER, mine.returnCase.id, exterior()))).toBe(
        'RETURN_SAVE_FAILED',
      );
    });

    it('danh sách: mới cập nhật trước, đếm sai lệch, giới hạn số lượng', async () => {
      const store = await create();
      const first = await store.createReturn(makeNewReturn({ atDevice: 1000 }));
      const second = await store.createReturn(makeNewReturn({ atDevice: 2000 }));
      await store.createReturn(makeNewReturn({ atDevice: 3000 }));
      await store.saveExterior(SHOP, first.returnCase.id, exterior(9000));
      const list = await store.listReturns(SHOP, 2);
      expect(list.map((s) => s.returnCase.id)).toEqual([first.returnCase.id, expect.anything()]);
      expect(list).toHaveLength(2);
      expect(second.returnCase.seq).toBe(2);
      expect(list.every((s) => s.discrepancyCount === 0)).toBe(true);
    });

    it('tìm theo đơn gốc hoặc mã quan sát (khóa chuẩn hóa), không chọn hộ', async () => {
      const store = await create();
      const linked = await store.createReturn(makeNewReturn({ orderId: 'order-9' }));
      const observed = await store.createReturn(makeNewReturn({ observedCode: ' spx  77 ' }));
      expect(
        (await store.findReturns(SHOP, { orderId: 'order-9' as OrderId })).map(
          (s) => s.returnCase.id,
        ),
      ).toEqual([linked.returnCase.id]);
      expect(
        (await store.findReturns(SHOP, { observedCodeKey: 'SPX 77' })).map((s) => s.returnCase.id),
      ).toEqual([observed.returnCase.id]);
      expect(await store.findReturns(SHOP, {})).toHaveLength(0);
      expect(await store.findReturns(OTHER, { orderId: 'order-9' as OrderId })).toHaveLength(0);
    });

    it('lưu tình trạng bên ngoài: receiving -> opening, ghi ngoại lệ kiện đã mở trước, có lịch sử', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn());
      const saved = await store.saveExterior(SHOP, returnCase.id, {
        ...exterior(),
        openedBefore: { reason: 'Khách đã mở', markedAtDevice: 2100 },
      });
      expect(saved.returnCase.status).toBe('opening');
      expect(saved.returnCase.exterior?.signs).toEqual(['dented']);
      expect(saved.returnCase.openedBefore?.reason).toBe('Khách đã mở');
      expect(saved.events.map((e) => e.kind)).toEqual([
        'created',
        'exterior_saved',
        'opened_before_marked',
      ]);
    });

    it('không nhảy cóc: chưa có tình trạng bên ngoài thì không ghi video/kiểm kê', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn());
      expect(
        await code(
          store.saveOpeningVideoMissing(SHOP, returnCase.id, {
            reason: 'recorder_unavailable',
            atDevice: 3000,
            eventId: nid(),
          }),
        ),
      ).toBe('RETURN_SAVE_FAILED');
      expect(
        await code(
          store.saveLines(SHOP, returnCase.id, {
            lines: [],
            discrepancies: [],
            atDevice: 3000,
            eventId: nid(),
          }),
        ),
      ).toBe('RETURN_SAVE_FAILED');
    });

    it('luồng đầy đủ: video thiếu -> kiểm kê + sai lệch -> xác nhận; sai lệch gắn đúng dòng', async () => {
      const store = await create();
      const created = await store.createReturn(
        makeNewReturn({ orderId: 'order-2', lines: [expectedLine('Áo', 2)] }),
      );
      const id = created.returnCase.id;
      await store.saveExterior(SHOP, id, exterior());
      const afterVideo = await store.saveOpeningVideoMissing(SHOP, id, {
        reason: 'recorder_unavailable',
        atDevice: 3000,
        eventId: nid(),
      });
      expect(afterVideo.returnCase.status).toBe('checking');
      expect(afterVideo.returnCase.openingVideo).toEqual({
        kind: 'missing',
        reason: 'recorder_unavailable',
        atDevice: 3000,
      });
      const line = { ...expectedLine('Áo', 2), receivedQuantity: 1, condition: 'normal' as const };
      const extra = manualLine('Hộp quà', 1);
      const saved = await store.saveLines(SHOP, id, {
        lines: [line, extra],
        discrepancies: [{ id: nid(), lineId: line.id, kind: 'missing', note: 'thiếu 1' }],
        atDevice: 4000,
        eventId: nid(),
      });
      expect(saved.lines.map((l) => [l.name, l.receivedQuantity])).toEqual([
        ['Áo', 1],
        ['Hộp quà', 1],
      ]);
      expect(saved.lines[0]?.expected?.quantity).toBe(2);
      expect(saved.lines[1]?.expected).toBeNull();
      expect(saved.discrepancies).toHaveLength(1);
      expect(saved.discrepancies[0]?.lineId).toBe(line.id);
      expect((await store.listReturns(SHOP, 5))[0]?.discrepancyCount).toBe(1);
      const confirmed = await store.confirmReturn(SHOP, id, {
        finalNote: 'Đã kiểm xong',
        atDevice: 5000,
        eventId: nid(),
      });
      expect(confirmed.returnCase.status).toBe('confirmed');
      expect(confirmed.returnCase.finalNote).toBe('Đã kiểm xong');
      expect(confirmed.returnCase.confirmedAtDevice).toBe(5000);
      expect(confirmed.events.map((e) => e.kind)).toEqual([
        'created',
        'exterior_saved',
        'opening_video_missing',
        'lines_saved',
        'confirmed',
      ]);
    });

    it('lưu lại kiểm kê thay TOÀN BỘ dòng và sai lệch (không nhân đôi)', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn());
      const id = returnCase.id;
      await store.saveExterior(SHOP, id, exterior());
      const one = manualLine('A', 1);
      await store.saveLines(SHOP, id, {
        lines: [one],
        discrepancies: [{ id: nid(), lineId: one.id, kind: 'other', note: '' }],
        atDevice: 3000,
        eventId: nid(),
      });
      const two = manualLine('B', 2);
      const again = await store.saveLines(SHOP, id, {
        lines: [two],
        discrepancies: [],
        atDevice: 3500,
        eventId: nid(),
      });
      expect(again.lines.map((l) => l.name)).toEqual(['B']);
      expect(again.discrepancies).toHaveLength(0);
    });

    it('sai lệch trỏ tới dòng không có trong lần lưu bị từ chối và không đổi gì', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn());
      await store.saveExterior(SHOP, returnCase.id, exterior());
      expect(
        await code(
          store.saveLines(SHOP, returnCase.id, {
            lines: [manualLine('A', 1)],
            discrepancies: [{ id: nid(), lineId: 'khong-co', kind: 'other', note: '' }],
            atDevice: 3000,
            eventId: nid(),
          }),
        ),
      ).toBe('RETURN_SAVE_FAILED');
      const after = await store.getReturn(SHOP, returnCase.id);
      expect(after?.lines).toHaveLength(0);
      expect(after?.returnCase.status).toBe('opening');
    });

    it('không xác nhận khi chưa có dòng kiểm kê hoặc chưa tới bước kiểm tra', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn());
      const id = returnCase.id;
      const confirm = () =>
        store.confirmReturn(SHOP, id, { finalNote: '', atDevice: 9000, eventId: nid() });
      expect(await code(confirm())).toBe('RETURN_SAVE_FAILED');
      await store.saveExterior(SHOP, id, exterior());
      expect(await code(confirm())).toBe('RETURN_SAVE_FAILED');
      await store.saveOpeningVideoMissing(SHOP, id, {
        reason: 'user_skipped',
        atDevice: 3000,
        eventId: nid(),
      });
      expect(await code(confirm())).toBe('RETURN_SAVE_FAILED');
      await store.saveLines(SHOP, id, {
        lines: [manualLine('A', 0)],
        discrepancies: [],
        atDevice: 4000,
        eventId: nid(),
      });
      expect((await confirm()).returnCase.status).toBe('confirmed');
    });

    it('hồ sơ đã xác nhận không sửa được; vẫn liên kết đơn gốc sau (có lịch sử), không đổi dòng đã nhập', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn({ observedCode: 'MA1' }));
      const id = returnCase.id;
      await store.saveExterior(SHOP, id, exterior());
      await store.saveOpeningVideoMissing(SHOP, id, {
        reason: 'user_skipped',
        atDevice: 3000,
        eventId: nid(),
      });
      await store.saveLines(SHOP, id, {
        lines: [manualLine('Áo thun', 1)],
        discrepancies: [],
        atDevice: 4000,
        eventId: nid(),
      });
      await store.confirmReturn(SHOP, id, { finalNote: '', atDevice: 5000, eventId: nid() });
      expect(await code(store.saveExterior(SHOP, id, exterior(6000)))).toBe(
        'RETURN_ALREADY_CONFIRMED',
      );
      expect(
        await code(
          store.saveLines(SHOP, id, {
            lines: [],
            discrepancies: [],
            atDevice: 6000,
            eventId: nid(),
          }),
        ),
      ).toBe('RETURN_ALREADY_CONFIRMED');
      const linked = await store.linkSourceOrder(SHOP, id, {
        linkId: nid(),
        orderId: 'order-7' as OrderId,
        basis: 'linked_later',
        atDevice: 7000,
        eventId: nid(),
        expectedLines: [expectedLine('Quần', 3)],
      });
      expect(linked.returnCase.sourceOrderId).toBe('order-7');
      expect(linked.returnCase.status).toBe('confirmed');
      expect(linked.links.map((l) => l.basis)).toEqual(['linked_later']);
      // Hồ sơ đã có dòng nên KHÔNG nạp dòng dự kiến mới đè lên.
      expect(linked.lines.map((l) => l.name)).toEqual(['Áo thun']);
      expect(linked.events.at(-1)?.kind).toBe('linked');
    });

    it('liên kết sau khi chưa có dòng thì nạp dòng dự kiến; liên kết lần hai bị từ chối (không ghi đè)', async () => {
      const store = await create();
      const { returnCase } = await store.createReturn(makeNewReturn());
      const id = returnCase.id;
      const linked = await store.linkSourceOrder(SHOP, id, {
        linkId: nid(),
        orderId: 'order-1' as OrderId,
        basis: 'chosen_from_candidates',
        atDevice: 2000,
        eventId: nid(),
        expectedLines: [expectedLine('Áo', 2)],
      });
      expect(linked.lines).toHaveLength(1);
      expect(linked.lines[0]?.receivedQuantity).toBeNull();
      expect(
        await code(
          store.linkSourceOrder(SHOP, id, {
            linkId: nid(),
            orderId: 'order-2' as OrderId,
            basis: 'linked_later',
            atDevice: 3000,
            eventId: nid(),
            expectedLines: [],
          }),
        ),
      ).toBe('RETURN_ORDER_CONFLICT');
      const after = await store.getReturn(SHOP, id);
      expect(after?.returnCase.sourceOrderId).toBe('order-1');
      expect(after?.links).toHaveLength(1);
    });

    it('người tạo (uid) chỉ được gắn khi biết ai đăng nhập', async () => {
      const store = await create();
      const made = await store.createReturn(makeNewReturn());
      expect(made.returnCase.createdBy).toBeUndefined();
    });
  });
}
