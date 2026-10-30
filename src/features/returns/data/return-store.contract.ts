import { AppError } from '@/core/errors/app-error';
import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import type { FileEvent, FileEventType, FileState } from '@/features/evidence';

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
export function runReturnStoreContract(
  name: string,
  create: (options?: { creatorUid?: () => string | null }) => Promise<ReturnStore>,
): void {
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

    describe('ảnh hàng hoàn (media)', () => {
      const dev = (type: FileEventType): FileEvent => ({ type, origin: 'device' });
      const server = (type: FileEventType): FileEvent => ({ type, origin: 'server' });
      const SHA = 'a'.repeat(64);
      const newMedia = (returnId: ReturnCaseId, id = nid(), shopId: ShopId = SHOP) => ({
        id,
        shopId,
        returnId,
        kind: 'photo' as const,
        atDevice: 5000,
      });
      /** Đưa ảnh tới `queued` hợp lệ (đủ đường dẫn, kích thước, mã băm). */
      const toQueued = async (store: ReturnStore, mediaId: string) => {
        await store.applyMediaEvent(SHOP, mediaId, dev('STOP_RECORDING'), 5100, {
          localPath: 'tmp/x.jpg',
        });
        await store.applyMediaEvent(SHOP, mediaId, dev('LOCAL_FILE_MOVED'), 5200, {
          localPath: `evidence/${mediaId}.jpg`,
        });
        return store.applyMediaEvent(SHOP, mediaId, dev('LOCAL_FILE_READABLE'), 5300, {
          localPath: `evidence/${mediaId}.jpg`,
          sizeBytes: 1234,
          sha256Client: SHA,
        });
      };

      it('tạo bản ghi TRƯỚC khi chụp: state recording, chưa có tệp; liệt kê theo hồ sơ', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        const other = await store.createReturn(makeNewReturn());
        const media = await store.createMedia(newMedia(returnCase.id, 'm1'));
        expect(media).toMatchObject({
          id: 'm1',
          returnId: returnCase.id,
          state: 'recording',
          localPath: null,
          sizeBytes: null,
          sha256Client: null,
          kind: 'photo',
        });
        expect(await store.listMedia(SHOP, returnCase.id)).toHaveLength(1);
        expect(await store.listMedia(SHOP, other.returnCase.id)).toHaveLength(0);
      });

      it('đi hết vòng đời thiết bị tới queued khi đủ đường dẫn, kích thước và mã băm', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        await store.createMedia(newMedia(returnCase.id, 'm1'));
        const queued = await toQueued(store, 'm1');
        expect(queued.ok).toBe(true);
        const [listed] = await store.listMedia(SHOP, returnCase.id);
        expect(listed).toMatchObject({
          state: 'queued',
          localPath: 'evidence/m1.jpg',
          sizeBytes: 1234,
          sha256Client: SHA,
        });
      });

      it('vào queued thiếu đường dẫn, kích thước > 0 hoặc mã băm thì bị từ chối (MISSING_FILE_DETAILS)', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        for (const patch of [
          { sizeBytes: 10, sha256Client: SHA },
          { localPath: 'evidence/a.jpg', sha256Client: SHA },
          { localPath: 'evidence/a.jpg', sizeBytes: 0, sha256Client: SHA },
          { localPath: 'evidence/a.jpg', sizeBytes: 10 },
        ]) {
          const id = nid();
          await store.createMedia(newMedia(returnCase.id, id));
          await store.applyMediaEvent(SHOP, id, dev('STOP_RECORDING'), 1);
          const result = await store.applyMediaEvent(
            SHOP,
            id,
            dev('LOCAL_FILE_READABLE'),
            2,
            patch,
          );
          expect(result).toEqual({ ok: false, error: 'MISSING_FILE_DETAILS' });
          const [listed] = (await store.listMedia(SHOP, returnCase.id)).filter((m) => m.id === id);
          expect(listed?.state).toBe('saving_local');
        }
      });

      it('mã băm và kích thước không đổi được sau khi đóng tệp (IMMUTABLE_FIELD)', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        await store.createMedia(newMedia(returnCase.id, 'm1'));
        await toQueued(store, 'm1');
        const hashChange = await store.applyMediaEvent(SHOP, 'm1', dev('UPLOAD_STARTED'), 6000, {
          sha256Client: 'b'.repeat(64),
        });
        expect(hashChange).toEqual({ ok: false, error: 'IMMUTABLE_FIELD' });
        const sizeChange = await store.applyMediaEvent(SHOP, 'm1', dev('UPLOAD_STARTED'), 6000, {
          sizeBytes: 1,
        });
        expect(sizeChange).toEqual({ ok: false, error: 'IMMUTABLE_FIELD' });
        const [listed] = await store.listMedia(SHOP, returnCase.id);
        expect(listed).toMatchObject({ sha256Client: SHA, sizeBytes: 1234, state: 'queued' });
      });

      it('createMedia lặp cùng id trả bản cũ; cùng id khác hồ sơ hoặc khác shop thì lỗi', async () => {
        const store = await create();
        const a = await store.createReturn(makeNewReturn());
        const b = await store.createReturn(makeNewReturn());
        const foreign = await store.createReturn(makeNewReturn({ shopId: OTHER }));
        await store.createMedia(newMedia(a.returnCase.id, 'm1'));
        await toQueued(store, 'm1');
        const again = await store.createMedia(newMedia(a.returnCase.id, 'm1'));
        expect(again.state).toBe('queued');
        expect(await store.listMedia(SHOP, a.returnCase.id)).toHaveLength(1);
        expect(await code(store.createMedia(newMedia(b.returnCase.id, 'm1')))).toBe(
          'RETURN_SAVE_FAILED',
        );
        expect(await code(store.createMedia(newMedia(foreign.returnCase.id, 'm1', OTHER)))).toBe(
          'RETURN_SAVE_FAILED',
        );
      });

      it('hồ sơ đã xác nhận không nhận ảnh mới (RETURN_ALREADY_CONFIRMED)', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        await store.saveExterior(SHOP, returnCase.id, exterior());
        await store.saveOpeningVideoMissing(SHOP, returnCase.id, {
          reason: 'recorder_unavailable',
          atDevice: 3000,
          eventId: nid(),
        });
        await store.saveLines(SHOP, returnCase.id, {
          lines: [manualLine('Áo', 1)],
          discrepancies: [],
          atDevice: 4000,
          eventId: nid(),
        });
        await store.confirmReturn(SHOP, returnCase.id, {
          finalNote: '',
          atDevice: 5000,
          eventId: nid(),
        });
        expect(await code(store.createMedia(newMedia(returnCase.id)))).toBe(
          'RETURN_ALREADY_CONFIRMED',
        );
      });

      it('cô lập shop: không tạo ảnh cho hồ sơ shop khác, không đọc/sửa ảnh của shop khác', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        await store.createMedia(newMedia(returnCase.id, 'm1'));
        expect(await code(store.createMedia(newMedia(returnCase.id, 'm2', OTHER)))).toBe(
          'RETURN_SAVE_FAILED',
        );
        expect(await store.listMedia(OTHER, returnCase.id)).toEqual([]);
        expect(await store.applyMediaEvent(OTHER, 'm1', dev('STOP_RECORDING'), 1)).toEqual({
          ok: false,
          error: 'MEDIA_NOT_FOUND',
        });
        expect((await store.listMedia(SHOP, returnCase.id))[0]?.state).toBe('recording');
      });

      it('client không tự tới uploaded/verified/hash_mismatch (ORIGIN_NOT_ALLOWED)', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        await store.createMedia(newMedia(returnCase.id, 'm1'));
        await toQueued(store, 'm1');
        for (const type of [
          'SERVER_RECEIVED',
          'SERVER_VERIFIED',
          'SERVER_HASH_MISMATCH',
        ] as const) {
          // Sự kiện của máy chủ mang origin 'device' (client giả danh) phải bị từ chối.
          const result = await store.applyMediaEvent(SHOP, 'm1', dev(type), 7000);
          expect(result).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
        }
        expect((await store.listMedia(SHOP, returnCase.id))[0]?.state).toBe('queued');
        // Kể cả sự kiện máy chủ cũng chỉ hợp lệ qua máy trạng thái (không nhảy từ recording).
        await store.createMedia(newMedia(returnCase.id, 'm2'));
        expect(await store.applyMediaEvent(SHOP, 'm2', server('SERVER_RECEIVED'), 7000)).toEqual({
          ok: false,
          error: 'ILLEGAL_TRANSITION',
        });
      });

      it('lỗi ghi: LOCAL_WRITE_FAILED giữ đường dẫn đã biết', async () => {
        const store = await create();
        const { returnCase } = await store.createReturn(makeNewReturn());
        await store.createMedia(newMedia(returnCase.id, 'm1'));
        await store.applyMediaEvent(SHOP, 'm1', dev('STOP_RECORDING'), 1, {
          localPath: 'tmp/x.jpg',
        });
        const failed = await store.applyMediaEvent(SHOP, 'm1', dev('LOCAL_WRITE_FAILED'), 2, {
          localPath: 'tmp/x.jpg',
        });
        expect(failed.ok).toBe(true);
        expect((await store.listMedia(SHOP, returnCase.id))[0]).toMatchObject({
          state: 'local_save_failed',
          localPath: 'tmp/x.jpg',
        });
      });

      describe('vị trí của ảnh (Q-26k)', () => {
        const FIX = {
          status: 'ok' as const,
          lat: 10.77,
          lng: 106.7,
          accuracyM: 9.5,
          atDevice: 7777,
        };

        it('ảnh mới tạo chưa có vị trí; ghi một lần sau khi đóng tệp rồi đọc lại đúng', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          const created = await store.createMedia(newMedia(returnCase.id, 'm1'));
          expect(created.location).toBeNull();
          await toQueued(store, 'm1');
          const set = await store.setMediaLocation(SHOP, 'm1', FIX);
          expect(set).toMatchObject({ ok: true, media: { state: 'queued', location: FIX } });
          expect((await store.listMedia(SHOP, returnCase.id))[0]?.location).toEqual(FIX);
        });

        it('trạng thái lỗi lưu lý do và không có tọa độ', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          await toQueued(store, 'm1');
          await store.setMediaLocation(SHOP, 'm1', {
            status: 'denied',
            lat: 1,
            lng: 2,
            accuracyM: 3,
            atDevice: 4,
          });
          expect((await store.listMedia(SHOP, returnCase.id))[0]?.location).toEqual({
            status: 'denied',
            lat: null,
            lng: null,
            accuracyM: null,
            atDevice: null,
          });
        });

        it('không ghi đè vị trí đã có; không ghi khi tệp chưa đóng; sai tọa độ bị từ chối', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          expect(await store.setMediaLocation(SHOP, 'm1', FIX)).toEqual({
            ok: false,
            error: 'ILLEGAL_TRANSITION',
          });
          await toQueued(store, 'm1');
          expect(await store.setMediaLocation(SHOP, 'm1', { ...FIX, lat: 200 })).toEqual({
            ok: false,
            error: 'INVALID_LOCATION',
          });
          expect((await store.setMediaLocation(SHOP, 'm1', FIX)).ok).toBe(true);
          expect(await store.setMediaLocation(SHOP, 'm1', { ...FIX, lat: 11 })).toEqual({
            ok: false,
            error: 'IMMUTABLE_FIELD',
          });
          expect((await store.listMedia(SHOP, returnCase.id))[0]?.location).toEqual(FIX);
        });

        it('ảnh không tồn tại hoặc của shop khác: MEDIA_NOT_FOUND', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          await toQueued(store, 'm1');
          expect(await store.setMediaLocation(OTHER, 'm1', FIX)).toEqual({
            ok: false,
            error: 'MEDIA_NOT_FOUND',
          });
          expect(await store.setMediaLocation(SHOP, 'nope', FIX)).toEqual({
            ok: false,
            error: 'MEDIA_NOT_FOUND',
          });
        });
      });

      describe('xóa ảnh chụp nhầm (Q-26j)', () => {
        const confirmReturn = async (store: ReturnStore, id: ReturnCaseId) => {
          await store.saveExterior(SHOP, id, exterior());
          await store.saveOpeningVideoMissing(SHOP, id, {
            reason: 'recorder_unavailable',
            atDevice: 3000,
            eventId: nid(),
          });
          await store.saveLines(SHOP, id, {
            lines: [manualLine('Áo', 1)],
            discrepancies: [],
            atDevice: 4000,
            eventId: nid(),
          });
          await store.confirmReturn(SHOP, id, { finalNote: '', atDevice: 5000, eventId: nid() });
        };

        it('xóa ảnh chưa xác nhận: mất dòng ảnh, thêm ĐÚNG MỘT sự kiện photo_deleted (không đường dẫn/mã băm)', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          await store.createMedia(newMedia(returnCase.id, 'm2'));
          await toQueued(store, 'm1');
          const before = (await store.getReturn(SHOP, returnCase.id))?.events.length ?? 0;
          const deleted = await store.deleteMedia(SHOP, 'm1', 9000, 'ev-del');
          expect(deleted).toMatchObject({
            ok: true,
            media: { id: 'm1', localPath: 'evidence/m1.jpg' },
          });
          expect((await store.listMedia(SHOP, returnCase.id)).map((m) => m.id)).toEqual(['m2']);
          const details = await store.getReturn(SHOP, returnCase.id);
          expect(details?.events).toHaveLength(before + 1);
          const event = details?.events.at(-1);
          expect(event).toMatchObject({ id: 'ev-del', kind: 'photo_deleted', atDevice: 9000 });
          expect(JSON.stringify(event)).not.toMatch(/evidence|jpg|aaaa|m1/);
          expect(details?.returnCase.updatedAtDevice).toBe(9000);
        });

        it('xóa được cả ảnh lưu lỗi/đang dở (chưa lên máy chủ)', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          await store.applyMediaEvent(SHOP, 'm1', dev('STOP_RECORDING'), 1, {
            localPath: 'tmp/x.jpg',
          });
          await store.applyMediaEvent(SHOP, 'm1', dev('LOCAL_WRITE_FAILED'), 2);
          expect((await store.deleteMedia(SHOP, 'm1', 3, nid())).ok).toBe(true);
          expect(await store.listMedia(SHOP, returnCase.id)).toEqual([]);
        });

        it('hồ sơ đã xác nhận: từ chối RETURN_ALREADY_CONFIRMED, ảnh và lịch sử giữ nguyên', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          await toQueued(store, 'm1');
          await confirmReturn(store, returnCase.id);
          const events = (await store.getReturn(SHOP, returnCase.id))?.events.length;
          expect(await code(store.checkMediaDeletable(SHOP, 'm1'))).toBe(
            'RETURN_ALREADY_CONFIRMED',
          );
          expect(await code(store.deleteMedia(SHOP, 'm1', 9, nid()))).toBe(
            'RETURN_ALREADY_CONFIRMED',
          );
          expect(await store.listMedia(SHOP, returnCase.id)).toHaveLength(1);
          expect((await store.getReturn(SHOP, returnCase.id))?.events).toHaveLength(events ?? -1);
        });

        it('ảnh đã (hoặc đang) lên máy chủ: từ chối RETURN_PHOTO_IN_USE ở mọi trạng thái đó', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          await toQueued(store, 'm1');
          await store.applyMediaEvent(SHOP, 'm1', dev('UPLOAD_STARTED'), 6000);
          expect(await code(store.deleteMedia(SHOP, 'm1', 9, nid()))).toBe('RETURN_PHOTO_IN_USE');
          await store.applyMediaEvent(SHOP, 'm1', server('SERVER_RECEIVED'), 6100);
          expect(await code(store.deleteMedia(SHOP, 'm1', 9, nid()))).toBe('RETURN_PHOTO_IN_USE');
          await store.applyMediaEvent(SHOP, 'm1', server('SERVER_VERIFIED'), 6200);
          expect(await code(store.checkMediaDeletable(SHOP, 'm1'))).toBe('RETURN_PHOTO_IN_USE');
          expect(await store.listMedia(SHOP, returnCase.id)).toHaveLength(1);
          expect((await store.getReturn(SHOP, returnCase.id))?.events.map((e) => e.kind)).toEqual([
            'created',
          ]);
        });

        it('ảnh đã từng bắt đầu tải (attemptCount > 0, lỗi do máy chủ) thì không xóa; hỏng cục bộ trước khi khai báo thì vẫn xóa', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          for (const id of ['m1', 'm2', 'm3']) {
            await store.createMedia(newMedia(returnCase.id, id));
            await toQueued(store, id);
          }
          // m1: một lần tải lỗi tạm rồi về hàng đợi (máy chủ có thể đã nhận một phần).
          await store.applyMediaEvent(SHOP, 'm1', dev('UPLOAD_STARTED'), 6000);
          await store.applyMediaEvent(SHOP, 'm1', dev('UPLOAD_FAILED'), 6100, {
            attemptCount: 1,
            lastErrorCode: 'NETWORK',
            nextAttemptAtDevice: 7000,
          });
          expect(await code(store.deleteMedia(SHOP, 'm1', 9, nid()))).toBe('RETURN_PHOTO_IN_USE');
          await store.applyMediaEvent(SHOP, 'm1', dev('RETRY_UPLOAD'), 7100, {
            nextAttemptAtDevice: null,
          });
          expect(await code(store.checkMediaDeletable(SHOP, 'm1'))).toBe('RETURN_PHOTO_IN_USE');
          // m2: cần xử lý vì máy chủ từ chối.
          await store.applyMediaEvent(SHOP, 'm2', dev('UPLOAD_STARTED'), 6000);
          await store.applyMediaEvent(SHOP, 'm2', dev('NEEDS_ATTENTION'), 6100, {
            lastErrorCode: 'PERMISSION_DENIED',
          });
          expect(await code(store.deleteMedia(SHOP, 'm2', 9, nid()))).toBe('RETURN_PHOTO_IN_USE');
          // m3: tệp mất trước khi khai báo (kiểm tra cục bộ): máy chủ chưa biết.
          await store.applyMediaEvent(SHOP, 'm3', dev('NEEDS_ATTENTION'), 6100, {
            lastErrorCode: 'FILE_MISSING',
          });
          expect((await store.deleteMedia(SHOP, 'm3', 9, nid())).ok).toBe(true);
          expect((await store.listMedia(SHOP, returnCase.id)).map((m) => m.id)).toEqual([
            'm1',
            'm2',
          ]);
        });

        it('không thấy ảnh hoặc ảnh của shop khác: MEDIA_NOT_FOUND, không xóa gì', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          const notFound = { ok: false, error: 'MEDIA_NOT_FOUND' };
          expect(await store.deleteMedia(OTHER, 'm1', 9, nid())).toEqual(notFound);
          expect(await store.deleteMedia(SHOP, 'nope', 9, nid())).toEqual(notFound);
          expect(await store.checkMediaDeletable(OTHER, 'm1')).toEqual(notFound);
          expect(await store.listMedia(SHOP, returnCase.id)).toHaveLength(1);
        });

        it('checkMediaDeletable không đổi dữ liệu; xóa lặp lại sau khi đã xóa trả MEDIA_NOT_FOUND', async () => {
          const store = await create();
          const { returnCase } = await store.createReturn(makeNewReturn());
          await store.createMedia(newMedia(returnCase.id, 'm1'));
          expect((await store.checkMediaDeletable(SHOP, 'm1')).ok).toBe(true);
          expect(await store.listMedia(SHOP, returnCase.id)).toHaveLength(1);
          expect((await store.deleteMedia(SHOP, 'm1', 9, nid())).ok).toBe(true);
          expect(await store.deleteMedia(SHOP, 'm1', 10, nid())).toEqual({
            ok: false,
            error: 'MEDIA_NOT_FOUND',
          });
        });
      });
    });

    describe('video mở kiện (R2b)', () => {
      const dev = (type: FileEventType): FileEvent => ({ type, origin: 'device' });
      const SHA = 'e'.repeat(64);
      const makeVideo = async (
        store: ReturnStore,
        returnId: ReturnCaseId,
        id: string,
        upTo: 'recording' | 'queued' = 'queued',
      ) => {
        await store.createMedia({ id, shopId: SHOP, returnId, kind: 'video', atDevice: 10 });
        if (upTo === 'recording') return;
        await store.applyMediaEvent(SHOP, id, dev('STOP_RECORDING'), 11, {
          localPath: 'tmp/v.mp4',
        });
        await store.applyMediaEvent(SHOP, id, dev('LOCAL_FILE_MOVED'), 12, {
          localPath: `evidence/${id}.mp4`,
        });
        await store.applyMediaEvent(SHOP, id, dev('LOCAL_FILE_READABLE'), 13, {
          localPath: `evidence/${id}.mp4`,
          sizeBytes: 5000,
          sha256Client: SHA,
        });
      };
      const toOpening = async (store: ReturnStore) => {
        const made = await store.createReturn(makeNewReturn());
        await store.saveExterior(SHOP, made.returnCase.id, exterior());
        return made.returnCase.id;
      };

      it('tạo bản ghi video TRƯỚC khi quay, đi hết vòng đời tới queued; ảnh và video cùng nằm trong danh sách', async () => {
        const store = await create();
        const id = await toOpening(store);
        await store.createMedia({
          id: 'p1',
          shopId: SHOP,
          returnId: id,
          kind: 'photo',
          atDevice: 9,
        });
        await makeVideo(store, id, 'v1', 'recording');
        expect(await store.listMedia(SHOP, id)).toMatchObject([
          { id: 'p1', kind: 'photo' },
          { id: 'v1', kind: 'video', state: 'recording', localPath: null },
        ]);
        await makeVideo(store, id, 'v2');
        expect((await store.listMedia(SHOP, id)).find((m) => m.id === 'v2')).toMatchObject({
          kind: 'video',
          state: 'queued',
          sizeBytes: 5000,
          sha256Client: SHA,
        });
      });

      it('ghi nhận video đã quay: sang checking, có lịch sử, đúng video của hồ sơ', async () => {
        const store = await create();
        const id = await toOpening(store);
        await makeVideo(store, id, 'v1');
        const saved = await store.saveOpeningVideoRecorded(SHOP, id, {
          mediaId: 'v1',
          interrupted: false,
          atDevice: 20,
          eventId: nid(),
        });
        expect(saved.returnCase.status).toBe('checking');
        expect(saved.returnCase.openingVideo).toEqual({
          kind: 'recorded',
          mediaId: 'v1',
          atDevice: 20,
          interrupted: false,
        });
        const event = saved.events.find((e) => e.kind === 'opening_video_recorded');
        expect(event).toMatchObject({ atDevice: 20 });
        expect(JSON.stringify(event)).not.toMatch(/evidence|mp4|eeee/);
      });

      it('ghi lại đúng video đã có là idempotent (không thêm lịch sử); đổi sang video khác hoặc ghi "không có video" bị từ chối', async () => {
        const store = await create();
        const id = await toOpening(store);
        await makeVideo(store, id, 'v1');
        await makeVideo(store, id, 'v2');
        const input = { mediaId: 'v1', interrupted: true, atDevice: 20, eventId: nid() };
        await store.saveOpeningVideoRecorded(SHOP, id, input);
        const before = (await store.getReturn(SHOP, id))?.events.length;
        await store.saveOpeningVideoRecorded(SHOP, id, { ...input, eventId: nid(), atDevice: 99 });
        const after = await store.getReturn(SHOP, id);
        expect(after?.events).toHaveLength(before ?? -1);
        expect(after?.returnCase.openingVideo).toMatchObject({ mediaId: 'v1', atDevice: 20 });
        expect(
          await code(
            store.saveOpeningVideoRecorded(SHOP, id, { ...input, mediaId: 'v2', eventId: nid() }),
          ),
        ).toBe('RETURN_SAVE_FAILED');
        expect(
          await code(
            store.saveOpeningVideoMissing(SHOP, id, {
              reason: 'user_skipped',
              atDevice: 30,
              eventId: nid(),
            }),
          ),
        ).toBe('RETURN_SAVE_FAILED');
        expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo?.kind).toBe('recorded');
      });

      it('đã ghi "không có video" thì không thay bằng video quay sau (không quay bù)', async () => {
        const store = await create();
        const id = await toOpening(store);
        await store.saveOpeningVideoMissing(SHOP, id, {
          reason: 'device_problem',
          atDevice: 20,
          eventId: nid(),
        });
        await makeVideo(store, id, 'v1');
        expect(
          await code(
            store.saveOpeningVideoRecorded(SHOP, id, {
              mediaId: 'v1',
              interrupted: false,
              atDevice: 21,
              eventId: nid(),
            }),
          ),
        ).toBe('RETURN_SAVE_FAILED');
        expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo?.kind).toBe('missing');
      });

      it('chỉ nhận video đã lưu bền của CHÍNH hồ sơ và shop: ảnh, video chưa đóng tệp, video hồ sơ khác, shop khác đều bị từ chối', async () => {
        const store = await create();
        const id = await toOpening(store);
        const other = await toOpening(store);
        await store.createMedia({
          id: 'p1',
          shopId: SHOP,
          returnId: id,
          kind: 'photo',
          atDevice: 9,
        });
        await makeVideo(store, id, 'v-open', 'recording');
        await makeVideo(store, other, 'v-other');
        for (const mediaId of ['p1', 'v-open', 'v-other', 'khong-co']) {
          expect(
            await code(
              store.saveOpeningVideoRecorded(SHOP, id, {
                mediaId,
                interrupted: false,
                atDevice: 20,
                eventId: nid(),
              }),
            ),
          ).toBe('RETURN_SAVE_FAILED');
        }
        await makeVideo(store, id, 'v1');
        expect(
          await code(
            store.saveOpeningVideoRecorded(OTHER, id, {
              mediaId: 'v1',
              interrupted: false,
              atDevice: 20,
              eventId: nid(),
            }),
          ),
        ).toBe('RETURN_SAVE_FAILED');
        expect((await store.getReturn(SHOP, id))?.returnCase.openingVideo).toBeNull();
      });

      it('chưa ghi tình trạng bên ngoài hoặc đã xác nhận thì không ghi nhận video (không nhảy cóc)', async () => {
        const store = await create();
        const fresh = await store.createReturn(makeNewReturn());
        await makeVideo(store, fresh.returnCase.id, 'v1');
        expect(
          await code(
            store.saveOpeningVideoRecorded(SHOP, fresh.returnCase.id, {
              mediaId: 'v1',
              interrupted: false,
              atDevice: 20,
              eventId: nid(),
            }),
          ),
        ).toBe('RETURN_SAVE_FAILED');
      });

      it('video không xóa được dù hồ sơ chưa xác nhận và chưa tải (ngoại lệ chỉ cho ảnh)', async () => {
        const store = await create();
        const id = await toOpening(store);
        await makeVideo(store, id, 'v1');
        expect(await code(store.checkMediaDeletable(SHOP, 'v1'))).toBe('RETURN_PHOTO_IN_USE');
        expect(await code(store.deleteMedia(SHOP, 'v1', 9, nid()))).toBe('RETURN_PHOTO_IN_USE');
        expect(await store.listMedia(SHOP, id)).toHaveLength(1);
      });
    });

    describe('đăng bản neo lên máy chủ (Q-28)', () => {
      const dev = (type: FileEventType): FileEvent => ({ type, origin: 'device' });
      const SHA = 'b'.repeat(64);
      const withUid = (uid: string | null) => create({ creatorUid: () => uid });
      /** Tạo ảnh và đưa tới `queued` (lưu bền) hoặc dừng ở trạng thái `stopAt`. */
      const addMedia = async (
        store: ReturnStore,
        returnId: ReturnCaseId,
        id: string,
        upTo: 'recording' | 'saving_local' | 'queued',
      ) => {
        await store.createMedia({ id, shopId: SHOP, returnId, kind: 'photo', atDevice: 10 });
        if (upTo === 'recording') return;
        await store.applyMediaEvent(SHOP, id, dev('STOP_RECORDING'), 11, {
          localPath: 'tmp/x.jpg',
        });
        if (upTo === 'saving_local') return;
        await store.applyMediaEvent(SHOP, id, dev('LOCAL_FILE_READABLE'), 12, {
          localPath: `evidence/${id}.jpg`,
          sizeBytes: 100,
          sha256Client: SHA,
        });
      };

      it('chỉ trả hồ sơ do chính uid tạo, đã có media lưu bền; hồ sơ chưa liên kết đơn vẫn được', async () => {
        const store = await withUid('u-1');
        const unlinked = await store.createReturn(makeNewReturn({ atDevice: 100 }));
        const linked = await store.createReturn(makeNewReturn({ atDevice: 200, orderId: 'o-1' }));
        const draft = await store.createReturn(makeNewReturn({ atDevice: 300 }));
        const inProgress = await store.createReturn(makeNewReturn({ atDevice: 400 }));
        await addMedia(store, unlinked.returnCase.id, 'm-a', 'queued');
        await addMedia(store, linked.returnCase.id, 'm-b', 'queued');
        await addMedia(store, inProgress.returnCase.id, 'm-c', 'saving_local');
        const pending = await store.listReturnsPendingRemote(SHOP, 10, 'u-1');
        // `draft` chưa có media, `inProgress` mới ở saving_local: chưa cần neo.
        expect(pending.map((r) => r.id)).toEqual([unlinked.returnCase.id, linked.returnCase.id]);
        expect(pending[0]).toMatchObject({ sourceOrderId: null, createdBy: 'u-1' });
        expect(draft.returnCase.id).not.toBe(pending[0]?.id);
      });

      it('không đăng thay người khác; hồ sơ không có người tạo không bao giờ được liệt kê', async () => {
        const mine = await withUid('u-1');
        const made = await mine.createReturn(makeNewReturn());
        await addMedia(mine, made.returnCase.id, 'm-a', 'queued');
        expect(await mine.listReturnsPendingRemote(SHOP, 10, 'u-2')).toEqual([]);
        expect(await mine.listReturnsPendingRemote(SHOP, 10, '')).toEqual([]);
        const anonymous = await create();
        const noOwner = await anonymous.createReturn(makeNewReturn());
        await addMedia(anonymous, noOwner.returnCase.id, 'm-z', 'queued');
        expect(await anonymous.listReturnsPendingRemote(SHOP, 10, 'u-1')).toEqual([]);
      });

      it('cô lập shop: không liệt kê hồ sơ của shop khác; đánh dấu ID shop khác lỗi, không đổi gì', async () => {
        const store = await withUid('u-1');
        const made = await store.createReturn(makeNewReturn());
        await addMedia(store, made.returnCase.id, 'm-a', 'queued');
        expect(await store.listReturnsPendingRemote(OTHER, 10, 'u-1')).toEqual([]);
        await expect(
          store.markReturnPublished(OTHER, made.returnCase.id, 50),
        ).rejects.toMatchObject({
          code: 'RETURN_SAVE_FAILED',
        });
        expect(await store.listReturnsPendingRemote(SHOP, 10, 'u-1')).toHaveLength(1);
      });

      it('đánh dấu đã đăng: hết trong danh sách chờ, idempotent, không đổi hồ sơ hay lịch sử', async () => {
        const store = await withUid('u-1');
        const made = await store.createReturn(makeNewReturn({ atDevice: 100 }));
        await addMedia(store, made.returnCase.id, 'm-a', 'queued');
        const before = await store.getReturn(SHOP, made.returnCase.id);
        await store.markReturnPublished(SHOP, made.returnCase.id, 500);
        await store.markReturnPublished(SHOP, made.returnCase.id, 900);
        expect(await store.listReturnsPendingRemote(SHOP, 10, 'u-1')).toEqual([]);
        const after = await store.getReturn(SHOP, made.returnCase.id);
        // Chỉ thêm mốc đã đăng (lần đầu, V1-07); nội dung hồ sơ và lịch sử không đổi.
        expect(before?.returnCase.anchorPublishedAtDevice).toBeUndefined();
        expect(after).toEqual(
          before && {
            ...before,
            returnCase: { ...before.returnCase, anchorPublishedAtDevice: 500 },
          },
        );
      });

      it('listMediaForUpload: chỉ media của CHÍNH uid, trong hồ sơ ĐÃ đăng neo, đúng trạng thái và shop', async () => {
        const store = await withUid('u-1');
        const posted = await store.createReturn(makeNewReturn({ atDevice: 100 }));
        const notPosted = await store.createReturn(makeNewReturn({ atDevice: 200 }));
        await addMedia(store, posted.returnCase.id, 'm-ok', 'queued');
        await addMedia(store, posted.returnCase.id, 'm-saving', 'saving_local');
        await addMedia(store, notPosted.returnCase.id, 'm-no-anchor', 'queued');
        const queued: FileState[] = ['queued'];
        // Chưa đăng neo: chưa có gì để tải.
        expect(await store.listMediaForUpload(SHOP, queued, 'u-1')).toEqual([]);
        await store.markReturnPublished(SHOP, posted.returnCase.id, 300);
        expect((await store.listMediaForUpload(SHOP, queued, 'u-1')).map((m) => m.id)).toEqual([
          'm-ok',
        ]);
        // sai người, sai shop, trạng thái khác, uid rỗng
        expect(await store.listMediaForUpload(SHOP, queued, 'u-2')).toEqual([]);
        expect(await store.listMediaForUpload(SHOP, queued, '')).toEqual([]);
        expect(await store.listMediaForUpload(OTHER, queued, 'u-1')).toEqual([]);
        expect(await store.listMediaForUpload(SHOP, [], 'u-1')).toEqual([]);
        expect(
          (await store.listMediaForUpload(SHOP, ['saving_local'], 'u-1')).map((m) => m.id),
        ).toEqual(['m-saving']);
      });

      it('giới hạn số lượng một lượt, cũ nhất trước', async () => {
        const store = await withUid('u-1');
        const ids: ReturnCaseId[] = [];
        for (let i = 0; i < 3; i += 1) {
          const made = await store.createReturn(makeNewReturn({ atDevice: 100 + i }));
          await addMedia(store, made.returnCase.id, `m-${i}`, 'queued');
          ids.push(made.returnCase.id);
        }
        const firstTwo = await store.listReturnsPendingRemote(SHOP, 2, 'u-1');
        expect(firstTwo.map((r) => r.id)).toEqual(ids.slice(0, 2));
      });
    });
  });
}
