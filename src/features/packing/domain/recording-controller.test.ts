import type { EvidenceId, SessionId } from '@/core/ids';
import {
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
  type PackingSession,
} from '@/features/orders';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';

import {
  MIN_FREE_BYTES_TO_RECORD,
  reconcileSavedSessions,
  recoverInterruptedRecordings,
  startRecording,
  type PersistOutcome,
  type HashOutcome,
  type RecordResult,
  type RecordingPorts,
} from './recording-controller';

async function setup() {
  const orders = createMemoryOrderStore();
  const files = createMemoryEvidenceFileStore();
  const details = await seedOrder(orders, sampleOrder());
  const session: PackingSession = sampleSession(details, 1000);
  await orders.saveSession(session);

  let resolveDone: (r: RecordResult) => void = () => undefined;
  let rejectDone: (e: Error) => void = () => undefined;
  const stops: number[] = [];
  const state = {
    recordThrows: false,
    persist: { ok: true, uri: 'file:///docs/evidence/ev-1.mp4', sizeBytes: 2048 } as PersistOutcome,
    hash: { ok: true, sha256: 'ab'.repeat(32), sizeBytes: 2048 } as HashOutcome,
    persistCalls: [] as string[],
    /** Nếu đặt: `hash` chờ promise này (mô phỏng băm rất lâu, để "kill" giữa chừng). */
    hashGate: null as Promise<void> | null,
  };
  const ports: RecordingPorts = {
    files,
    orders,
    recorder: {
      record: () => {
        if (state.recordThrows) throw new Error('camera');
        return {
          done: new Promise<RecordResult>((resolve, reject) => {
            resolveDone = resolve;
            rejectDone = reject;
          }),
          stop: () => void stops.push(1),
        };
      },
    },
    persist: (temp, id) => {
      state.persistCalls.push(`${temp}->${id}`);
      return state.persist;
    },
    hash: async () => (state.hashGate ? state.hashGate.then(() => state.hash) : state.hash),
    newEvidenceId: () => 'ev-1' as EvidenceId,
    now: () => 5000,
  };
  return {
    ports,
    orders,
    files,
    session,
    state,
    stops,
    finish: (r: RecordResult) => resolveDone(r),
    crash: () => rejectDone(new Error('x')),
    fileState: async () => (await files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId))?.state,
  };
}

const flushPromises = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};

const started = async (t: Awaited<ReturnType<typeof setup>>) => {
  const active = await startRecording(t.ports, t.session);
  if ('kind' in active) throw new Error('should start');
  return active;
};

