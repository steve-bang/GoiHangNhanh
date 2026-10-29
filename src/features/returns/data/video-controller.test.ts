import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';

import { createMemoryReturnStore } from './memory-return-store';
import { recoverInterruptedMedia } from '../domain/media-recovery';
import { hasOpeningEvidenceLimit } from '../domain/evidence-limits';
import type { ReturnStore } from '../domain/return-store';
import {
  startOpeningVideo,
  type VideoHashOutcome,
  type VideoPersistOutcome,
  type VideoPorts,
  type VideoRecordResult,
} from '../domain/video-controller';

const SHOP = 'shop-a' as ShopId;
const MB = 1024 * 1024;

async function makeCase(store: ReturnStore, step: 'receiving' | 'opening' = 'opening') {
  const id = `ret-${Math.random().toString(36).slice(2)}` as ReturnCaseId;
  await store.createReturn({
    id,
    shopId: SHOP,
    atDevice: 1,
    eventId: `e-${id}`,
    observedCode: null,
    link: null,
    lines: [],
  });
  if (step === 'opening') {
    await store.saveExterior(SHOP, id, {
      exterior: { signs: ['dented'], note: '', recordedAtDevice: 2 },
      openedBefore: null,
      eventId: `x-${id}`,
      openedEventId: `y-${id}`,
    });
  }
  return id;
}

function setup(options: { free?: number | null } = {}) {
  const store = createMemoryReturnStore({ creatorUid: () => 'u-1' });
  const log: string[] = [];
  let ids = 0;
  let stopCalls = 0;
  const control: {
    record: () => { done: Promise<VideoRecordResult>; stop(): void };
    persist: VideoPersistOutcome | null;
    hash: VideoHashOutcome;
    recordOptions: unknown;
  } = {
    record: () => ({
      done: Promise.resolve({ ok: true, tempUri: 'file:///cache/Camera/v.mov' }),
      stop: () => void (stopCalls += 1),
    }),
    persist: null,
    hash: { ok: true, sha256: 'ab'.repeat(32), sizeBytes: 9_000 },
    recordOptions: undefined,
  };
  const ports: VideoPorts = {
    store,
    recorder: {
      record: (opts) => {
        control.recordOptions = opts;
        log.push('record');
        return control.record();
      },
    },
    persist: (_temp, mediaId, ext) => {
      log.push(`persist:${ext}`);
      return control.persist ?? { ok: true, uri: `evidence/${mediaId}.${ext}`, sizeBytes: 9_000 };
    },
    hash: async (path) => {
      log.push(`hash:${path}`);
      return control.hash;
    },
    now: () => 1_000 + (ids += 1),
    newId: () => `id-${(ids += 1)}`,
    availableBytes: () => (options.free === undefined ? 10_000 * MB : options.free),
    minFreeBytes: 600 * MB,
    maxDurationSec: 600,
  };
  return { store, ports, log, control, stops: () => stopCalls };
}

const mediaOf = async (store: ReturnStore, returnId: ReturnCaseId) =>
  store.listMedia(SHOP, returnId);

