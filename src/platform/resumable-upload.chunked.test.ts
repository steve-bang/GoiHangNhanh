import type { ChunkSendRequest, ChunkSender } from './chunk-sender';
import { uploadFileResumable, type ResumeOptions } from './resumable-upload';
import { GCS_CHUNK_ALIGNMENT } from './upload-protocol';
import { createMemoryUploadSessionStoreForTest } from './upload-session-store.test-helper';

jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  createUploadTask: () => {
    throw new Error('đường tải nguyên tệp không được dùng ở đây');
  },
}));

const A = GCS_CHUNK_ALIGNMENT;
const CHUNK = 2 * A;
const TOTAL = 5 * A + 100; // 3 khối: 2A, 2A, A+100
const session = {
  url: 'https://signed/start',
  method: 'POST' as const,
  headers: { 'x-goog-resumable': 'start' },
};

/** GCS giả: giữ số byte đã nhận theo URL phiên và ép quy tắc khối của giao thức thật. */
function createFakeGcs(total: number) {
  const state = {
    received: new Map<string, number>(),
    opened: 0,
    expired: new Set<string>(),
    sentRanges: [] as { start: number; end: number }[],
    queries: 0,
    /** Nếu đặt: máy chủ chỉ giữ bền tới mức này sau mỗi khối (mô phỏng nhận một phần). */
    acceptAtMost: null as number | null,
    /** Nếu đặt: chỉ báo 308 mà không nhận thêm byte nào. */
    stall: false,
    /** Nếu đặt: trả mã này cho khối kế tiếp (một lần). */
    nextChunkStatus: null as number | null,
    queryStatus: null as number | null,
    queryRange: undefined as string | undefined,
  };
  const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      state.opened += 1;
      const location = `https://session/${state.opened}`;
      state.received.set(location, 0);
      return new Response(null, { status: 200, headers: { location } });
    }
    state.queries += 1;
    const headers = new Headers(init?.headers as Record<string, string>);
    expect(headers.get('content-range')).toBe(`bytes */${total}`);
    if (state.queryStatus !== null) {
      return new Response(null, {
        status: state.queryStatus,
        headers: state.queryRange ? { range: state.queryRange } : {},
      });
    }
    if (state.expired.has(url)) return new Response(null, { status: 404 });
    const got = state.received.get(url);
    if (got === undefined) return new Response(null, { status: 404 });
    if (got >= total) return new Response(null, { status: 200 });
    return new Response(null, {
      status: 308,
      headers: got > 0 ? { range: `bytes=0-${got - 1}` } : {},
    });
  });
  const sender: ChunkSender & { calls: number; failAt: number | null } = {
    calls: 0,
    failAt: null,
    async send(request: ChunkSendRequest) {
      sender.calls += 1;
      if (sender.failAt !== null && sender.calls === sender.failAt) throw new Error('mất mạng');
      if (request.signal?.aborted) throw new Error('hủy');
      const got = state.received.get(request.url) ?? 0;
      // Quy tắc của giao thức thật: bắt đầu đúng chỗ máy chủ đã có; khối giữa là bội của 256 KiB.
      expect(request.start).toBe(got);
      const length = request.end - request.start + 1;
      const isLast = request.end === total - 1;
      if (!isLast) expect(length % A).toBe(0);
      expect(request.contentRange).toBe(`bytes ${request.start}-${request.end}/${total}`);
      state.sentRanges.push({ start: request.start, end: request.end });
      if (state.nextChunkStatus !== null) {
        const status = state.nextChunkStatus;
        state.nextChunkStatus = null;
        return { status, range: null };
      }
      if (state.stall) return { status: 308, range: got > 0 ? `bytes=0-${got - 1}` : null };
      let kept = request.end + 1;
      if (state.acceptAtMost !== null && !isLast) kept = Math.min(kept, got + state.acceptAtMost);
      state.received.set(request.url, kept);
      if (kept >= total) return { status: 200, range: null };
      return { status: 308, range: `bytes=0-${kept - 1}` };
    },
  };
  return { state, fetchImpl, sender };
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function setup(options: { stored?: { location: string; sizeBytes: number } } = {}) {
  const gcs = createFakeGcs(TOTAL);
  global.fetch = gcs.fetchImpl as unknown as typeof fetch;
  const store = createMemoryUploadSessionStoreForTest();
  if (options.stored) void store.save('shop-a', 'ev-1', options.stored);
  const resume = (over: Partial<ResumeOptions> = {}): ResumeOptions => ({
    store,
    shopId: 'shop-a',
    evidenceId: 'ev-1',
    sizeBytes: TOTAL,
    sender: gcs.sender,
    chunkBytes: CHUNK,
    ...over,
  });
  const run = (signal?: AbortSignal, over: Partial<ResumeOptions> = {}) =>
    uploadFileResumable(session, 'evidence/ev-1.mp4', 'video/mp4', signal, 30_000, resume(over));
  return { gcs, store, run, resume };
}

