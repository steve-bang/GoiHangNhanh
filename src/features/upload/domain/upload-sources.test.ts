import type { EvidenceId, ReturnCaseId, ShopId } from '@/core/ids';
import { mayHaveReachedServer } from '@/features/evidence';
import { createMemoryEvidenceFileStore } from '@/features/orders';
import { createMemoryReturnStore, type ReturnStore } from '@/features/returns';

import { MAX_UPLOAD_ATTEMPTS } from './backoff';
import type {
  HashResult,
  ServerFileState,
  UploadGateway,
  UploadOutcome,
  UploadRequest,
  UploadSource,
} from './ports';
import { createUploadGateway } from './create-upload-gateway';
import { evidenceWrite } from './evidence-document';
import { createUploadQueue } from './upload-queue';
import { evidenceFileSource, returnMediaSource } from './upload-sources';

const SHOP = 'shop-1' as ShopId;
const HASH = 'ab'.repeat(32);
const d = (type: string) => ({ type, origin: 'device' }) as never;

async function returnWithPhoto(
  store: ReturnStore,
  id: string,
  published = true,
  kind: 'photo' | 'video' = 'photo',
) {
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  const made = await store.createReturn({
    id: `ret-${id}` as ReturnCaseId,
    shopId: SHOP,
    atDevice: 1,
    eventId: `ev-${id}`,
    observedCode: null,
    link: null,
    lines: [],
  });
  await store.createMedia({
    id,
    shopId: SHOP,
    returnId: made.returnCase.id,
    kind,
    atDevice: 2,
  });
  await store.applyMediaEvent(SHOP, id, d('STOP_RECORDING'), 3, { localPath: `tmp/x.${ext}` });
  await store.applyMediaEvent(SHOP, id, d('LOCAL_FILE_READABLE'), 4, {
    localPath: `evidence/${id}.${ext}`,
    sizeBytes: 50,
    sha256Client: HASH,
  });
  if (published) await store.markReturnPublished(SHOP, made.returnCase.id, 5);
  return made.returnCase.id;
}

function setup(options: { extraSources?: UploadSource[] } = {}) {
  const returns = createMemoryReturnStore({ creatorUid: () => 'uid-1' });
  const files = createMemoryEvidenceFileStore();
  let clock = 10_000;
  const requests: UploadRequest[] = [];
  const outcomes: UploadOutcome[] = [];
  const serverStates = new Map<EvidenceId, ServerFileState>();
  let hashResult: HashResult = { ok: true, sha256: HASH };
  const gateway: UploadGateway = {
    upload: async (req) => {
      requests.push(req);
      return outcomes.shift() ?? { kind: 'received' };
    },
    fetchServerStates: async () => serverStates,
  };
  const queue = createUploadQueue({
    sources: [
      evidenceFileSource(files),
      returnMediaSource(returns, () => 'uid-1'),
      ...(options.extraSources ?? []),
    ],
    gateway,
    hasher: { sha256: async () => hashResult },
    now: () => clock,
    isOnline: () => true,
  });
  return {
    returns,
    files,
    queue,
    requests,
    outcomes,
    serverStates,
    advance: (ms: number) => void (clock += ms),
    setHash: (h: HashResult) => void (hashResult = h),
    media: async (id: string, returnId: ReturnCaseId) =>
      (await returns.listMedia(SHOP, returnId)).find((m) => m.id === id),
  };
}