describe('startOpeningVideo: quay video mở kiện', () => {
  it('tạo bản ghi TRƯỚC khi mở camera; lưu bền, băm, queued rồi mới ghi vào hồ sơ', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    let atRecordTime: unknown = null;
    t.control.record = () => {
      // Lúc camera bắt đầu ghi, bản ghi đã có sẵn, gắn với hồ sơ và đang `recording`.
      atRecordTime = t.store.listMedia(SHOP, returnId);
      return {
        done: Promise.resolve({ ok: true, tempUri: 'file:///cache/Camera/v.mov' }),
        stop: () => undefined,
      };
    };
    const active = await startOpeningVideo(t.ports, { shopId: SHOP, returnId });
    if ('kind' in active) throw new Error(active.reason);
    const outcome = await active.result;
    expect(outcome).toEqual({ kind: 'saved', mediaId: active.mediaId, recordedInCase: true });
    expect(await atRecordTime).toMatchObject([
      { id: active.mediaId, kind: 'video', state: 'recording', localPath: null, returnId },
    ]);
    // Đường dẫn mới được ghi TRƯỚC khi băm: băm đọc đúng đường dẫn bền.
    expect(t.log).toEqual(['record', 'persist:mov', `hash:evidence/${active.mediaId}.mov`]);
    const [media] = await mediaOf(t.store, returnId);
    expect(media).toMatchObject({
      kind: 'video',
      state: 'queued',
      localPath: `evidence/${active.mediaId}.mov`,
      sizeBytes: 9_000,
      sha256Client: 'ab'.repeat(32),
    });
    const details = await t.store.getReturn(SHOP, returnId);
    expect(details?.returnCase.status).toBe('checking');
    expect(details?.returnCase.openingVideo).toMatchObject({
      kind: 'recorded',
      mediaId: active.mediaId,
      interrupted: false,
    });
    expect(hasOpeningEvidenceLimit(details?.returnCase ?? ({} as never))).toBe(false);
  });

  it('truyền giới hạn thời lượng cho camera và dừng qua tay cầm', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    const active = await startOpeningVideo(t.ports, { shopId: SHOP, returnId });
    if ('kind' in active) throw new Error(active.reason);
    active.stop();
    await active.result;
    expect(t.control.recordOptions).toEqual({ maxDurationSec: 600 });
    expect(t.stops()).toBe(1);
  });

  it('hồ sơ chưa ghi tình trạng bên ngoài, đã xác nhận, hoặc của shop khác: NOT_READY, không tạo gì', async () => {
    const t = setup();
    const fresh = await makeCase(t.store, 'receiving');
    expect(await startOpeningVideo(t.ports, { shopId: SHOP, returnId: fresh })).toEqual({
      kind: 'failed',
      reason: 'NOT_READY',
    });
    const ready = await makeCase(t.store);
    expect(
      await startOpeningVideo(t.ports, { shopId: 'shop-b' as ShopId, returnId: ready }),
    ).toEqual({ kind: 'failed', reason: 'NOT_READY' });
    expect(
      await startOpeningVideo(t.ports, { shopId: SHOP, returnId: 'khong-co' as never }),
    ).toEqual({
      kind: 'failed',
      reason: 'NOT_READY',
    });
    expect(await mediaOf(t.store, fresh)).toEqual([]);
    expect(t.log).toEqual([]);
  });

  it('đã có video hoặc đã ghi "không có video": ALREADY_RECORDED (không thay thế, không quay bù)', async () => {
    const t = setup();
    const missing = await makeCase(t.store);
    await t.store.saveOpeningVideoMissing(SHOP, missing, {
      reason: 'device_problem',
      atDevice: 5,
      eventId: 'm1',
    });
    expect(await startOpeningVideo(t.ports, { shopId: SHOP, returnId: missing })).toEqual({
      kind: 'failed',
      reason: 'ALREADY_RECORDED',
    });
    const done = await makeCase(t.store);
    const first = await startOpeningVideo(t.ports, { shopId: SHOP, returnId: done });
    if ('kind' in first) throw new Error(first.reason);
    await first.result;
    expect(await startOpeningVideo(t.ports, { shopId: SHOP, returnId: done })).toEqual({
      kind: 'failed',
      reason: 'ALREADY_RECORDED',
    });
    expect(await mediaOf(t.store, done)).toHaveLength(1);
  });

  it('đã từng có một lần quay (kể cả lưu lỗi): ATTEMPTED, không quay bù như thể quay lúc mở', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    t.control.record = () => ({
      done: Promise.resolve({ ok: false, reason: 'RECORDER_FAILED' }),
      stop: () => undefined,
    });
    const first = await startOpeningVideo(t.ports, { shopId: SHOP, returnId });
    if ('kind' in first) throw new Error(first.reason);
    expect(await first.result).toMatchObject({ kind: 'failed', reason: 'RECORDER_FAILED' });
    expect(await startOpeningVideo(t.ports, { shopId: SHOP, returnId })).toEqual({
      kind: 'failed',
      reason: 'ATTEMPTED',
    });
    expect(await mediaOf(t.store, returnId)).toHaveLength(1);
  });

  it('dung lượng trống dưới ngưỡng: từ chối, chưa tạo bản ghi nào; không biết dung lượng thì không chặn', async () => {
    const low = setup({ free: 100 * MB });
    const returnId = await makeCase(low.store);
    expect(await startOpeningVideo(low.ports, { shopId: SHOP, returnId })).toEqual({
      kind: 'failed',
      reason: 'INSUFFICIENT_STORAGE',
    });
    expect(await mediaOf(low.store, returnId)).toEqual([]);
    expect(low.log).toEqual([]);
    const unknown = setup({ free: null });
    const id2 = await makeCase(unknown.store);
    expect(
      'mediaId' in (await startOpeningVideo(unknown.ports, { shopId: SHOP, returnId: id2 })),
    ).toBe(true);
  });

  it('camera không bắt đầu được: bản ghi giữ ở lưu lỗi (đã tạo trước khi ghi), hồ sơ không đổi', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    t.control.record = () => {
      throw new Error('camera_busy');
    };
    expect(await startOpeningVideo(t.ports, { shopId: SHOP, returnId })).toEqual({
      kind: 'failed',
      reason: 'RECORDER_FAILED',
    });
    expect((await mediaOf(t.store, returnId))[0]?.state).toBe('local_save_failed');
    expect((await t.store.getReturn(SHOP, returnId))?.returnCase.openingVideo).toBeNull();
  });

  it('kho lỗi lúc tạo bản ghi: LOCAL_STORE, không mở camera', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    t.ports.store.createMedia = async () => {
      throw new Error('db');
    };
    expect(await startOpeningVideo(t.ports, { shopId: SHOP, returnId })).toEqual({
      kind: 'failed',
      reason: 'LOCAL_STORE',
    });
    expect(t.log).toEqual([]);
  });

  it('chuyển tệp lỗi: giữ đường dẫn TẠM, không xóa, không nói đã lưu', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    t.control.persist = { ok: false, reason: 'STORAGE_FULL' };
    const active = await startOpeningVideo(t.ports, { shopId: SHOP, returnId });
    if ('kind' in active) throw new Error(active.reason);
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'STORAGE_FULL' });
    expect((await mediaOf(t.store, returnId))[0]).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///cache/Camera/v.mov',
    });
    expect((await t.store.getReturn(SHOP, returnId))?.returnCase.openingVideo).toBeNull();
  });

  it('ghi STOP_RECORDING không được: vẫn giữ đường dẫn TẠM ở lưu lỗi để khôi phục tìm lại được', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    const real = t.store.applyMediaEvent.bind(t.store);
    const store: ReturnStore = {
      ...t.store,
      applyMediaEvent: async (shop, id, event, at, patch) =>
        event.type === 'STOP_RECORDING'
          ? { ok: false, error: 'INVALID_TRANSITION' as never }
          : real(shop, id, event, at, patch),
    };
    const active = await startOpeningVideo({ ...t.ports, store }, { shopId: SHOP, returnId });
    if ('kind' in active) throw new Error(active.reason);
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'SAVE_FAILED' });
    const [media] = await mediaOf(t.store, returnId);
    expect(media).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///cache/Camera/v.mov',
    });
    // Khôi phục sau kill thấy tệp tạm còn (không bị coi là "không đường dẫn" -> unrecoverable).
    const result = await recoverInterruptedMedia(
      {
        store: t.store,
        persist: (_tmp, id, ext) => ({ ok: true, uri: `evidence/${id}.${ext}`, sizeBytes: 9 }),
        hash: async () => ({ ok: true, sha256: 'cd'.repeat(32), sizeBytes: 9 }),
        exists: () => true,
        findPersisted: () => null,
        now: () => 99_999,
        newId: () => 'rec-1',
      },
      1_000_000,
    );
    expect(result).toMatchObject({ lost: 0, rescued: 1 });
    expect((await mediaOf(t.store, returnId))[0]?.state).toBe('queued');
  });

  it('băm lỗi: giữ đường dẫn BỀN đã chuyển, FILE_UNREADABLE, hồ sơ không ghi video', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    t.control.hash = { ok: false, reason: 'FILE_UNREADABLE' };
    const active = await startOpeningVideo(t.ports, { shopId: SHOP, returnId });
    if ('kind' in active) throw new Error(active.reason);
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'FILE_UNREADABLE' });
    expect((await mediaOf(t.store, returnId))[0]).toMatchObject({
      state: 'local_save_failed',
      localPath: `evidence/${active.mediaId}.mov`,
    });
    expect((await t.store.getReturn(SHOP, returnId))?.returnCase.openingVideo).toBeNull();
  });

  it('video đã vào hàng đợi nhưng ghi vào hồ sơ lỗi: vẫn "saved" (video an toàn), recordedInCase=false để thử lại', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    t.ports.store.saveOpeningVideoRecorded = async () => {
      throw new Error('db');
    };
    const active = await startOpeningVideo(t.ports, { shopId: SHOP, returnId });
    if ('kind' in active) throw new Error(active.reason);
    expect(await active.result).toEqual({
      kind: 'saved',
      mediaId: active.mediaId,
      recordedInCase: false,
    });
    expect((await mediaOf(t.store, returnId))[0]?.state).toBe('queued');
  });

  it('kiện đã mở trước khi quay: vẫn ghi được video tình trạng hiện tại nhưng hạn chế bằng chứng KHÔNG mất', async () => {
    const t = setup();
    const id = 'ret-opened' as ReturnCaseId;
    await t.store.createReturn({
      id,
      shopId: SHOP,
      atDevice: 1,
      eventId: 'e1',
      observedCode: null,
      link: { linkId: 'l1', orderId: 'o1' as OrderId, basis: 'code_match_confirmed' },
      lines: [],
    });
    await t.store.saveExterior(SHOP, id, {
      exterior: { signs: ['unknown'], note: '', recordedAtDevice: 2 },
      openedBefore: { reason: 'đã mở', markedAtDevice: 2 },
      eventId: 'x',
      openedEventId: 'y',
    });
    const active = await startOpeningVideo(t.ports, { shopId: SHOP, returnId: id });
    if ('kind' in active) throw new Error(active.reason);
    await active.result;
    const details = await t.store.getReturn(SHOP, id);
    expect(details?.returnCase.openingVideo?.kind).toBe('recorded');
    expect(hasOpeningEvidenceLimit(details?.returnCase ?? ({} as never))).toBe(true);
  });
});
