import { AppError } from '@/core/errors/app-error';
import type { ReturnCaseId, ShopId } from '@/core/ids';

import { createMemoryReturnStore } from './memory-return-store';
import { deletePhoto, type PhotoDeletePorts, type RemoveFileOutcome } from '../domain/photo-delete';

const SHOP = 'shop-a' as ShopId;
const SHA = 'd'.repeat(64);

async function setup(options: { held?: boolean } = {}, overrides: Partial<PhotoDeletePorts> = {}) {
  const hold = { held: options.held ?? false };
  const store = createMemoryReturnStore({ isHeldByDispute: async () => hold.held });
  const { returnCase } = await store.createReturn({
    id: 'ret-1' as ReturnCaseId,
    shopId: SHOP,
    atDevice: 1,
    eventId: 'e-1',
    observedCode: null,
    link: null,
    lines: [],
  });
  await store.createMedia({
    id: 'photo-1',
    shopId: SHOP,
    returnId: returnCase.id,
    kind: 'photo',
    atDevice: 2,
  });
  const dev = (type: 'STOP_RECORDING' | 'LOCAL_FILE_MOVED' | 'LOCAL_FILE_READABLE') =>
    ({ type, origin: 'device' }) as const;
  await store.applyMediaEvent(SHOP, 'photo-1', dev('STOP_RECORDING'), 3, { localPath: 'tmp.jpg' });
  await store.applyMediaEvent(SHOP, 'photo-1', dev('LOCAL_FILE_MOVED'), 4, {
    localPath: 'evidence/photo-1.jpg',
  });
  await store.applyMediaEvent(SHOP, 'photo-1', dev('LOCAL_FILE_READABLE'), 5, {
    localPath: 'evidence/photo-1.jpg',
    sizeBytes: 100,
    sha256Client: SHA,
  });
  const calls: string[] = [];
  const ports: PhotoDeletePorts = {
    store,
    removeFile: (path): RemoveFileOutcome => {
      calls.push(`remove:${path}`);
      return { ok: true };
    },
    now: () => 9000,
    newId: () => 'ev-del',
    ...overrides,
  };
  return { store, ports, calls, hold, returnId: returnCase.id };
}

