import { AppError } from '@/core/errors/app-error';
import type { ReturnCaseId, ShopId } from '@/core/ids';

import { createMemoryReturnStore } from './memory-return-store';
import { MAX_RETURN_PHOTOS } from '../domain/media';
import {
  capturePhoto,
  type CaptureOutcome,
  type HashOutcome,
  type PersistOutcome,
  type PhotoPorts,
} from '../domain/photo-controller';
import type { ReturnStore } from '../domain/return-store';

const SHOP = 'shop-a' as ShopId;
const SHA = 'e'.repeat(64);

async function setup(overrides: Partial<PhotoPorts> = {}) {
  const store = createMemoryReturnStore();
  const { returnCase } = await store.createReturn({
    id: 'ret-1' as ReturnCaseId,
    shopId: SHOP,
    atDevice: 1,
    eventId: 'e-1',
    observedCode: null,
    link: null,
    lines: [],
  });
  let counter = 0;
  const calls: string[] = [];
  const ports: PhotoPorts = {
    store,
    capture: async (): Promise<CaptureOutcome> => {
      calls.push('capture');
      return { ok: true, tempUri: 'file:///cache/Camera/a.jpg' };
    },
    persist: (_tempUri, id, ext): PersistOutcome => {
      calls.push(`persist:${ext}`);
      return { ok: true, uri: `evidence/${id}.${ext}`, sizeBytes: 2048 };
    },
    hash: async (): Promise<HashOutcome> => {
      calls.push('hash');
      return { ok: true, sha256: SHA, sizeBytes: 2048 };
    },
    now: () => 10_000 + (counter += 1),
    newId: () => `photo-${(counter += 1)}`,
    ...overrides,
  };
  return { store, ports, calls, returnId: returnCase.id };
}

const listOf = (store: ReturnStore, returnId: ReturnCaseId) => store.listMedia(SHOP, returnId);

