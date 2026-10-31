import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFileStore, FileFingerprint } from '@/features/evidence';
import { createMemoryEvidenceFileStore } from '@/features/orders';
import { createMemoryReturnStore } from '@/features/returns';

import type { HashResult, UploadGateway, UploadOutcome, UploadSource } from './ports';
import { createUploadQueue } from './upload-queue';
import { evidenceFileSource, returnMediaSource } from './upload-sources';

/**
 * V1-13 (R9): hàng đợi KHÔNG băm lại toàn tệp ở mỗi lần thử khi dấu tệp (kích thước + thời điểm sửa
 * đổi) không đổi kể từ lần băm lại khớp gần nhất; nghi ngờ thì băm lại; mã khác thì không tải.
 */
const SHOP = 'shop-1' as ShopId;
const HASH = 'ab'.repeat(32);
const SIZE = 100;
const d = (type: string) => ({ type, origin: 'device' }) as never;

async function queuedFile(files: EvidenceFileStore, id: string): Promise<void> {
  await files.create({
    id: id as EvidenceId,
    shopId: SHOP,
    orderId: `o-${id}` as OrderId,
    packageId: `p-${id}` as PackageId,
    sessionId: `s-${id}` as SessionId,
    group: 'pack',
    kind: 'video',
    createdAtDevice: 1000,
  });
  await files.applyEvent(SHOP, id as EvidenceId, d('STOP_RECORDING'), 1000);
  await files.applyEvent(SHOP, id as EvidenceId, d('LOCAL_FILE_READABLE'), 1000, {
    localPath: `evidence/${id}.mp4`,
    sizeBytes: SIZE,
    sha256Client: HASH,
  });
}

function setup(
  options: { fingerprint?: boolean; sources?: (files: EvidenceFileStore) => UploadSource[] } = {},
) {
  const files = createMemoryEvidenceFileStore();
  let clock = 10_000;
  const outcomes: UploadOutcome[] = [];
  const uploads: string[] = [];
  let hashCalls = 0;
  let hashResult: HashResult = { ok: true, sha256: HASH };
  /** Dấu tệp hiện tại trên "đĩa"; `null` = hệ tệp không báo. */
  let current: FileFingerprint | null = { sizeBytes: SIZE, modifiedAtMs: 5_000 };
  /** Gọi giữa lúc băm (mô phỏng tệp bị ghi trong lúc băm). */
  let duringHash: (() => void) | null = null;
  const gateway: UploadGateway = {
    upload: async (req) => {
      uploads.push(req.evidenceId);
      return outcomes.shift() ?? { kind: 'received' };
    },
    fetchServerStates: async () => new Map(),
  };
  const queue = createUploadQueue({
    sources: options.sources ? options.sources(files) : [evidenceFileSource(files)],
    gateway,
    hasher: {
      sha256: async () => {
        hashCalls += 1;
        duringHash?.();
        return hashResult;
      },
      ...(options.fingerprint === false ? {} : { fingerprint: async () => current }),
    },
    now: () => clock,
    isOnline: () => true,
  });
  /** Lỗi máy chủ (tính lượt) để tệp quay lại hàng đợi, rồi cho tới hạn thử lại. */
  const failThenDue = async () => {
    outcomes.push({ kind: 'retryable', code: 'HTTP_500' });
    await queue.runOnce(SHOP);
    clock += 60 * 60 * 1000;
  };
  return {
    files,
    queue,
    uploads,
    outcomes,
    failThenDue,
    hashCalls: () => hashCalls,
    setHash: (r: HashResult) => void (hashResult = r),
    setCurrent: (f: FileFingerprint | null) => void (current = f),
    onHash: (f: (() => void) | null) => void (duringHash = f),
    get: (id: string) => files.get(SHOP, id as EvidenceId),
  };
}

