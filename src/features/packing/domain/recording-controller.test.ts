import type { EvidenceId, SessionId } from '@/core/ids';
import {
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
  type PackingSession,
} from '@/features/orders';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';

import {
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
    hash: async () => state.hash,
    newEvidenceId: () => 'ev-1' as EvidenceId,
    now: () => 5000,
  };
  const statusOf = async () =>
    (await orders.listSessionsPendingRemote(LOCAL_SHOP_ID, 10)).map((s) => s.status);
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
    statusOf,
  };
}

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
  const recoverPorts = (t: Awaited<ReturnType<typeof setup>>, present: string[]) => ({
    files: t.files,
    orders: t.orders,
    persist: t.ports.persist,
    hash: t.ports.hash,
    now: () => 9000,
    exists: (p: string) => present.includes(p),
  });

  it('đang recording khi app bị kill: không biết tệp ở đâu -> unrecoverable (ghi nhận thiếu)', async () => {
    const t = await setup();
    await started(t);
    expect(await recoverInterruptedRecordings(recoverPorts(t, []), LOCAL_SHOP_ID)).toBe(1);
    expect(await t.fileState()).toBe('unrecoverable');
  });

  it('đang lưu và còn tệp tạm: chuyển, băm và đưa vào hàng đợi; vẫn đánh dấu phiên gián đoạn', async () => {
    const t = await setup();
    const active = await started(t);
    // Dừng nhưng app bị kill ngay sau khi ghi đường dẫn tệp tạm.
    await t.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      1,
      { localPath: 'file:///cache/x.mp4' },
    );
    void active;
    await recoverInterruptedRecordings(recoverPorts(t, ['file:///cache/x.mp4']), LOCAL_SHOP_ID);
    expect(await t.files.get(LOCAL_SHOP_ID, 'ev-1' as EvidenceId)).toMatchObject({
      state: 'queued',
      localPath: 'file:///docs/evidence/ev-1.mp4',
    });
  });

  it('đang lưu nhưng mất tệp: unrecoverable', async () => {
    const t = await setup();
    await started(t);
    await t.files.applyEvent(
      LOCAL_SHOP_ID,
      'ev-1' as EvidenceId,
      { type: 'STOP_RECORDING', origin: 'device' },
      1,
      { localPath: 'file:///cache/gone.mp4' },
    );
    await recoverInterruptedRecordings(recoverPorts(t, []), LOCAL_SHOP_ID);
    expect(await t.fileState()).toBe('unrecoverable');
  });

  it('không đụng tệp của shop khác và tệp đã queued', async () => {
    const t = await setup();
    await started(t);
    expect(await recoverInterruptedRecordings(recoverPorts(t, []), 'shop-khac' as never)).toBe(0);
    expect(await t.fileState()).toBe('recording');
  });
});

export type { SessionId };