describe('capturePhoto', () => {
  it('tạo bản ghi TRƯỚC khi chụp, rồi đi hết vòng đời tới queued (đã lưu trên máy)', async () => {
    let recordingSeenAtCapture: string | undefined;
    const { store, ports, calls, returnId } = await setup();
    const realCapture = ports.capture;
    const outcome = await capturePhoto(
      {
        ...ports,
        capture: async () => {
          recordingSeenAtCapture = (await listOf(store, returnId))[0]?.state;
          return realCapture();
        },
      },
      { shopId: SHOP, returnId },
    );
    expect(recordingSeenAtCapture).toBe('recording');
    expect(outcome.kind).toBe('saved');
    expect(calls).toEqual(['capture', 'persist:jpg', 'hash']);
    const [media] = await listOf(store, returnId);
    expect(media).toMatchObject({
      state: 'queued',
      localPath: `evidence/${media?.id}.jpg`,
      sizeBytes: 2048,
      sha256Client: SHA,
      kind: 'photo',
    });
  });

  it('camera không chụp được: ghi LOCAL_WRITE_FAILED, không có tệp, không ném lỗi', async () => {
    const { store, ports, returnId } = await setup({
      capture: async () => ({ ok: false, reason: 'CAPTURE_FAILED' }),
    });
    const outcome = await capturePhoto(ports, { shopId: SHOP, returnId });
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'CAPTURE_FAILED' });
    expect((await listOf(store, returnId))[0]).toMatchObject({
      state: 'local_save_failed',
      localPath: null,
    });
  });

  it('camera ném lỗi: coi như chụp lỗi, không ném ra ngoài', async () => {
    const { ports, returnId } = await setup({
      capture: async () => {
        throw new Error('camera_not_ready');
      },
    });
    await expect(capturePhoto(ports, { shopId: SHOP, returnId })).resolves.toMatchObject({
      kind: 'failed',
      reason: 'CAPTURE_FAILED',
    });
  });

  it('hết dung lượng khi chuyển tệp: giữ đường dẫn tạm, không xóa tệp, báo STORAGE_FULL', async () => {
    const { store, ports, returnId } = await setup({
      persist: () => ({ ok: false, reason: 'STORAGE_FULL' }),
    });
    const outcome = await capturePhoto(ports, { shopId: SHOP, returnId });
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'STORAGE_FULL' });
    expect((await listOf(store, returnId))[0]).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///cache/Camera/a.jpg',
    });
  });

  it('băm lỗi: giữ đường dẫn bền, không tới queued (không nói "đã lưu")', async () => {
    const { store, ports, returnId } = await setup({
      hash: async () => ({ ok: false, reason: 'FILE_UNREADABLE' }),
    });
    const outcome = await capturePhoto(ports, { shopId: SHOP, returnId });
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'FILE_UNREADABLE' });
    const [media] = await listOf(store, returnId);
    expect(media).toMatchObject({ state: 'local_save_failed' });
    expect(media?.localPath).toMatch(/^evidence\/.+\.jpg$/);
    expect(media?.sha256Client).toBeNull();
  });

  it('tệp rỗng (0 byte) không được coi là đã lưu', async () => {
    const { store, ports, returnId } = await setup({
      hash: async () => ({ ok: true, sha256: SHA, sizeBytes: 0 }),
    });
    expect(await capturePhoto(ports, { shopId: SHOP, returnId })).toMatchObject({
      kind: 'failed',
      reason: 'SAVE_FAILED',
    });
    expect((await listOf(store, returnId))[0]?.state).toBe('local_save_failed');
  });

  it('kho lỗi giữa chừng: không ném, trả SAVE_FAILED', async () => {
    const { store, ports, returnId } = await setup();
    const broken: PhotoPorts['store'] = {
      createMedia: store.createMedia,
      listMedia: store.listMedia,
      setMediaLocation: store.setMediaLocation,
      applyMediaEvent: async () => {
        throw new AppError('RETURN_SAVE_FAILED');
      },
    };
    await expect(
      capturePhoto({ ...ports, store: broken }, { shopId: SHOP, returnId }),
    ).resolves.toMatchObject({ kind: 'failed', reason: 'SAVE_FAILED' });
  });

  it('hồ sơ không tồn tại hoặc của shop khác: không chụp, không tạo bản ghi', async () => {
    const { store, ports, calls } = await setup();
    const outcome = await capturePhoto(ports, {
      shopId: 'shop-b' as ShopId,
      returnId: 'ret-1' as ReturnCaseId,
    });
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'SAVE_FAILED' });
    expect(calls).toEqual([]);
    expect(await store.listMedia(SHOP, 'ret-1' as ReturnCaseId)).toEqual([]);
  });

  it('đủ giới hạn ảnh: từ chối, không chụp thêm; ảnh lỗi không chiếm chỗ', async () => {
    const { store, ports, calls, returnId } = await setup();
    let fail = true;
    const flaky: PhotoPorts = {
      ...ports,
      capture: async () => (fail ? { ok: false, reason: 'CAPTURE_FAILED' } : ports.capture()),
    };
    await capturePhoto(flaky, { shopId: SHOP, returnId }); // 1 ảnh lỗi
    fail = false;
    for (let i = 0; i < MAX_RETURN_PHOTOS; i += 1) {
      expect((await capturePhoto(flaky, { shopId: SHOP, returnId })).kind).toBe('saved');
    }
    calls.length = 0;
    expect(await capturePhoto(flaky, { shopId: SHOP, returnId })).toMatchObject({
      kind: 'failed',
      reason: 'LIMIT_REACHED',
    });
    expect(calls).toEqual([]);
    expect(await listOf(store, returnId)).toHaveLength(MAX_RETURN_PHOTOS + 1);
  });

  it('hồ sơ đã xác nhận: báo ALREADY_CONFIRMED, không chụp', async () => {
    const { store, ports, calls, returnId } = await setup();
    await store.saveExterior(SHOP, returnId, {
      exterior: { signs: ['intact'], note: '', recordedAtDevice: 2 },
      openedBefore: null,
      eventId: 'e-2',
      openedEventId: 'e-3',
    });
    await store.saveOpeningVideoMissing(SHOP, returnId, {
      reason: 'recorder_unavailable',
      atDevice: 3,
      eventId: 'e-4',
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
      atDevice: 4,
      eventId: 'e-5',
    });
    await store.confirmReturn(SHOP, returnId, { finalNote: '', atDevice: 5, eventId: 'e-6' });
    expect(await capturePhoto(ports, { shopId: SHOP, returnId })).toMatchObject({
      kind: 'failed',
      reason: 'ALREADY_CONFIRMED',
    });
    expect(calls).toEqual([]);
  });

  describe('vị trí (Q-26k)', () => {
    const FIX = { ok: true as const, lat: 10.77, lng: 106.7, accuracyM: 8.2, atDevice: 12_345 };

    it('có vị trí: lưu cùng ảnh, ảnh vẫn tới queued', async () => {
      const { store, ports, returnId } = await setup({ locate: async () => FIX });
      const outcome = await capturePhoto(ports, { shopId: SHOP, returnId });
      expect(outcome.kind).toBe('saved');
      const [media] = await listOf(store, returnId);
      expect(media).toMatchObject({
        state: 'queued',
        location: { status: 'ok', lat: 10.77, lng: 106.7, accuracyM: 8.2, atDevice: 12_345 },
      });
      expect(outcome.kind === 'saved' && outcome.media.location?.status).toBe('ok');
    });

    it.each(['denied', 'off', 'timeout', 'unavailable'] as const)(
      'vị trí %s: vẫn chụp và lưu ảnh, ghi lý do, không có tọa độ',
      async (status) => {
        const { store, ports, returnId } = await setup({
          locate: async () => ({ ok: false, status }),
        });
        expect((await capturePhoto(ports, { shopId: SHOP, returnId })).kind).toBe('saved');
        expect((await listOf(store, returnId))[0]).toMatchObject({
          state: 'queued',
          location: { status, lat: null, lng: null, accuracyM: null, atDevice: null },
        });
      },
    );

    it('đọc vị trí ném lỗi: ảnh vẫn lưu, ghi unavailable', async () => {
      const { store, ports, returnId } = await setup({
        locate: async () => {
          throw new Error('gps_crash');
        },
      });
      expect((await capturePhoto(ports, { shopId: SHOP, returnId })).kind).toBe('saved');
      expect((await listOf(store, returnId))[0]?.location?.status).toBe('unavailable');
    });

    it('không có cổng vị trí: ảnh lưu, chưa ghi vị trí (null)', async () => {
      const { store, ports, returnId } = await setup();
      expect((await capturePhoto(ports, { shopId: SHOP, returnId })).kind).toBe('saved');
      expect((await listOf(store, returnId))[0]?.location).toBeNull();
    });

    it('ghi vị trí lỗi (kho): ảnh vẫn là saved (queued), không ném lỗi', async () => {
      const { store, ports, returnId } = await setup({});
      const failing: PhotoPorts['store'] = {
        createMedia: store.createMedia,
        listMedia: store.listMedia,
        applyMediaEvent: store.applyMediaEvent,
        setMediaLocation: async () => {
          throw new AppError('RETURN_SAVE_FAILED');
        },
      };
      const outcome = await capturePhoto(
        { ...ports, store: failing, locate: async () => FIX },
        { shopId: SHOP, returnId },
      );
      expect(outcome.kind).toBe('saved');
      expect((await listOf(store, returnId))[0]).toMatchObject({ state: 'queued', location: null });
    });

    it('chụp lỗi: không ghi vị trí', async () => {
      const { store, ports, returnId } = await setup({
        locate: async () => FIX,
        capture: async () => ({ ok: false, reason: 'CAPTURE_FAILED' }),
      });
      await capturePhoto(ports, { shopId: SHOP, returnId });
      expect((await listOf(store, returnId))[0]?.location).toBeNull();
    });
  });
});