describe('hàng đợi tải lên: không băm lại tệp không đổi (V1-13)', () => {
  it('lần thử đầu luôn băm lại và lưu dấu; lần thử sau dấu không đổi thì KHÔNG băm, vẫn tải', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.failThenDue();
    expect(t.hashCalls()).toBe(1);
    expect((await t.get('a'))?.hashedFingerprint).toEqual({ sizeBytes: SIZE, modifiedAtMs: 5_000 });
    expect((await t.get('a'))?.state).toBe('upload_failed');

    await t.failThenDue(); // lần 2: không băm
    await t.queue.runOnce(SHOP); // lần 3: không băm, nhận đủ
    expect(t.hashCalls()).toBe(1);
    expect(t.uploads).toEqual(['a', 'a', 'a']);
    expect((await t.get('a'))?.state).toBe('uploaded');
  });

  it('đổi thời điểm sửa đổi hoặc kích thước: băm lại; mã vẫn khớp thì tải và cập nhật dấu', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.failThenDue();
    t.setCurrent({ sizeBytes: SIZE, modifiedAtMs: 6_000 });
    await t.failThenDue();
    expect(t.hashCalls()).toBe(2);
    expect((await t.get('a'))?.hashedFingerprint).toEqual({ sizeBytes: SIZE, modifiedAtMs: 6_000 });
    // Kích thước trên đĩa khác `sizeBytes` đã chốt (dù dấu đã lưu cũng đổi theo): luôn băm lại.
    t.setCurrent({ sizeBytes: SIZE + 1, modifiedAtMs: 6_000 });
    t.setHash({ ok: true, sha256: 'cd'.repeat(32) });
    await t.queue.runOnce(SHOP);
    expect(t.hashCalls()).toBe(3);
  });

  it('mã băm khác: LOCAL_HASH_CHANGED -> needs_attention, KHÔNG tải bản đã đổi, xóa dấu', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.failThenDue();
    expect(t.uploads).toEqual(['a']);
    t.setCurrent({ sizeBytes: SIZE, modifiedAtMs: 7_000 });
    t.setHash({ ok: true, sha256: 'cd'.repeat(32) });
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual(['a']);
    const file = await t.get('a');
    expect(file).toMatchObject({ state: 'needs_attention', lastErrorCode: 'LOCAL_HASH_CHANGED' });
    expect(file?.hashedFingerprint ?? null).toBeNull();
    expect(file?.sha256Client).toBe(HASH); // mã gốc không đổi (bất biến 4)
  });

  it('tệp mất giữa hai lần thử: dấu không đọc được -> băm lại -> FILE_MISSING, không tải', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.failThenDue();
    t.setCurrent(null);
    t.setHash({ ok: false, reason: 'FILE_MISSING' });
    await t.queue.runOnce(SHOP);
    expect(t.hashCalls()).toBe(2);
    expect(t.uploads).toEqual(['a']);
    expect(await t.get('a')).toMatchObject({
      state: 'needs_attention',
      lastErrorCode: 'FILE_MISSING',
    });
  });

  it('hệ tệp không báo thời điểm sửa đổi: luôn băm lại, không lưu dấu', async () => {
    const t = setup();
    t.setCurrent(null);
    await queuedFile(t.files, 'a');
    await t.failThenDue();
    await t.failThenDue();
    expect(t.hashCalls()).toBe(2);
    expect((await t.get('a'))?.hashedFingerprint ?? null).toBeNull();
  });

  it('bộ băm không có `fingerprint` (cổng cũ): luôn băm lại như trước V1-13', async () => {
    const t = setup({ fingerprint: false });
    await queuedFile(t.files, 'a');
    await t.failThenDue();
    await t.failThenDue();
    expect(t.hashCalls()).toBe(2);
  });

  it('tệp đổi TRONG LÚC băm (dấu trước khác dấu sau): không lưu dấu, lần sau băm lại', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.onHash(() => t.setCurrent({ sizeBytes: SIZE, modifiedAtMs: 9_999 }));
    await t.failThenDue();
    expect((await t.get('a'))?.hashedFingerprint ?? null).toBeNull();
    t.onHash(null);
    await t.failThenDue();
    expect(t.hashCalls()).toBe(2);
    expect((await t.get('a'))?.hashedFingerprint).toEqual({ sizeBytes: SIZE, modifiedAtMs: 9_999 });
  });

  it('media hàng hoàn cũng lưu dấu và không băm lại (cùng hàng đợi, Q-28)', async () => {
    const returns = createMemoryReturnStore({ creatorUid: () => 'uid-1' });
    const t = setup({ sources: () => [returnMediaSource(returns, () => 'uid-1')] });
    const made = await returns.createReturn({
      id: 'ret-1' as ReturnCaseId,
      shopId: SHOP,
      atDevice: 1,
      eventId: 'ev-1',
      observedCode: null,
      link: null,
      lines: [],
    });
    await returns.createMedia({
      id: 'm1',
      shopId: SHOP,
      returnId: made.returnCase.id,
      kind: 'photo',
      atDevice: 2,
    });
    await returns.applyMediaEvent(SHOP, 'm1', d('STOP_RECORDING'), 3, { localPath: 'tmp/x.jpg' });
    await returns.applyMediaEvent(SHOP, 'm1', d('LOCAL_FILE_READABLE'), 4, {
      localPath: 'evidence/m1.jpg',
      sizeBytes: SIZE,
      sha256Client: HASH,
    });
    await returns.markReturnPublished(SHOP, made.returnCase.id, 5);
    await t.failThenDue();
    await t.queue.runOnce(SHOP);
    expect(t.hashCalls()).toBe(1);
    expect(t.uploads).toEqual(['m1', 'm1']);
    const media = (await returns.listMedia(SHOP, made.returnCase.id))[0];
    expect(media).toMatchObject({
      state: 'uploaded',
      hashedFingerprint: { sizeBytes: SIZE, modifiedAtMs: 5_000 },
    });
  });
});