describe('startRecording', () => {
  it('tạo bản ghi tệp (đủ ID phiên/kiện/đơn) và phiên recording TRƯỚC khi ghi', async () => {
    const t = await setup();
    await started(t);
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'recording',
      sessionId: t.session.id,
      packageId: t.session.packageId,
      orderId: t.session.orderId,
      group: 'pack',
      kind: 'video',
    });
    expect((await t.orders.getSession(LOCAL_SHOP_ID, t.session.id))?.id).toBe(t.session.id);
  });

  it('dừng thành công: saving_local -> chuyển tệp -> băm -> queued với đủ chi tiết, phiên ended', async () => {
    const t = await setup();
    const active = await started(t);
    active.stop();
    expect(t.stops).toHaveLength(1);
    t.finish({ ok: true, tempUri: 'file:///cache/Camera/x.mov' });
    expect(await active.result).toEqual({ kind: 'saved', evidenceId: 'ev-1' });
    expect(t.state.persistCalls).toEqual(['file:///cache/Camera/x.mov->ev-1']);
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'queued',
      localPath: 'file:///docs/evidence/ev-1.mp4',
      sizeBytes: 2048,
      sha256Client: 'ab'.repeat(32),
    });
  });

  it('không chuyển được tệp vào thư mục bền: local_save_failed, KHÔNG báo đã lưu, giữ tệp tạm', async () => {
    const t = await setup();
    const active = await started(t);
    t.state.persist = { ok: false, reason: 'STORAGE_FULL' };
    t.finish({ ok: true, tempUri: 'file:///cache/x.mp4' });
    expect(await active.result).toEqual({
      kind: 'failed',
      evidenceId: 'ev-1',
      reason: 'STORAGE_FULL',
    });
    expect(await t.fileState()).toBe('local_save_failed');
  });

  it('không băm được: local_save_failed + FILE_UNREADABLE (không vào hàng đợi tải lên)', async () => {
    const t = await setup();
    const active = await started(t);
    t.state.hash = { ok: false, reason: 'FILE_UNREADABLE' };
    t.finish({ ok: true, tempUri: 'file:///cache/x.mp4' });
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'FILE_UNREADABLE' });
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
  });

  it('bộ ghi báo lỗi khi đang quay: tệp local_save_failed, phiên interrupted', async () => {
    const t = await setup();
    const active = await started(t);
    t.finish({ ok: false, reason: 'RECORDER_FAILED' });
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'RECORDER_FAILED' });
    expect(await t.fileState()).toBe('local_save_failed');
    const crashed = await setup();
    const a2 = await started(crashed);
    crashed.crash();
    expect(await a2.result).toMatchObject({ kind: 'failed', reason: 'RECORDER_FAILED' });
  });

  it('ghi đường dẫn bền NGAY sau khi chuyển tệp, TRƯỚC khi băm xong (kill giữa lúc băm không mất dấu)', async () => {
    const t = await setup();
    const active = await started(t);
    t.state.hashGate = new Promise<void>(() => undefined); // băm "không bao giờ" xong = app bị kill
    t.finish({ ok: true, tempUri: 'file:///cache/x.mov' });
    await flushPromises();
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'saving_local',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
    void active;
  });

  it('KILL sau persist, trước LOCAL_FILE_READABLE: khôi phục thấy tệp bền và đưa vào hàng đợi (không unrecoverable)', async () => {
    const t = await setup();
    await started(t);
    t.state.hashGate = new Promise<void>(() => undefined);
    t.finish({ ok: true, tempUri: 'file:///cache/x.mov' });
    await flushPromises();
    // "Khởi động lại": tệp tạm không còn, tệp bền còn.
    const result = await recoverInterruptedRecordings(
      {
        files: t.files,
        orders: t.orders,
        persist: t.ports.persist,
        hash: async () => t.state.hash,
        now: () => 9000,
        exists: (p) => p === 'file:///docs/evidence/ev-1.mp4',
        findPersisted: () => null,
      },
      LOCAL_SHOP_ID,
    );
    expect(result).toEqual({ interrupted: 1, lost: 0 });
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'queued',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
    expect(t.state.persistCalls).toEqual(['file:///cache/x.mov->ev-1']); // không chuyển lại
  });

  it('vào hàng đợi lỗi sau khi chuyển tệp: vẫn giữ đường dẫn bền thật (không trỏ về tệp tạm đã mất)', async () => {
    const t = await setup();
    const active = await started(t);
    t.state.hash = { ok: true, sha256: 'ab'.repeat(32), sizeBytes: 0 }; // kích thước 0 -> MISSING_FILE_DETAILS
    t.finish({ ok: true, tempUri: 'file:///cache/x.mp4' });
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'SAVE_FAILED' });
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
  });

  it('kho lỗi lúc ghi đường dẫn bền: không ném ra ngoài, vẫn ghi lỗi kèm đường dẫn bền', async () => {
    const t = await setup();
    const real = t.files.applyEvent.bind(t.files);
    let failMoved = true;
    const flaky = {
      ...t.files,
      applyEvent: (...args: Parameters<typeof real>) => {
        if (args[2].type === 'LOCAL_FILE_MOVED' && failMoved) {
          failMoved = false;
          return Promise.reject(new Error('db'));
        }
        return real(...args);
      },
    };
    const active = await startRecording({ ...t.ports, files: flaky }, t.session);
    if ('kind' in active) throw new Error('should start');
    t.finish({ ok: true, tempUri: 'file:///cache/x.mp4' });
    expect(await active.result).toMatchObject({ kind: 'failed', reason: 'SAVE_FAILED' });
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
  });

  it('A04: dung lượng trống dưới ngưỡng thì từ chối bắt đầu, chưa tạo tệp hay phiên recording, chưa gọi bộ ghi', async () => {
    const t = await setup();
    let recordCalls = 0;
    const ports: RecordingPorts = {
      ...t.ports,
      availableBytes: () => MIN_FREE_BYTES_TO_RECORD - 1,
      recorder: {
        record: () => {
          recordCalls += 1;
          return t.ports.recorder.record();
        },
      },
    };
    expect(await startRecording(ports, t.session)).toEqual({
      kind: 'failed',
      reason: 'INSUFFICIENT_STORAGE',
    });
    expect(recordCalls).toBe(0);
    expect(await t.fileState()).toBeUndefined();
    expect((await t.orders.getSession(LOCAL_SHOP_ID, t.session.id))?.sessionStatus).toBe('created');
  });

  it('A04: đủ dung lượng hoặc không biết dung lượng thì bắt đầu bình thường', async () => {
    for (const available of [MIN_FREE_BYTES_TO_RECORD, null]) {
      const t = await setup();
      const active = await startRecording(
        { ...t.ports, availableBytes: () => available },
        t.session,
      );
      expect('kind' in active).toBe(false);
    }
  });

  it('camera không bắt đầu được: không treo ở "đang quay"', async () => {
    const t = await setup();
    t.state.recordThrows = true;
    expect(await startRecording(t.ports, t.session)).toEqual({
      kind: 'failed',
      reason: 'RECORDER_FAILED',
    });
    expect(await t.fileState()).toBe('local_save_failed');
  });

  it('không tạo được bản ghi tệp (kho lỗi): không quay', async () => {
    const t = await setup();
    const broken = {
      ...t.ports,
      files: {
        ...t.files,
        create: async () => {
          throw new Error('db');
        },
      },
    };
    expect(await startRecording(broken, t.session)).toEqual({
      kind: 'failed',
      reason: 'LOCAL_STORE',
    });
  });
});

