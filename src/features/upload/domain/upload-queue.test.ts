import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFile, EvidenceFileStore } from '@/features/evidence';
import { createMemoryEvidenceFileStore } from '@/features/orders';

import { MAX_UPLOAD_ATTEMPTS, retryDelayMs } from './backoff';
import { UPLOAD_FILE_TOO_LARGE, VIDEO_MAX_BYTES } from './limits';
import type { HashResult, ServerFileState, UploadGateway, UploadOutcome } from './ports';
import { createUploadQueue, mayBeKnownToServer } from './upload-queue';
import { evidenceFileSource } from './upload-sources';

const SHOP = 'shop-1' as ShopId;
const HASH = 'ab'.repeat(32);

async function queuedFile(
  files: EvidenceFileStore,
  id: string,
  at = 1000,
  sizeBytes = 100,
): Promise<EvidenceFile> {
  await files.create({
    id: id as EvidenceId,
    shopId: SHOP,
    orderId: `o-${id}` as OrderId,
    packageId: `p-${id}` as PackageId,
    sessionId: `s-${id}` as SessionId,
    group: 'pack',
    kind: 'video',
    createdAtDevice: at,
  });
  const d = (type: string) => ({ type, origin: 'device' }) as never;
  await files.applyEvent(SHOP, id as EvidenceId, d('STOP_RECORDING'), at);
  const r = await files.applyEvent(SHOP, id as EvidenceId, d('LOCAL_FILE_READABLE'), at, {
    localPath: `file:///v/${id}.mp4`,
    sizeBytes,
    sha256Client: HASH,
  });
  if (!r.ok) throw new Error('fixture');
  return r.file;
}

function setup(options: { online?: boolean; hash?: HashResult } = {}) {
  const files = createMemoryEvidenceFileStore();
  let clock = 10_000;
  let online = options.online ?? true;
  const uploads: string[] = [];
  const outcomes: UploadOutcome[] = [];
  const serverStates = new Map<EvidenceId, ServerFileState>();
  let throwOnUpload = false;
  let throwOnFetch = false;
  const gateway: UploadGateway = {
    upload: async (req) => {
      uploads.push(req.evidenceId);
      if (throwOnUpload) throw new Error('boom');
      return outcomes.shift() ?? { kind: 'received' };
    },
    fetchServerStates: async () => {
      if (throwOnFetch) throw new Error('offline');
      return serverStates;
    },
  };
  let hashResult: HashResult = options.hash ?? { ok: true, sha256: HASH };
  const queue = createUploadQueue({
    sources: [evidenceFileSource(files)],
    gateway,
    hasher: { sha256: async () => hashResult },
    now: () => clock,
    isOnline: () => online,
  });
  return {
    files,
    queue,
    uploads,
    outcomes,
    serverStates,
    advance: (ms: number) => void (clock += ms),
    setOnline: (v: boolean) => void (online = v),
    setHash: (h: HashResult) => void (hashResult = h),
    failUploads: (v: boolean) => void (throwOnUpload = v),
    failFetch: (v: boolean) => void (throwOnFetch = v),
    state: async (id: string) => (await files.get(SHOP, id as EvidenceId))?.state,
  };
}

describe('retryDelayMs', () => {
  it('tăng gấp đôi và chặn ở 15 phút', () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([5000, 10000, 20000]);
    expect(retryDelayMs(50)).toBe(15 * 60_000);
    expect(retryDelayMs(0)).toBe(5000);
  });
});