describe('tải theo khối và tiếp tục (uploadFileResumable có resume)', () => {
  it('lần đầu: mở phiên, lưu Location, gửi 3 khối đúng quy tắc, xong thì xóa phiên', async () => {
    const t = setup();
    expect(await t.run()).toEqual({ ok: true });
    expect(t.gcs.state.opened).toBe(1);
    expect(t.gcs.state.sentRanges).toEqual([
      { start: 0, end: CHUNK - 1 },
      { start: CHUNK, end: 2 * CHUNK - 1 },
      { start: 2 * CHUNK, end: TOTAL - 1 },
    ]);
    expect(await t.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('đứt giữa chừng: giữ phiên; lượt sau KHÔNG mở phiên mới, hỏi offset và chỉ gửi phần còn lại', async () => {
    const t = setup();
    t.gcs.sender.failAt = 3; // khối 1, 2 xong; khối 3 đứt mạng
    expect(await t.run()).toEqual({ ok: false, kind: 'network', code: 'NETWORK' });
    expect(t.gcs.state.opened).toBe(1);
    expect(await t.store.get('shop-a', 'ev-1')).toMatchObject({ sizeBytes: TOTAL });

    t.gcs.state.sentRanges.length = 0;
    t.gcs.sender.failAt = null;
    expect(await t.run()).toEqual({ ok: true });
    expect(t.gcs.state.opened).toBe(1); // vẫn một phiên
    expect(t.gcs.state.sentRanges).toEqual([{ start: 2 * CHUNK, end: TOTAL - 1 }]);
    const sent = t.gcs.state.sentRanges.reduce((n, r) => n + (r.end - r.start + 1), 0);
    expect(sent).toBeLessThan(TOTAL);
    expect(await t.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('app mở lại (kho còn phiên từ trước): tiếp tục từ offset máy chủ báo', async () => {
    const t = setup({ stored: { location: 'https://session/1', sizeBytes: TOTAL } });
    t.gcs.state.received.set('https://session/1', CHUNK); // máy chủ đã có 2 khối đầu từ lần trước
    expect(await t.run()).toEqual({ ok: true });
    expect(t.gcs.state.opened).toBe(0);
    expect(t.gcs.state.sentRanges[0]).toEqual({ start: CHUNK, end: 2 * CHUNK - 1 });
  });

  it('máy chủ chỉ giữ bền một phần khối đã gửi: lấy Range của máy chủ, gửi lại phần thiếu', async () => {
    const t = setup();
    t.gcs.state.acceptAtMost = A; // mỗi khối 2A chỉ giữ A
    expect(await t.run()).toEqual({ ok: true });
    const starts = t.gcs.state.sentRanges.map((r) => r.start);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBe(A); // tiếp từ chỗ máy chủ báo, không phải từ cuối khối cũ
    expect(await t.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('máy chủ báo đã xong ngay lúc hỏi (200): coi là xong, không gửi gì, xóa phiên', async () => {
    const t = setup({ stored: { location: 'https://session/1', sizeBytes: TOTAL } });
    t.gcs.state.received.set('https://session/1', TOTAL);
    expect(await t.run()).toEqual({ ok: true });
    expect(t.gcs.sender.calls).toBe(0);
    expect(await t.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('phiên đã lưu hết hạn (404): bỏ, mở phiên mới đúng một lần và gửi từ đầu', async () => {
    const t = setup({ stored: { location: 'https://session/old', sizeBytes: TOTAL } });
    t.gcs.state.expired.add('https://session/old');
    expect(await t.run()).toEqual({ ok: true });
    expect(t.gcs.state.opened).toBe(1);
    expect(t.gcs.state.sentRanges[0]).toEqual({ start: 0, end: CHUNK - 1 });
  });

  it('phiên mới cũng báo hết hạn ngay: lỗi mạng SESSION_EXPIRED (không tốn lượt), không lặp vô hạn', async () => {
    const t = setup();
    t.gcs.state.queryStatus = 404;
    expect(await t.run()).toEqual({ ok: false, kind: 'network', code: 'SESSION_EXPIRED' });
    expect(t.gcs.state.opened).toBe(2); // mở, hết hạn, mở lại đúng MỘT lần rồi bỏ cuộc
    expect(t.gcs.sender.calls).toBe(0);
    expect(await t.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('tệp đổi kích thước so với phiên đã lưu: bỏ phiên cũ, mở phiên mới', async () => {
    const t = setup({ stored: { location: 'https://session/old', sizeBytes: TOTAL - 1 } });
    expect(await t.run()).toEqual({ ok: true });
    expect(t.gcs.state.opened).toBe(1);
    expect(t.gcs.state.queries).toBeGreaterThan(0);
    expect(await t.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('đã hủy trước khi bắt đầu: NETWORK_LOST, không gọi gì', async () => {
    const t = setup();
    const controller = new AbortController();
    controller.abort();
    expect(await t.run(controller.signal)).toEqual({
      ok: false,
      kind: 'network',
      code: 'NETWORK_LOST',
    });
    expect(t.gcs.fetchImpl).not.toHaveBeenCalled();
  });

  it('hủy giữa lúc gửi khối: NETWORK_LOST và GIỮ phiên', async () => {
    const t = setup();
    const controller = new AbortController();
    const original = t.gcs.sender.send.bind(t.gcs.sender);
    t.gcs.sender.send = async (request) => {
      const response = await original(request);
      controller.abort(); // mất mạng ngay sau khối đầu
      return response;
    };
    expect(await t.run(controller.signal)).toEqual({
      ok: false,
      kind: 'network',
      code: 'NETWORK_LOST',
    });
    expect(await t.store.get('shop-a', 'ev-1')).not.toBeNull();
  });

  it('máy chủ báo 308 mà không nhận thêm byte nào hai lần liên tiếp: bỏ cuộc lượt này (NO_PROGRESS), giữ phiên', async () => {
    const t = setup();
    t.gcs.state.stall = true;
    expect(await t.run()).toEqual({ ok: false, kind: 'retryable', code: 'NO_PROGRESS' });
    expect(await t.store.get('shop-a', 'ev-1')).not.toBeNull();
  });

  it('Range lạ ở 308 (khi hỏi hoặc khi gửi): BAD_RANGE, tính lượt, không đoán', async () => {
    const asked = setup();
    asked.gcs.state.queryStatus = 308;
    asked.gcs.state.queryRange = 'bytes=5-9';
    expect(await asked.run()).toEqual({ ok: false, kind: 'retryable', code: 'BAD_RANGE' });
  });

  it('mã lỗi khi gửi khối được phân loại như đường cũ và giữ phiên (trừ hết hạn)', async () => {
    for (const [status, expected] of [
      [503, { kind: 'network', code: 'HTTP_503' }],
      [403, { kind: 'retryable', code: 'SESSION_REJECTED' }],
      [500, { kind: 'retryable', code: 'HTTP_500' }],
      [400, { kind: 'attention', code: 'UPLOAD_REJECTED_400' }],
    ] as const) {
      const t = setup();
      t.gcs.state.nextChunkStatus = status;
      expect(await t.run()).toEqual({ ok: false, ...expected });
      expect(await t.store.get('shop-a', 'ev-1')).not.toBeNull();
    }
    const gone = setup();
    gone.gcs.state.nextChunkStatus = 410;
    expect(await gone.run()).toEqual({ ok: false, kind: 'network', code: 'SESSION_EXPIRED' });
    expect(await gone.store.get('shop-a', 'ev-1')).toBeNull();
  });

  it('kho phiên lỗi: vẫn tải được (từ đầu mỗi lượt), không ném', async () => {
    const t = setup();
    const broken = {
      get: async () => {
        throw new Error('db');
      },
      save: async () => {
        throw new Error('db');
      },
      clear: async () => {
        throw new Error('db');
      },
    };
    expect(await t.run(undefined, { store: broken })).toEqual({ ok: true });
  });

  it('khối hết hạn (quá giờ): lỗi mạng TIMEOUT, không tốn lượt', async () => {
    const t = setup();
    t.gcs.sender.send = (request) =>
      new Promise((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => reject(new Error('hủy')));
      });
    expect(await t.run(undefined, { chunkTimeoutMs: 20 })).toEqual({
      ok: false,
      kind: 'network',
      code: 'TIMEOUT',
    });
  });

  it('không log Location: mã nguồn nhận khối không đưa URL vào kết quả lỗi', async () => {
    const t = setup();
    t.gcs.sender.failAt = 1;
    const result = await t.run();
    expect(JSON.stringify(result)).not.toContain('session/');
  });
});