describe('recoverInterruptedRecordings', () => {
  const recoverPorts = (
    t: Awaited<ReturnType<typeof setup>>,
    present: string[],
    over: Partial<{
      persist: RecordingPorts['persist'];
      hash: RecordingPorts['hash'];
      durable: string | null;
    }> = {},
  ) => ({
    files: t.files,
    orders: t.orders,
    persist: over.persist ?? t.ports.persist,
    hash: over.hash ?? t.ports.hash,
    now: () => 9000,
    exists: (p: string) => present.includes(p),
    findPersisted: () => over.durable ?? null,
  });
  const stopAt = (t: Awaited<ReturnType<typeof setup>>, path: string) =>
    t.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      1,
      { localPath: path },
    );
  const sessionStatus = async (t: Awaited<ReturnType<typeof setup>>) =>
    (await t.orders.getSession(LOCAL_SHOP_ID, t.session.id))?.sessionStatus;

  it('đang recording khi app bị kill: không biết tệp ở đâu -> unrecoverable (ghi nhận thiếu), phiên interrupted', async () => {
    const t = await setup();
    await started(t);
    expect(await recoverInterruptedRecordings(recoverPorts(t, []), LOCAL_SHOP_ID)).toEqual({
      interrupted: 1,
      lost: 1,
    });
    expect(await t.fileState()).toBe('unrecoverable');
    expect(await sessionStatus(t)).toBe('interrupted');
  });

  it('đang lưu và còn tệp tạm: chuyển, băm và đưa vào hàng đợi; vẫn đánh dấu phiên gián đoạn', async () => {
    const t = await setup();
    await started(t);
    await stopAt(t, 'file:///cache/x.mp4');
    expect(
      await recoverInterruptedRecordings(recoverPorts(t, ['file:///cache/x.mp4']), LOCAL_SHOP_ID),
    ).toEqual({ interrupted: 1, lost: 0 });
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'queued',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
    expect(await sessionStatus(t)).toBe('interrupted');
  });

  it('DB còn trỏ tệp tạm đã mất nhưng tệp bền theo ID còn: dùng tệp bền, không unrecoverable', async () => {
    const t = await setup();
    await started(t);
    await stopAt(t, 'file:///cache/da-mat.mp4');
    await recoverInterruptedRecordings(
      recoverPorts(t, ['evidence/ev-1.mp4'], { durable: 'evidence/ev-1.mp4' }),
      LOCAL_SHOP_ID,
    );
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'queued',
      localPath: 'evidence/ev-1.mp4',
    });
    expect(t.state.persistCalls).toEqual([]);
  });

  it('đang lưu nhưng mất tệp ở CẢ hai nơi: unrecoverable', async () => {
    const t = await setup();
    await started(t);
    await stopAt(t, 'file:///cache/gone.mp4');
    expect(await recoverInterruptedRecordings(recoverPorts(t, []), LOCAL_SHOP_ID)).toEqual({
      interrupted: 1,
      lost: 1,
    });
    expect(await t.fileState()).toBe('unrecoverable');
  });

  it('chuyển tệp lỗi tạm thời (máy đầy): KHÔNG unrecoverable, giữ local_save_failed + đường dẫn tạm thật', async () => {
    const t = await setup();
    await started(t);
    await stopAt(t, 'file:///cache/x.mp4');
    const result = await recoverInterruptedRecordings(
      recoverPorts(t, ['file:///cache/x.mp4'], {
        persist: () => ({ ok: false, reason: 'STORAGE_FULL' }),
      }),
      LOCAL_SHOP_ID,
    );
    expect(result).toEqual({ interrupted: 1, lost: 0 });
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///cache/x.mp4',
    });
  });

  it('tệp tạm biến mất đúng lúc chuyển (FILE_MISSING và không còn) -> unrecoverable; còn tồn tại thì giữ an toàn', async () => {
    const gone = await setup();
    await started(gone);
    await stopAt(gone, 'file:///cache/x.mp4');
    let calls = 0; // exists báo còn ở lần kiểm đầu rồi mất khi chuyển
    await recoverInterruptedRecordings(
      {
        ...recoverPorts(gone, []),
        exists: () => ++calls === 1,
        persist: () => ({ ok: false, reason: 'FILE_MISSING' }),
      },
      LOCAL_SHOP_ID,
    );
    expect(await gone.fileState()).toBe('unrecoverable');
    const still = await setup();
    await started(still);
    await stopAt(still, 'file:///cache/x.mp4');
    await recoverInterruptedRecordings(
      recoverPorts(still, ['file:///cache/x.mp4'], {
        persist: () => ({ ok: false, reason: 'FILE_MISSING' }),
      }),
      LOCAL_SHOP_ID,
    );
    expect(await still.fileState()).toBe('local_save_failed');
  });

  it('băm FILE_UNREADABLE (tệp còn): giữ local_save_failed với đường dẫn bền; FILE_MISSING và tệp mất: unrecoverable', async () => {
    const unreadable = await setup();
    await started(unreadable);
    await stopAt(unreadable, 'file:///cache/x.mp4');
    await recoverInterruptedRecordings(
      recoverPorts(unreadable, ['file:///cache/x.mp4'], {
        hash: async () => ({ ok: false, reason: 'FILE_UNREADABLE' }),
      }),
      LOCAL_SHOP_ID,
    );
    expect(await unreadable.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
    const missing = await setup();
    await started(missing);
    await stopAt(missing, 'file:///cache/x.mp4');
    await recoverInterruptedRecordings(
      recoverPorts(missing, ['file:///cache/x.mp4'], {
        hash: async () => ({ ok: false, reason: 'FILE_MISSING' }),
      }),
      LOCAL_SHOP_ID,
    );
    expect(await missing.fileState()).toBe('unrecoverable');
  });

  it('vào hàng đợi lỗi (applyEvent không ok): giữ local_save_failed với đường dẫn bền', async () => {
    const t = await setup();
    await started(t);
    await stopAt(t, 'file:///cache/x.mp4');
    await recoverInterruptedRecordings(
      recoverPorts(t, ['file:///cache/x.mp4'], {
        hash: async () => ({ ok: true, sha256: 'ab'.repeat(32), sizeBytes: 0 }),
      }),
      LOCAL_SHOP_ID,
    );
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'local_save_failed',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
  });

  it('lần mở app sau: local_save_failed còn tệp được thử lại và vào hàng đợi; phiên needs_attention về ended', async () => {
    const t = await setup();
    await started(t);
    await stopAt(t, 'file:///cache/x.mp4');
    await recoverInterruptedRecordings(
      recoverPorts(t, ['file:///cache/x.mp4'], {
        persist: () => ({ ok: false, reason: 'STORAGE_FULL' }),
      }),
      LOCAL_SHOP_ID,
    );
    await t.orders.updateSessionStatus(LOCAL_SHOP_ID, t.session.id, 'needs_attention');
    const result = await recoverInterruptedRecordings(
      recoverPorts(t, ['file:///cache/x.mp4']),
      LOCAL_SHOP_ID,
    );
    expect(result).toEqual({ interrupted: 0, lost: 0 });
    expect(await t.fileState()).toBe('queued');
    expect(await sessionStatus(t)).toBe('ended');
  });

  it('local_save_failed không có đường dẫn (bộ ghi lỗi, chưa có tệp): để nguyên', async () => {
    const t = await setup();
    const active = await started(t);
    t.finish({ ok: false, reason: 'RECORDER_FAILED' });
    await active.result;
    expect(await recoverInterruptedRecordings(recoverPorts(t, []), LOCAL_SHOP_ID)).toEqual({
      interrupted: 0,
      lost: 0,
    });
    expect(await t.fileState()).toBe('local_save_failed');
  });

  it('không đụng tệp của shop khác', async () => {
    const t = await setup();
    await started(t);
    expect(await recoverInterruptedRecordings(recoverPorts(t, []), 'shop-khac' as never)).toEqual({
      interrupted: 0,
      lost: 0,
    });
    expect(await t.fileState()).toBe('recording');
  });
});