describe('hàng đợi tải lên với nguồn media hàng hoàn (Q-28)', () => {
  it('tải ảnh hàng hoàn kèm chủ sở hữu "return" (không có phiên/đơn/kiện) và chuyển sang uploaded do phản hồi máy chủ', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    const summary = await t.queue.runOnce(SHOP);
    expect(summary).toMatchObject({ received: 1, failed: 0 });
    expect(t.requests).toHaveLength(1);
    expect(t.requests[0]).toMatchObject({
      evidenceId: 'ph-1',
      owner: { kind: 'return', returnId },
      kind: 'photo',
      localPath: 'evidence/ph-1.jpg',
      sha256Client: HASH,
    });
    expect((await t.media('ph-1', returnId))?.state).toBe('uploaded');
  });

  it('chưa đăng bản neo thì chưa tải; đăng xong lượt sau mới tải', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1', false);
    await t.queue.runOnce(SHOP);
    expect(t.requests).toEqual([]);
    expect((await t.media('ph-1', returnId))?.state).toBe('queued');
    await t.returns.markReturnPublished(SHOP, returnId, 6);
    await t.queue.runOnce(SHOP);
    expect(t.requests.map((r) => r.evidenceId)).toEqual(['ph-1']);
  });

  it('lỗi tạm: tăng số lần thử, giãn cách, rồi thử lại; hết MAX_UPLOAD_ATTEMPTS lần thì cần xử lý', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
    await t.queue.runOnce(SHOP);
    expect(await t.media('ph-1', returnId)).toMatchObject({
      state: 'upload_failed',
      attemptCount: 1,
      lastErrorCode: 'NETWORK',
    });
    // chưa tới giờ thử lại: không tải
    await t.queue.runOnce(SHOP);
    expect(t.requests).toHaveLength(1);
    for (let i = 1; i < MAX_UPLOAD_ATTEMPTS; i += 1) {
      t.advance(16 * 60_000);
      t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
      await t.queue.runOnce(SHOP);
    }
    expect(await t.media('ph-1', returnId)).toMatchObject({
      state: 'needs_attention',
      lastErrorCode: 'NETWORK',
    });
  });

  it('mã băm cục bộ đổi: cần xử lý ngay, không tải, không khai báo gì lên máy chủ', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    t.setHash({ ok: true, sha256: 'ff'.repeat(32) });
    await t.queue.runOnce(SHOP);
    expect(t.requests).toEqual([]);
    expect(await t.media('ph-1', returnId)).toMatchObject({
      state: 'needs_attention',
      lastErrorCode: 'LOCAL_HASH_CHANGED',
    });
  });

  it('đối soát sau khi app bị tắt giữa lúc tải: máy chủ báo verified thì đi qua uploaded rồi verified (sự kiện server)', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    await t.returns.applyMediaEvent(SHOP, 'ph-1', d('UPLOAD_STARTED'), 6);
    t.serverStates.set('ph-1' as EvidenceId, 'verified');
    const summary = await t.queue.runOnce(SHOP);
    expect(summary.verified).toBe(1);
    expect((await t.media('ph-1', returnId))?.state).toBe('verified');
    expect(t.requests).toEqual([]);
  });

  it('máy chủ báo hash_mismatch thì ảnh vào hash_mismatch, không bao giờ verified', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    await t.returns.applyMediaEvent(SHOP, 'ph-1', d('UPLOAD_STARTED'), 6);
    t.serverStates.set('ph-1' as EvidenceId, 'hash_mismatch');
    await t.queue.runOnce(SHOP);
    expect((await t.media('ph-1', returnId))?.state).toBe('hash_mismatch');
  });

  it('một nguồn lỗi kho không chặn nguồn khác trong cùng lượt', async () => {
    const broken: UploadSource = {
      listByStates: async () => {
        throw new Error('db');
      },
      applyEvent: async () => ({ ok: false, error: 'x' }),
    };
    const t = setup({ extraSources: [broken] });
    await returnWithPhoto(t.returns, 'ph-1');
    await t.queue.runOnce(SHOP);
    expect(t.requests.map((r) => r.evidenceId)).toEqual(['ph-1']);
  });

  it('không tải media của người khác tạo hoặc khi chưa đăng nhập', async () => {
    const others = createMemoryReturnStore({ creatorUid: () => 'uid-2' });
    await returnWithPhoto(others, 'ph-x');
    const t = setup();
    const queue = createUploadQueue({
      sources: [returnMediaSource(others, () => 'uid-1'), returnMediaSource(t.returns, () => null)],
      gateway: {
        upload: async (r) => (t.requests.push(r), { kind: 'received' }),
        fetchServerStates: async () => new Map(),
      },
      hasher: { sha256: async () => ({ ok: true, sha256: HASH }) },
      now: () => 1,
      isOnline: () => true,
    });
    await returnWithPhoto(t.returns, 'ph-y');
    await queue.runOnce(SHOP);
    expect(t.requests).toEqual([]);
  });

  it('xóa ảnh sau khi đã bắt đầu tải bị từ chối; ảnh hỏng cục bộ trước khi khai báo thì xóa được', async () => {
    const t = setup();
    await returnWithPhoto(t.returns, 'ph-1');
    await returnWithPhoto(t.returns, 'ph-2');
    t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
    t.setHash({ ok: true, sha256: HASH });
    await t.queue.runOnce(SHOP); // ph-1 thử tải và lỗi tạm; ph-2 nhận được
    await expect(t.returns.checkMediaDeletable(SHOP, 'ph-1')).rejects.toMatchObject({
      code: 'RETURN_PHOTO_IN_USE',
    });
    await expect(t.returns.checkMediaDeletable(SHOP, 'ph-2')).rejects.toMatchObject({
      code: 'RETURN_PHOTO_IN_USE',
    });
    // ph-3: tệp đổi trước khi khai báo -> máy chủ chưa biết -> xóa được
    await returnWithPhoto(t.returns, 'ph-3');
    t.setHash({ ok: true, sha256: 'ff'.repeat(32) });
    await t.queue.runOnce(SHOP);
    expect((await t.returns.checkMediaDeletable(SHOP, 'ph-3')).ok).toBe(true);
  });

  it('video hàng hoàn: giữ kind video, đi hết cổng thật (mime video, khai báo original_video) và tới uploaded', async () => {
    const returns = createMemoryReturnStore({ creatorUid: () => 'uid-1' });
    const returnId = await returnWithPhoto(returns, 'vd-1', true, 'video');
    const declared: Array<ReturnType<typeof evidenceWrite>['data']> = [];
    const sent: string[] = [];
    const gateway = createUploadGateway({
      declarer: {
        declare: async (r) => {
          const doc = evidenceWrite(
            r,
            'uid-1',
            { serverTimestamp: () => 'ts', timestamp: (ms) => ms },
            undefined,
          );
          declared.push(doc.data);
        },
      },
      sessions: {
        create: async () => ({ status: 'ready', url: 'u', method: 'POST', headers: {} }),
      },
      bytes: { send: async (_s, path) => void sent.push(path) },
      serverStates: { read: async () => new Map() },
    });
    const queue = createUploadQueue({
      sources: [returnMediaSource(returns, () => 'uid-1')],
      gateway,
      hasher: { sha256: async () => ({ ok: true, sha256: HASH }) },
      now: () => 10_000,
      isOnline: () => true,
    });
    const summary = await queue.runOnce(SHOP);
    expect(summary).toMatchObject({ received: 1, failed: 0, needsAttention: 0 });
    expect(sent).toEqual(['evidence/vd-1.mp4']);
    expect(declared[0]).toMatchObject({
      ownerKind: 'return',
      returnId,
      kind: 'original_video',
      mimeType: 'video/mp4',
    });
    expect(declared[0]).not.toHaveProperty('durationMs');
    const media = (await returns.listMedia(SHOP, returnId)).find((m) => m.id === 'vd-1');
    expect(media?.state).toBe('uploaded');
  });

  it('ảnh đang uploading rồi app bị tắt: sau đối soát về hàng đợi vẫn bị coi là có thể đã tới máy chủ (không được xóa)', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    await t.returns.applyMediaEvent(SHOP, 'ph-1', d('UPLOAD_STARTED'), 6);
    // Máy chủ chưa có; lượt chạy đưa về queued rồi tải lại. Chặn tải lại để xem trạng thái trung gian.
    t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
    await t.queue.runOnce(SHOP);
    const after = await t.media('ph-1', returnId);
    expect(after && mayHaveReachedServer(after)).toBe(true);
    expect(after?.attemptCount).toBeGreaterThan(0);
    await expect(t.returns.checkMediaDeletable(SHOP, 'ph-1')).rejects.toMatchObject({
      code: 'RETURN_PHOTO_IN_USE',
    });
  });

  it('reconcile để lại dấu UPLOAD_INTERRUPTED + attemptCount khi tải lại bị hoãn (không còn queued "sạch")', async () => {
    const t = setup();
    const returnId = await returnWithPhoto(t.returns, 'ph-1');
    await t.returns.applyMediaEvent(SHOP, 'ph-1', d('UPLOAD_STARTED'), 6);
    let calls = 0;
    const queue = createUploadQueue({
      sources: [returnMediaSource(t.returns, () => 'uid-1')],
      gateway: {
        upload: async () => ({ kind: 'received' }),
        fetchServerStates: async () => new Map(),
      },
      hasher: { sha256: async () => ({ ok: true, sha256: HASH }) },
      now: () => 10_000,
      isOnline: () => {
        calls += 1;
        return calls < 2; // rớt mạng ngay sau reconcile, trước khi tải
      },
    });
    await queue.runOnce(SHOP);
    const m = await t.media('ph-1', returnId);
    expect(m).toMatchObject({
      state: 'queued',
      attemptCount: 1,
      lastErrorCode: 'UPLOAD_INTERRUPTED',
    });
    expect(m && mayHaveReachedServer(m)).toBe(true);
  });
});
