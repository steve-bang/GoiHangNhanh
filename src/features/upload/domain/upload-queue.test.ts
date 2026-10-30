import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFile, EvidenceFileStore } from '@/features/evidence';
import { createMemoryEvidenceFileStore } from '@/features/orders';

import { MAX_RETRY_DELAY_MS, MAX_UPLOAD_ATTEMPTS, retryDelayMs } from './backoff';
import type {
  HashResult,
  ServerFileState,
  UploadAttemptOptions,
  UploadGateway,
  UploadOutcome,
} from './ports';
import { createUploadQueue, mayBeKnownToServer } from './upload-queue';
import { evidenceFileSource } from './upload-sources';

const SHOP = 'shop-1' as ShopId;
const HASH = 'ab'.repeat(32);

async function queuedFile(files: EvidenceFileStore, id: string, at = 1000): Promise<EvidenceFile> {
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
    sizeBytes: 100,
    sha256Client: HASH,
  });
  if (!r.ok) throw new Error('fixture');
  return r.file;
}

function setup(
  options: {
    online?: boolean;
    hash?: HashResult;
    sessionPublished?: (sessionId: string) => boolean;
  } = {},
) {
  const files = createMemoryEvidenceFileStore();
  const offlineListeners = new Set<() => void>();
  const signals: (AbortSignal | undefined)[] = [];
  /** Lần tải kế tiếp treo tới khi bị hủy (mô phỏng gửi tệp lớn lúc mất mạng). */
  let hangNext = false;
  let clock = 10_000;
  let online = options.online ?? true;
  const uploads: string[] = [];
  const outcomes: UploadOutcome[] = [];
  const serverStates = new Map<EvidenceId, ServerFileState>();
  let throwOnUpload = false;
  let throwOnFetch = false;
  const gateway: UploadGateway = {
    upload: async (req, attempt?: UploadAttemptOptions) => {
      uploads.push(req.evidenceId);
      signals.push(attempt?.signal);
      if (throwOnUpload) throw new Error('boom');
      if (hangNext) {
        hangNext = false;
        const signal = attempt?.signal;
        return new Promise<UploadOutcome>((resolve) =>
          signal?.addEventListener('abort', () =>
            resolve({ kind: 'network', code: 'NETWORK_LOST' }),
          ),
        );
      }
      return outcomes.shift() ?? { kind: 'received' };
    },
    fetchServerStates: async () => {
      if (throwOnFetch) throw new Error('offline');
      return serverStates;
    },
  };
  let hashResult: HashResult = options.hash ?? { ok: true, sha256: HASH };
  const sessionPublished = options.sessionPublished;
  const queue = createUploadQueue({
    sources: [
      evidenceFileSource(
        files,
        sessionPublished
          ? { isSessionPublished: async (_shop, sessionId) => sessionPublished(sessionId) }
          : undefined,
      ),
    ],
    gateway,
    hasher: { sha256: async () => hashResult },
    now: () => clock,
    isOnline: () => online,
    subscribeOffline: (listener) => {
      offlineListeners.add(listener);
      return () => void offlineListeners.delete(listener);
    },
  });
  return {
    files,
    queue,
    uploads,
    outcomes,
    serverStates,
    signals,
    offlineListeners,
    hangNextUpload: () => void (hangNext = true),
    goOffline: () => {
      online = false;
      for (const listener of [...offlineListeners]) listener();
    },
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

  it('máy chủ từ chối: upload_failed, ghi số lần + giờ thử lại; chưa tới giờ thì không thử', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.outcomes.push({ kind: 'retryable', code: 'HTTP_500' });
    await t.queue.runOnce(SHOP);
    const failed = await t.files.get(SHOP, 'a' as EvidenceId);
    expect(failed).toMatchObject({
      state: 'upload_failed',
      attemptCount: 1,
      lastErrorCode: 'HTTP_500',
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

  it('máy chủ từ chối quá số lần thử tối đa (8) thì needs_attention thay vì thử mãi', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    expect(MAX_UPLOAD_ATTEMPTS).toBe(8);
    for (let i = 0; i < MAX_UPLOAD_ATTEMPTS; i += 1) {
      t.outcomes.push({ kind: 'retryable', code: 'UPLOAD_REJECTED_403' });
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

describe('lỗi mạng không tốn lượt (Q-24h, V1-02)', () => {
  it('50 lỗi mạng liên tiếp: vẫn upload_failed, attemptCount 0, không bao giờ needs_attention', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    for (let i = 0; i < 50; i += 1) {
      t.outcomes.push({ kind: 'network', code: 'UNAVAILABLE' });
      const summary = await t.queue.runOnce(SHOP);
      expect(summary.needsAttention).toBe(0);
      t.advance(MAX_RETRY_DELAY_MS);
    }
    expect(t.uploads).toHaveLength(50);
    expect(await t.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      state: 'upload_failed',
      attemptCount: 0,
      lastErrorCode: 'UNAVAILABLE',
    });
    await t.queue.runOnce(SHOP);
    expect(await t.state('a')).toBe('uploaded');
  });

  it('mất mạng 30 phút (máy báo offline): không gọi máy chủ, không đổi trạng thái', async () => {
    const t = setup({ online: false });
    await queuedFile(t.files, 'a');
    for (let minute = 0; minute < 30; minute += 1) {
      expect((await t.queue.runOnce(SHOP)).skipped).toBe('offline');
      t.advance(60_000);
    }
    expect(t.uploads).toEqual([]);
    expect(await t.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      state: 'queued',
      attemptCount: 0,
    });
    t.setOnline(true);
    await t.queue.runOnce(SHOP, { networkRestored: true });
    expect(await t.state('a')).toBe('uploaded');
  });

  it('giãn cách theo số lỗi mạng liên tiếp, trần 15 phút', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    const delays: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      t.outcomes.push({ kind: 'network', code: 'TIMEOUT' });
      const before = 10_000 + delays.reduce((sum, d) => sum + d, 0);
      await t.queue.runOnce(SHOP);
      const file = await t.files.get(SHOP, 'a' as EvidenceId);
      const delay = (file?.nextAttemptAtDevice ?? 0) - before;
      delays.push(delay);
      t.advance(delay);
    }
    expect(delays.slice(0, 4)).toEqual([5000, 10_000, 20_000, 40_000]);
    expect(Math.max(...delays)).toBe(MAX_RETRY_DELAY_MS);
  });

  it('có mạng lại: tệp lỗi mạng tới hạn ngay, không chờ hết giãn cách', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    for (let i = 0; i < 10; i += 1) {
      t.outcomes.push({ kind: 'network', code: 'NETWORK' });
      await t.queue.runOnce(SHOP);
      t.advance(MAX_RETRY_DELAY_MS);
    }
    t.outcomes.push({ kind: 'network', code: 'NETWORK' });
    await t.queue.runOnce(SHOP); // giãn cách hiện là 15 phút
    t.advance(1000);
    await t.queue.runOnce(SHOP);
    expect(await t.state('a')).toBe('upload_failed'); // chưa tới hạn
    await t.queue.runOnce(SHOP, { networkRestored: true });
    expect(await t.state('a')).toBe('uploaded');
  });

  it('gặp lỗi mạng thì dừng lượt (tệp sau không bị gọi vô ích)', async () => {
    const t = setup();
    await queuedFile(t.files, 'a', 1000);
    await queuedFile(t.files, 'b', 2000);
    t.outcomes.push({ kind: 'network', code: 'NETWORK' });
    const summary = await t.queue.runOnce(SHOP);
    expect(summary).toMatchObject({ waitingNetwork: 1, failed: 0 });
    expect(t.uploads).toEqual(['a']);
    expect(await t.state('b')).toBe('queued');
  });

  it('lỗi mạng xen kẽ lỗi máy chủ: chỉ lỗi máy chủ được đếm', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    const sequence: UploadOutcome[] = [
      { kind: 'network', code: 'NETWORK' },
      { kind: 'retryable', code: 'HTTP_500' },
      { kind: 'network', code: 'TIMEOUT' },
      { kind: 'retryable', code: 'HTTP_500' },
    ];
    for (const outcome of sequence) {
      t.outcomes.push(outcome);
      await t.queue.runOnce(SHOP);
      t.advance(MAX_RETRY_DELAY_MS);
    }
    expect((await t.files.get(SHOP, 'a' as EvidenceId))?.attemptCount).toBe(2);
  });

  it('mất mạng giữa lúc gửi tệp: lượt bị hủy (signal), lượt được giải phóng, không tốn lượt', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.hangNextUpload();
    const run = t.queue.runOnce(SHOP);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(t.offlineListeners.size).toBe(1);
    t.goOffline();
    const summary = await run;
    expect(summary.waitingNetwork).toBe(1);
    expect(t.signals[0]?.aborted).toBe(true);
    expect(t.offlineListeners.size).toBe(0); // đã hủy đăng ký
    expect(await t.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      state: 'upload_failed',
      attemptCount: 0,
      lastErrorCode: 'NETWORK_LOST',
    });
    // Lượt mới không bị chặn `busy`.
    t.setOnline(true);
    expect((await t.queue.runOnce(SHOP, { networkRestored: true })).skipped).toBeUndefined();
    expect(await t.state('a')).toBe('uploaded');
  });

  it('cổng treo rồi hết giờ (TIMEOUT từ cổng): cờ running hạ, lượt sau chạy được', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    t.outcomes.push({ kind: 'network', code: 'TIMEOUT' });
    await t.queue.runOnce(SHOP);
    t.advance(MAX_RETRY_DELAY_MS);
    const next = await t.queue.runOnce(SHOP);
    expect(next.skipped).toBeUndefined();
    expect(await t.state('a')).toBe('uploaded');
  });
});