describe('phiên và tệp không lệch nhau (finding 2)', () => {
  it('cập nhật phiên sang ended lỗi: tệp đã queued thì VẪN báo saved (video an toàn trong hàng đợi)', async () => {
    const t = await setup();
    const active = await started(t);
    const real = t.orders.updateSessionStatus.bind(t.orders);
    t.orders.updateSessionStatus = async (shop, id, status) => {
      if (status === 'ended') throw new Error('db');
      return real(shop, id, status);
    };
    t.finish({ ok: true, tempUri: 'file:///cache/x.mp4' });
    expect(await active.result).toEqual({ kind: 'saved', evidenceId: 'ev-1' });
    expect(await t.fileState()).toBe('queued');
  });

  const savedAndEnded = async () => {
    const t = await setup();
    const active = await started(t);
    t.finish({ ok: true, tempUri: 'file:///cache/x.mp4' });
    await active.result;
    return t;
  };
  const ports = (t: Awaited<ReturnType<typeof setup>>) => ({ files: t.files, orders: t.orders });
  const status = async (t: Awaited<ReturnType<typeof setup>>) =>
    (await t.orders.getSession(LOCAL_SHOP_ID, t.session.id))?.sessionStatus;

  it('đối chiếu lúc mở app: phiên recording có tệp queued về ended (hết chặn đăng xuất)', async () => {
    // mô phỏng kill giữa LOCAL_FILE_READABLE và updateSessionStatus(ENDED): tệp queued, phiên vẫn recording
    const t2 = await setup();
    await started(t2);
    await t2.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      1,
      { localPath: 'p' },
    );
    await t2.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'LOCAL_FILE_MOVED', origin: 'device' },
      1,
      { localPath: 'evidence/ev-1.mp4' },
    );
    await t2.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'LOCAL_FILE_READABLE', origin: 'device' },
      1,
      { localPath: 'evidence/ev-1.mp4', sizeBytes: 1, sha256Client: 'a'.repeat(64) },
    );
    expect(await status(t2)).toBe('recording');
    expect(await t2.orders.hasRecordingInProgress(LOCAL_SHOP_ID)).toBe(true);
    expect(await reconcileSavedSessions(ports(t2), LOCAL_SHOP_ID)).toBe(1);
    expect(await status(t2)).toBe('ended');
    expect(await t2.orders.hasRecordingInProgress(LOCAL_SHOP_ID)).toBe(false);
  });

  it('đối chiếu: phiên needs_attention có tệp queued về ended; phiên interrupted giữ nguyên', async () => {
    const t = await savedAndEnded();
    await t.orders.updateSessionStatus(LOCAL_SHOP_ID, t.session.id, 'needs_attention');
    expect(await reconcileSavedSessions(ports(t), LOCAL_SHOP_ID)).toBe(1);
    expect(await status(t)).toBe('ended');

    const u = await setup();
    await started(u);
    await u.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      1,
      { localPath: 'p' },
    );
    await u.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'LOCAL_FILE_READABLE', origin: 'device' },
      1,
      { localPath: 'p', sizeBytes: 1, sha256Client: 'a'.repeat(64) },
    );
    await u.orders.updateSessionStatus(LOCAL_SHOP_ID, u.session.id, 'interrupted');
    expect(await reconcileSavedSessions(ports(u), LOCAL_SHOP_ID)).toBe(0);
    expect(await status(u)).toBe('interrupted');
  });

  it('đối chiếu không đụng phiên còn tệp dở dang và nuốt lỗi kho', async () => {
    const t = await savedAndEnded();
    await t.orders.updateSessionStatus(LOCAL_SHOP_ID, t.session.id, 'needs_attention');
    const unfinished = [{ sessionId: t.session.id }] as never;
    expect(await reconcileSavedSessions(ports(t), LOCAL_SHOP_ID, unfinished)).toBe(0);
    expect(await status(t)).toBe('needs_attention');
    t.orders.updateSessionStatus = async () => {
      throw new Error('db');
    };
    expect(await reconcileSavedSessions(ports(t), LOCAL_SHOP_ID)).toBe(0);
  });

  it('khôi phục theo danh sách chụp: tệp đã đổi trạng thái (lần quay đang diễn ra) không bị đụng', async () => {
    const t = await setup();
    await started(t);
    const snapshot = await t.files.listByStates(LOCAL_SHOP_ID, ['recording']);
    await t.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      1,
      { localPath: 'file:///cache/x.mp4' },
    );
    const result = await recoverInterruptedRecordings(
      {
        files: t.files,
        orders: t.orders,
        persist: t.ports.persist,
        hash: t.ports.hash,
        now: () => 9000,
        exists: () => false,
        findPersisted: () => null,
      },
      LOCAL_SHOP_ID,
      snapshot,
    );
    expect(result).toEqual({ interrupted: 0, lost: 0 });
    expect(await t.fileState()).toBe('saving_local');
  });
});

export type { SessionId };