describe('hàng đợi tải lên', () => {
  it('tải tệp trong hàng đợi và dừng ở uploaded (không tự verified)', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    const summary = await t.queue.runOnce(SHOP);
    expect(summary).toMatchObject({ received: 1, failed: 0, needsAttention: 0 });
    expect(await t.state('a')).toBe('uploaded');
    expect(t.uploads).toEqual(['a']);
  });

  it('lượt sau: máy chủ báo verified thì tệp thành verified; hash_mismatch thì cách ly', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await queuedFile(t.files, 'b', 2000);
    await t.queue.runOnce(SHOP);
    t.serverStates.set('a' as EvidenceId, 'verified');
    t.serverStates.set('b' as EvidenceId, 'hash_mismatch');
    const summary = await t.queue.runOnce(SHOP);
    expect(summary.verified).toBe(1);
    expect(await t.state('a')).toBe('verified');
    expect(await t.state('b')).toBe('hash_mismatch');
  });

  it('ngoại tuyến: không làm gì, tệp vẫn queued', async () => {
    const t = setup({ online: false });
    await queuedFile(t.files, 'a');
    expect((await t.queue.runOnce(SHOP)).skipped).toBe('offline');
    expect(t.uploads).toEqual([]);
    expect(await t.state('a')).toBe('queued');
  });

  it('lỗi tạm: upload_failed, ghi số lần + giờ thử lại; chưa tới giờ thì không thử', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
    await t.queue.runOnce(SHOP);
    const failed = await t.files.get(SHOP, 'a' as EvidenceId);
    expect(failed).toMatchObject({
      state: 'upload_failed',
      attemptCount: 1,
      lastErrorCode: 'NETWORK',
      nextAttemptAtDevice: 10_000 + retryDelayMs(1),
    });
    t.advance(retryDelayMs(1) - 1);
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toHaveLength(1);
    t.advance(1);
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toHaveLength(2);
    expect(await t.state('a')).toBe('uploaded');
    expect(await t.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      lastErrorCode: null,
      nextAttemptAtDevice: null,
    });
  });

  it('cổng ném lỗi được coi là lỗi tạm, không làm sập lượt chạy', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.failUploads(true);
    const summary = await t.queue.runOnce(SHOP);
    expect(summary.failed).toBe(1);
    expect(await t.state('a')).toBe('upload_failed');
  });

  it('quá số lần thử tối đa thì needs_attention thay vì thử mãi', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    for (let i = 0; i < MAX_UPLOAD_ATTEMPTS; i += 1) {
      t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
      await t.queue.runOnce(SHOP);
      t.advance(20 * 60_000);
    }
    expect(await t.state('a')).toBe('needs_attention');
    const before = t.uploads.length;
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toHaveLength(before);
  });

  it('lỗi cần người dùng xử lý: needs_attention ngay, giữ mã lỗi', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.outcomes.push({ kind: 'attention', code: 'AUTH_EXPIRED' });
    const summary = await t.queue.runOnce(SHOP);
    expect(summary.needsAttention).toBe(1);
    expect(await t.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      state: 'needs_attention',
      lastErrorCode: 'AUTH_EXPIRED',
    });
  });

  it('tệp cục bộ mất hoặc đổi nội dung: không tải, needs_attention', async () => {
    const missing = setup({ hash: { ok: false, reason: 'FILE_MISSING' } });
    await queuedFile(missing.files, 'a');
    await missing.queue.runOnce(SHOP);
    expect(missing.uploads).toEqual([]);
    expect(await missing.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      state: 'needs_attention',
      lastErrorCode: 'FILE_MISSING',
    });
    const changed = setup({ hash: { ok: true, sha256: 'cd'.repeat(32) } });
    await queuedFile(changed.files, 'b');
    await changed.queue.runOnce(SHOP);
    expect(changed.uploads).toEqual([]);
    expect(await changed.files.get(SHOP, 'b' as EvidenceId)).toMatchObject({
      lastErrorCode: 'LOCAL_HASH_CHANGED',
    });
  });

  it('app bị tắt giữa chừng (uploading): máy chủ đã nhận thì không tải lại', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.files.applyEvent(
      SHOP,
      'a' as EvidenceId,
      { type: 'UPLOAD_STARTED', origin: 'device' },
      5,
    );
    t.serverStates.set('a' as EvidenceId, 'uploaded');
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual([]);
    expect(await t.state('a')).toBe('uploaded');
  });

  it('app bị tắt giữa chừng (uploading): máy chủ chưa có thì tải lại ngay lượt này', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.files.applyEvent(
      SHOP,
      'a' as EvidenceId,
      { type: 'UPLOAD_STARTED', origin: 'device' },
      5,
    );
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual(['a']);
    expect(await t.state('a')).toBe('uploaded');
  });

  it('đóng gói: tệp uploading bị gián đoạn rồi chưa kịp tải lại vẫn mang dấu đã thử (UPLOAD_INTERRUPTED)', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    await t.files.applyEvent(
      SHOP,
      'a' as EvidenceId,
      { type: 'UPLOAD_STARTED', origin: 'device' },
      5,
    );
    t.outcomes.push({ kind: 'retryable', code: 'NETWORK' });
    await t.queue.runOnce(SHOP);
    // Lượt trên tải lại và lỗi tạm: dấu lần thử không bị mất về 0.
    const file = await t.files.get(SHOP, 'a' as EvidenceId);
    expect(file?.attemptCount).toBeGreaterThanOrEqual(1);
    expect(file?.lastErrorCode).toBe('NETWORK');
  });

  it('không hỏi được máy chủ thì vẫn tải (tải lên idempotent theo id)', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.failFetch(true);
    await t.queue.runOnce(SHOP);
    expect(await t.state('a')).toBe('uploaded');
  });

  it('tải theo thứ tự cũ nhất trước, từng tệp một; shop khác không bị đụng', async () => {
    const t = setup();
    await queuedFile(t.files, 'late', 3000);
    await queuedFile(t.files, 'early', 1000);
    await t.queue.runOnce('shop-khac' as ShopId);
    expect(t.uploads).toEqual([]);
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual(['early', 'late']);
  });

  it('hai lượt chạy chồng nhau: lượt sau bị bỏ qua (busy)', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    const [first, second] = await Promise.all([t.queue.runOnce(SHOP), t.queue.runOnce(SHOP)]);
    expect([first.skipped, second.skipped].filter((s) => s === 'busy')).toHaveLength(1);
    expect(t.uploads).toEqual(['a']);
  });

  it('tệp chưa đóng (recording/saving_local) không bao giờ được tải', async () => {
    const t = setup();
    await t.files.create({
      id: 'r' as EvidenceId,
      shopId: SHOP,
      orderId: 'o' as OrderId,
      packageId: 'p' as PackageId,
      sessionId: 's' as SessionId,
      group: 'pack',
      kind: 'video',
      createdAtDevice: 1,
    });
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual([]);
    expect(await t.state('r')).toBe('recording');
  });
});