describe('deletePhoto (ngoại lệ bất biến 4, Q-26j)', () => {
  it('xóa dòng + ghi sự kiện (kiểm lại điều kiện trong giao dịch) rồi MỚI xóa tệp', async () => {
    const { store, ports, calls, returnId } = await setup();
    const order: string[] = [];
    const outcome = await deletePhoto(
      {
        ...ports,
        removeFile: (path) => {
          order.push('file');
          return ports.removeFile(path);
        },
        store: {
          deleteMedia: async (...a) => {
            order.push('row');
            return store.deleteMedia(...a);
          },
        },
      },
      { shopId: SHOP, mediaId: 'photo-1' },
    );
    expect(outcome).toEqual({ kind: 'deleted', mediaId: 'photo-1' });
    expect(order).toEqual(['row', 'file']);
    expect(calls).toEqual(['remove:evidence/photo-1.jpg']);
    expect(await store.listMedia(SHOP, returnId)).toEqual([]);
    expect((await store.getReturn(SHOP, returnId))?.events.at(-1)).toMatchObject({
      kind: 'photo_deleted',
      atDevice: 9000,
    });
  });

  it('hồ sơ đã xác nhận: từ chối, KHÔNG xóa tệp', async () => {
    const { store, ports, calls, returnId } = await setup();
    await store.saveExterior(SHOP, returnId, {
      exterior: { signs: ['dented'], note: '', recordedAtDevice: 6 },
      openedBefore: null,
      eventId: 'x1',
      openedEventId: 'x2',
    });
    await store.saveOpeningVideoMissing(SHOP, returnId, {
      reason: 'recorder_unavailable',
      atDevice: 7,
      eventId: 'x3',
    });
    await store.saveLines(SHOP, returnId, {
      lines: [
        {
          id: 'l1',
          name: 'Áo',
          variant: null,
          receivedQuantity: 1,
          condition: 'normal',
          note: '',
          expected: null,
        },
      ],
      discrepancies: [],
      atDevice: 8,
      eventId: 'x4',
    });
    await store.confirmReturn(SHOP, returnId, { finalNote: '', atDevice: 9, eventId: 'x5' });
    expect(await deletePhoto(ports, { shopId: SHOP, mediaId: 'photo-1' })).toEqual({
      kind: 'failed',
      reason: 'ALREADY_CONFIRMED',
    });
    expect(calls).toEqual([]);
    expect(await store.listMedia(SHOP, returnId)).toHaveLength(1);
  });

  it('ảnh đang trong hồ sơ tranh chấp: từ chối IN_USE, KHÔNG xóa tệp', async () => {
    const { store, ports, calls, returnId } = await setup({ held: true });
    expect(await deletePhoto(ports, { shopId: SHOP, mediaId: 'photo-1' })).toEqual({
      kind: 'failed',
      reason: 'IN_USE',
    });
    expect(calls).toEqual([]);
    expect(await store.listMedia(SHOP, returnId)).toHaveLength(1);
  });

  it('ảnh đã lên máy chủ: từ chối IN_USE', async () => {
    const { store, ports, calls } = await setup();
    await store.applyMediaEvent(SHOP, 'photo-1', { type: 'UPLOAD_STARTED', origin: 'device' }, 6);
    await store.applyMediaEvent(SHOP, 'photo-1', { type: 'SERVER_RECEIVED', origin: 'server' }, 7);
    expect(await deletePhoto(ports, { shopId: SHOP, mediaId: 'photo-1' })).toMatchObject({
      reason: 'IN_USE',
    });
    expect(calls).toEqual([]);
  });

  it('xóa tệp lỗi (trả lỗi hoặc ném) SAU khi dòng đã xóa: vẫn deleted, dữ liệu nhất quán, không ném', async () => {
    for (const removeFile of [
      (): RemoveFileOutcome => ({ ok: false }),
      (): RemoveFileOutcome => {
        throw new Error('locked');
      },
    ]) {
      const { store, ports, returnId } = await setup({}, { removeFile });
      expect(await deletePhoto(ports, { shopId: SHOP, mediaId: 'photo-1' })).toEqual({
        kind: 'deleted',
        mediaId: 'photo-1',
      });
      expect(await store.listMedia(SHOP, returnId)).toEqual([]);
      expect((await store.getReturn(SHOP, returnId))?.events.map((e) => e.kind)).toEqual([
        'created',
        'photo_deleted',
      ]);
    }
  });

  it('điều kiện đổi sang uploading giữa lúc bắt đầu và giao dịch: từ chối, dòng VÀ tệp còn nguyên', async () => {
    const { store, ports, calls, returnId } = await setup();
    const racing: PhotoDeletePorts['store'] = {
      deleteMedia: async (...a) => {
        await store.applyMediaEvent(
          SHOP,
          'photo-1',
          { type: 'UPLOAD_STARTED', origin: 'device' },
          6,
        );
        await store.applyMediaEvent(
          SHOP,
          'photo-1',
          { type: 'SERVER_RECEIVED', origin: 'server' },
          7,
        );
        return store.deleteMedia(...a);
      },
    };
    expect(
      await deletePhoto({ ...ports, store: racing }, { shopId: SHOP, mediaId: 'photo-1' }),
    ).toEqual({ kind: 'failed', reason: 'IN_USE' });
    expect(calls).toEqual([]);
    expect(await store.listMedia(SHOP, returnId)).toHaveLength(1);
    expect((await store.getReturn(SHOP, returnId))?.events.map((e) => e.kind)).toEqual(['created']);
  });

  it('ảnh vừa được thêm vào tranh chấp giữa chừng: từ chối, dòng VÀ tệp còn nguyên', async () => {
    const { store, ports, calls, hold, returnId } = await setup();
    const racing: PhotoDeletePorts['store'] = {
      deleteMedia: async (...a) => {
        hold.held = true;
        return store.deleteMedia(...a);
      },
    };
    expect(
      await deletePhoto({ ...ports, store: racing }, { shopId: SHOP, mediaId: 'photo-1' }),
    ).toEqual({ kind: 'failed', reason: 'IN_USE' });
    expect(calls).toEqual([]);
    expect(await store.listMedia(SHOP, returnId)).toHaveLength(1);
  });

  it('xóa dòng lỗi: báo RECORD_DELETE_FAILED, tệp còn nguyên; thử lại thành công', async () => {
    const { store, ports, calls, returnId } = await setup();
    let fail = true;
    const flaky: PhotoDeletePorts['store'] = {
      deleteMedia: async (...a) => {
        if (fail) throw new AppError('RETURN_SAVE_FAILED');
        return store.deleteMedia(...a);
      },
    };
    expect(
      await deletePhoto({ ...ports, store: flaky }, { shopId: SHOP, mediaId: 'photo-1' }),
    ).toEqual({
      kind: 'failed',
      reason: 'RECORD_DELETE_FAILED',
    });
    expect(await store.listMedia(SHOP, returnId)).toHaveLength(1);
    expect(calls).toEqual([]);
    fail = false;
    expect(
      await deletePhoto({ ...ports, store: flaky }, { shopId: SHOP, mediaId: 'photo-1' }),
    ).toEqual({
      kind: 'deleted',
      mediaId: 'photo-1',
    });
    expect(await store.listMedia(SHOP, returnId)).toEqual([]);
  });

  it('kho lỗi khi xóa dòng: không ném, không xóa tệp; ảnh không tồn tại: NOT_FOUND', async () => {
    const { ports, calls } = await setup();
    const broken: PhotoDeletePorts['store'] = {
      deleteMedia: async () => {
        throw new AppError('RETURN_SAVE_FAILED');
      },
    };
    expect(
      await deletePhoto({ ...ports, store: broken }, { shopId: SHOP, mediaId: 'photo-1' }),
    ).toMatchObject({
      kind: 'failed',
    });
    expect(calls).toEqual([]);
    expect(await deletePhoto(ports, { shopId: SHOP, mediaId: 'nope' })).toEqual({
      kind: 'failed',
      reason: 'NOT_FOUND',
    });
  });

  it('ảnh chưa có tệp (chưa chụp xong): vẫn xóa dòng, không gọi xóa tệp', async () => {
    const { store, ports, calls, returnId } = await setup();
    await store.createMedia({ id: 'p2', shopId: SHOP, returnId, kind: 'photo', atDevice: 20 });
    expect(await deletePhoto(ports, { shopId: SHOP, mediaId: 'p2' })).toEqual({
      kind: 'deleted',
      mediaId: 'p2',
    });
    expect(calls).toEqual([]);
  });
});
