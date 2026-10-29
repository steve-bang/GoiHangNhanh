import type { ReturnCaseId, ShopId } from '@/core/ids';

import { createMemoryReturnStore } from './memory-return-store';
import { recoverInterruptedMedia, type MediaRecoveryPorts } from '../domain/media-recovery';
import type { ReturnStore } from '../domain/return-store';

const SHOP = 'shop-a' as ShopId;
const OTHER = 'shop-b' as ShopId;
const STARTED = 10_000;
const dev = (type: string) => ({ type, origin: 'device' }) as never;

async function makeCase(store: ReturnStore, shopId: ShopId = SHOP, step = true) {
  const id = `ret-${Math.random().toString(36).slice(2)}` as ReturnCaseId;
  await store.createReturn({
    id,
    shopId,
    atDevice: 1,
    eventId: `e-${id}`,
    observedCode: null,
    link: null,
    lines: [],
  });
  if (step) {
    await store.saveExterior(shopId, id, {
      exterior: { signs: ['dented'], note: '', recordedAtDevice: 2 },
      openedBefore: null,
      eventId: `x-${id}`,
      openedEventId: `y-${id}`,
    });
  }
  return id;
}

async function makeMedia(
  store: ReturnStore,
  returnId: ReturnCaseId,
  id: string,
  kind: 'photo' | 'video',
  state: 'recording' | 'saving_local' | 'local_save_failed',
  options: { path?: string; shopId?: ShopId; at?: number } = {},
) {
  const shopId = options.shopId ?? SHOP;
  await store.createMedia({ id, shopId, returnId, kind, atDevice: options.at ?? 100 });
  if (state === 'recording') return;
  await store.applyMediaEvent(shopId, id, dev('STOP_RECORDING'), 101, {
    localPath: options.path ?? 'file:///cache/Camera/tmp.mov',
  });
  if (state === 'local_save_failed') {
    await store.applyMediaEvent(shopId, id, dev('LOCAL_WRITE_FAILED'), 102);
  }
}

function setup() {
  const store = createMemoryReturnStore({ creatorUid: () => 'u-1' });
  const files = new Set<string>();
  const durable = new Map<string, string>();
  const persisted: string[] = [];
  const control = {
    persistFails: null as null | 'STORAGE_FULL' | 'FILE_MISSING' | 'FAILED',
    hashFails: null as null | 'FILE_MISSING' | 'FILE_UNREADABLE',
  };
  const ports: MediaRecoveryPorts = {
    store,
    persist: (temp, mediaId, ext) => {
      persisted.push(temp);
      if (control.persistFails) return { ok: false, reason: control.persistFails };
      if (!files.has(temp)) return { ok: false, reason: 'FILE_MISSING' };
      const uri = `evidence/${mediaId}.${ext}`;
      files.add(uri);
      return { ok: true, uri, sizeBytes: 1234 };
    },
    hash: async (path) =>
      control.hashFails
        ? { ok: false, reason: control.hashFails }
        : files.has(path)
          ? { ok: true, sha256: 'cd'.repeat(32), sizeBytes: 1234 }
          : { ok: false, reason: 'FILE_MISSING' },
    exists: (path) => files.has(path),
    findPersisted: (mediaId) => durable.get(mediaId) ?? null,
    now: () => 50_000,
    newId: () => `ev-${Math.random().toString(36).slice(2)}`,
  };
  return { store, ports, files, durable, persisted, control };
}

const stateOf = async (store: ReturnStore, shopId: ShopId, returnId: ReturnCaseId, id: string) =>
  (await store.listMedia(shopId, returnId)).find((m) => m.id === id);