describe('đối soát chỉ hỏi máy chủ về tệp máy chủ có thể đã biết', () => {
  it.each([
    ['uploading', 0, null, true],
    ['uploaded', 0, null, true],
    ['upload_failed', 1, 'NETWORK', true],
    ['queued', 0, null, false], // chưa từng thử: chưa khai báo
    ['queued', 2, 'NETWORK', true], // đã thử lại
    ['queued', 0, 'HTTP_403', true], // đã xử lý xong lỗi từ máy chủ
    ['needs_attention', 0, 'LOCAL_HASH_CHANGED', false], // lỗi kiểm tra cục bộ, chưa gửi gì
    ['needs_attention', 0, 'FILE_MISSING', false],
    ['needs_attention', 0, 'UPLOAD_REJECTED_400', true],
    ['needs_attention', 3, null, true],
    ['verified', 0, null, false],
    ['saving_local', 0, null, false],
  ] as const)('%s (thử %i lần, mã %s) -> %s', (state, attemptCount, lastErrorCode, expected) => {
    expect(mayBeKnownToServer({ state, attemptCount, lastErrorCode })).toBe(expected);
  });

  it('runOnce không gửi tệp queued chưa từng thử vào lượt hỏi máy chủ; tệp đang tải thì có', async () => {
    const asked: EvidenceId[][] = [];
    const files = createMemoryEvidenceFileStore();
    await queuedFile(files, 'fresh');
    await queuedFile(files, 'inflight', 2000);
    await files.applyEvent(
      SHOP,
      'inflight' as EvidenceId,
      { type: 'UPLOAD_STARTED', origin: 'device' },
      3000,
    );
    const queue = createUploadQueue({
      sources: [evidenceFileSource(files)],
      gateway: {
        upload: async () => ({ kind: 'received' }),
        fetchServerStates: async (_shop, ids) => {
          asked.push([...ids]);
          return new Map();
        },
      },
      hasher: { sha256: async () => ({ ok: true, sha256: HASH }) },
      now: () => 10_000,
      isOnline: () => true,
    });
    await queue.runOnce(SHOP);
    expect(asked).toEqual([['inflight']]);
  });
});

describe('trần dung lượng (V1-04, khớp Rules)', () => {
  it('video vượt 2 000 000 000 byte: cần xử lý ngay, không gửi, giữ tệp; đúng trần vẫn tải', async () => {
    const t = setup();
    await queuedFile(t.files, 'big', 1000, VIDEO_MAX_BYTES + 1);
    await queuedFile(t.files, 'edge', 1000, VIDEO_MAX_BYTES);
    const summary = await t.queue.runOnce(SHOP);
    expect(summary.needsAttention).toBe(1);
    expect(t.uploads).toEqual(['edge']);
    expect(await t.state('big')).toBe('needs_attention');
    const big = await t.files.get(SHOP, 'big' as EvidenceId);
    expect(big?.lastErrorCode).toBe(UPLOAD_FILE_TOO_LARGE);
    expect(big?.localPath).toBe('file:///v/big.mp4');
  });
});