describe('chỉ khai báo khi phiên đã đăng lên máy chủ', () => {
  it('phiên chưa đăng: không băm, không gọi máy chủ, tệp giữ queued; đăng xong thì tải', async () => {
    let published = false;
    const t = setup({ sessionPublished: () => published });
    await queuedFile(t.files, 'a');
    for (let i = 0; i < 20; i += 1) await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual([]);
    expect(await t.files.get(SHOP, 'a' as EvidenceId)).toMatchObject({
      state: 'queued',
      attemptCount: 0,
      lastErrorCode: null,
    });
    published = true;
    await t.queue.runOnce(SHOP);
    expect(await t.state('a')).toBe('uploaded');
  });

  it('một tệp chờ phiên không chặn tệp khác của phiên đã đăng', async () => {
    const t = setup({ sessionPublished: (id) => id === 's-b' });
    await queuedFile(t.files, 'a', 1000);
    await queuedFile(t.files, 'b', 2000);
    await t.queue.runOnce(SHOP);
    expect(t.uploads).toEqual(['b']);
  });
});

describe('có mạng lại chỉ rút ngắn chờ cho lỗi mạng (review PR #48)', () => {
  it('tệp lỗi máy chủ giữ lịch giãn cách; tệp lỗi mạng tới hạn ngay', async () => {
    const t = setup();
    await queuedFile(t.files, 'srv', 1000);
    await queuedFile(t.files, 'net', 2000);
    t.outcomes.push({ kind: 'retryable', code: 'HTTP_500' }); // srv: lỗi máy chủ, chờ 5 giây
    t.outcomes.push({ kind: 'network', code: 'NETWORK' }); // net: lỗi mạng, dừng lượt
    await t.queue.runOnce(SHOP);
    expect(await t.state('srv')).toBe('upload_failed');
    expect(await t.state('net')).toBe('upload_failed');
    t.advance(1000); // chưa tới hạn của cả hai
    await t.queue.runOnce(SHOP, { networkRestored: true });
    expect(await t.state('net')).toBe('uploaded');
    expect(await t.files.get(SHOP, 'srv' as EvidenceId)).toMatchObject({
      state: 'upload_failed',
      attemptCount: 1,
      lastErrorCode: 'HTTP_500',
    });
  });

  it('sau khi app khởi động lại (mất bộ đếm), mã lỗi mạng đã lưu vẫn được nhận ra', async () => {
    const t = setup();
    await queuedFile(t.files, 'a');
    for (let i = 0; i < 10; i += 1) {
      t.outcomes.push({ kind: 'network', code: 'TIMEOUT' });
      await t.queue.runOnce(SHOP);
      t.advance(MAX_RETRY_DELAY_MS);
    }
    const restarted = createUploadQueue({
      sources: [evidenceFileSource(t.files)],
      gateway: {
        upload: async () => ({ kind: 'received' }),
        fetchServerStates: async () => new Map(),
      },
      hasher: { sha256: async () => ({ ok: true, sha256: HASH }) },
      now: () => 10_000 + 9 * MAX_RETRY_DELAY_MS + 1000, // chưa hết 15 phút chờ
      isOnline: () => true,
    });
    await restarted.runOnce(SHOP);
    expect(await t.state('a')).toBe('upload_failed'); // chưa tới hạn
    await restarted.runOnce(SHOP, { networkRestored: true });
    expect(await t.state('a')).toBe('uploaded');
  });

  it('có mạng lại trong lúc lượt đang chạy: cờ được nhớ cho lượt sau', async () => {
    const t = setup();
    await queuedFile(t.files, 'a', 1000);
    await queuedFile(t.files, 'b', 2000);
    t.outcomes.push({ kind: 'received' });
    t.outcomes.push({ kind: 'network', code: 'NETWORK' });
    await t.queue.runOnce(SHOP); // a nhận, b lỗi mạng (chờ 5 giây)
    t.hangNextUpload();
    await queuedFile(t.files, 'c', 3000);
    // Lượt treo ở b? Không: b chưa tới hạn; lượt này tải c và treo.
    const running = t.queue.runOnce(SHOP);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await t.queue.runOnce(SHOP, { networkRestored: true })).skipped).toBe('busy');
    t.goOffline(); // hủy lần gửi đang treo
    await running;
    t.setOnline(true);
    await t.queue.runOnce(SHOP);
    expect(await t.state('b')).toBe('uploaded');
  });
});