describe('recoverInterruptedMedia: khôi phục sau khi app bị kill', () => {
  it('đang ghi/chụp (recording): không biết tệp tạm ở đâu -> không thể khôi phục; hồ sơ không bị gán video', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'v1', 'video', 'recording');
    await makeMedia(t.store, returnId, 'p1', 'photo', 'recording');
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result).toEqual({ interrupted: 2, lost: 2, rescued: 0 });
    expect((await stateOf(t.store, SHOP, returnId, 'v1'))?.state).toBe('unrecoverable');
    expect((await stateOf(t.store, SHOP, returnId, 'p1'))?.state).toBe('unrecoverable');
    expect((await t.store.getReturn(SHOP, returnId))?.returnCase.openingVideo).toBeNull();
    expect(t.persisted).toEqual([]);
  });

  it('ảnh đang lưu (saving_local) còn tệp bền theo ID: băm rồi queued, không đụng hồ sơ', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'p1', 'photo', 'saving_local', { path: 'file:///c/p.jpg' });
    t.files.add('evidence/p1.jpg');
    t.durable.set('p1', 'evidence/p1.jpg');
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result).toEqual({ interrupted: 1, lost: 0, rescued: 1 });
    expect(await stateOf(t.store, SHOP, returnId, 'p1')).toMatchObject({
      state: 'queued',
      localPath: 'evidence/p1.jpg',
      sizeBytes: 1234,
      sha256Client: 'cd'.repeat(32),
    });
    expect(t.persisted).toEqual([]); // đã ở thư mục bền: không chuyển lại
  });

  it('ảnh đang lưu chỉ còn ở thư mục tạm: chuyển vào thư mục bền rồi queued', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'p1', 'photo', 'saving_local', { path: 'file:///c/p.jpg' });
    t.files.add('file:///c/p.jpg');
    await recoverInterruptedMedia(t.ports, STARTED);
    expect(t.persisted).toEqual(['file:///c/p.jpg']);
    expect(await stateOf(t.store, SHOP, returnId, 'p1')).toMatchObject({
      state: 'queued',
      localPath: 'evidence/p1.jpg',
    });
  });

  it('video đang lưu cứu được: queued VÀ hồ sơ ghi là GIÁN ĐOẠN (không nhận là đầy đủ), còn hạn chế bằng chứng', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'v1', 'video', 'saving_local');
    t.files.add('evidence/v1.mov');
    t.durable.set('v1', 'evidence/v1.mov');
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result).toMatchObject({ rescued: 1, lost: 0 });
    const details = await t.store.getReturn(SHOP, returnId);
    expect(details?.returnCase.openingVideo).toMatchObject({
      kind: 'recorded',
      mediaId: 'v1',
      interrupted: true,
    });
    expect(details?.returnCase.status).toBe('checking');
  });

  it('video lưu lỗi (camera đã dừng bình thường) cứu được: ghi là đầy đủ (không gián đoạn)', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'v1', 'video', 'local_save_failed', {
      path: 'evidence/v1.mov',
    });
    t.files.add('evidence/v1.mov');
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result).toEqual({ interrupted: 0, lost: 0, rescued: 1 });
    expect((await t.store.getReturn(SHOP, returnId))?.returnCase.openingVideo).toMatchObject({
      kind: 'recorded',
      interrupted: false,
    });
  });

  it('không còn tệp ở bất kỳ nơi nào: unrecoverable (ghi nhận thiếu, không dựng video giả)', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'v1', 'video', 'saving_local');
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result).toEqual({ interrupted: 1, lost: 1, rescued: 0 });
    expect((await stateOf(t.store, SHOP, returnId, 'v1'))?.state).toBe('unrecoverable');
    expect((await t.store.getReturn(SHOP, returnId))?.returnCase.openingVideo).toBeNull();
  });

  it('lỗi tạm thời (đọc lỗi/máy đầy) khi tệp còn: KHÔNG đánh dấu mất, giữ lưu lỗi kèm đường dẫn thật để thử lại', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'p1', 'photo', 'saving_local', { path: 'file:///c/p.jpg' });
    t.files.add('file:///c/p.jpg');
    t.control.persistFails = 'STORAGE_FULL';
    const first = await recoverInterruptedMedia(t.ports, STARTED);
    expect(first.lost).toBe(0);
    expect(await stateOf(t.store, SHOP, returnId, 'p1')).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///c/p.jpg',
    });
    // Lần mở app sau: hết lỗi tạm thì cứu được.
    t.control.persistFails = null;
    const second = await recoverInterruptedMedia(t.ports, STARTED);
    expect(second.rescued).toBe(1);
    expect((await stateOf(t.store, SHOP, returnId, 'p1'))?.state).toBe('queued');
  });

  it('media của lần chạy NÀY (tạo từ mốc khởi động) không bao giờ bị đụng', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await makeMedia(t.store, returnId, 'now-rec', 'video', 'recording', { at: STARTED + 5 });
    await makeMedia(t.store, returnId, 'now-save', 'photo', 'saving_local', { at: STARTED });
    expect(await recoverInterruptedMedia(t.ports, STARTED)).toEqual({
      interrupted: 0,
      lost: 0,
      rescued: 0,
    });
    expect((await stateOf(t.store, SHOP, returnId, 'now-rec'))?.state).toBe('recording');
    expect((await stateOf(t.store, SHOP, returnId, 'now-save'))?.state).toBe('saving_local');
  });

  it('khôi phục mọi shop; hồ sơ đã có kết luận video thì không bị ghi đè', async () => {
    const t = setup();
    const a = await makeCase(t.store);
    const b = await makeCase(t.store, OTHER);
    await t.store.saveOpeningVideoMissing(SHOP, a, {
      reason: 'user_skipped',
      atDevice: 9,
      eventId: 'm',
    });
    await makeMedia(t.store, a, 'va', 'video', 'saving_local');
    await makeMedia(t.store, b, 'vb', 'video', 'saving_local', { shopId: OTHER });
    t.files.add('evidence/va.mov');
    t.durable.set('va', 'evidence/va.mov');
    t.files.add('evidence/vb.mov');
    t.durable.set('vb', 'evidence/vb.mov');
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result.rescued).toBe(2);
    expect((await t.store.getReturn(SHOP, a))?.returnCase.openingVideo?.kind).toBe('missing');
    expect((await t.store.getReturn(OTHER, b))?.returnCase.openingVideo?.kind).toBe('recorded');
  });

  it('lưu lỗi nhưng chưa có đường dẫn nào: bỏ qua (không có gì để cứu), chạy lại không đổi gì', async () => {
    const t = setup();
    const returnId = await makeCase(t.store);
    await t.store.createMedia({ id: 'p1', shopId: SHOP, returnId, kind: 'photo', atDevice: 100 });
    await t.store.applyMediaEvent(SHOP, 'p1', dev('LOCAL_WRITE_FAILED'), 101);
    const result = await recoverInterruptedMedia(t.ports, STARTED);
    expect(result).toEqual({ interrupted: 0, lost: 0, rescued: 0 });
    expect((await stateOf(t.store, SHOP, returnId, 'p1'))?.state).toBe('local_save_failed');
  });

  it('không ném lỗi khi kho hỏng', async () => {
    const t = setup();
    t.ports.store.listUnfinishedMedia = async () => {
      throw new Error('db');
    };
    expect(await recoverInterruptedMedia(t.ports, STARTED)).toEqual({
      interrupted: 0,
      lost: 0,
      rescued: 0,
    });
  });
});
