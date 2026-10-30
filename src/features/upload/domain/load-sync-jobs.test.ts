import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFile, FileState } from '@/features/evidence';
import type { OrderDetails, PackingSession } from '@/features/orders';
import type { ReturnCase, ReturnDetails, ReturnMedia } from '@/features/returns';

import { loadSyncJob, loadSyncJobs, type SyncJobStores } from './load-sync-jobs';

const SHOP = 'shop-1' as ShopId;
const OTHER = 'shop-2' as ShopId;

function file(id: string, state: FileState, extra: Partial<EvidenceFile> = {}): EvidenceFile {
  return {
    id: id as EvidenceId,
    shopId: SHOP,
    orderId: 'o1' as OrderId,
    packageId: 'p2' as PackageId,
    sessionId: 's1' as SessionId,
    group: 'pack',
    kind: 'video',
    state,
    localPath: 'evidence/x.mp4',
    sizeBytes: 10,
    durationMs: 1,
    sha256Client: 'ab',
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: 100,
    updatedAtDevice: 100,
    ...extra,
  };
}

function media(id: string, state: FileState, extra: Partial<ReturnMedia> = {}): ReturnMedia {
  return {
    id,
    shopId: SHOP,
    returnId: 'r1' as ReturnCaseId,
    kind: 'photo',
    state,
    localPath: 'evidence/x.jpg',
    sizeBytes: 5,
    sha256Client: 'cd',
    location: null,
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: 50,
    updatedAtDevice: 50,
    createdBy: 'uid-1',
    ...extra,
  };
}

function stores(
  files: EvidenceFile[],
  medias: ReturnMedia[],
  options: { sessionCreator?: string; caseCreator?: string; anchored?: boolean } = {},
) {
  const reads = { session: 0, order: 0, returnCase: 0 };
  const s: SyncJobStores = {
    files: {
      listByStates: async (shop, states) =>
        files.filter((f) => f.shopId === shop && states.includes(f.state)),
      get: async (shop, id) => files.find((f) => f.shopId === shop && f.id === id) ?? null,
      applyEvent: async () => ({ ok: false, error: 'FILE_NOT_FOUND' }),
    },
    orders: {
      getSession: async (shop, id) => {
        reads.session += 1;
        return shop === SHOP && id === 's1'
          ? ({
              id,
              shopId: SHOP,
              ...(options.sessionCreator ? { createdBy: options.sessionCreator } : {}),
            } as PackingSession)
          : null;
      },
      getOrder: async (shop, id) => {
        reads.order += 1;
        return shop === SHOP && id === 'o1'
          ? ({
              order: { id, orderCode: 'DH-77' },
              lines: [],
              packages: [
                { id: 'p1', index: 1 },
                { id: 'p2', index: 2 },
              ],
            } as unknown as OrderDetails)
          : null;
      },
    },
    returns: {
      listMediaByStates: async (shop, states) =>
        medias.filter((m) => m.shopId === shop && states.includes(m.state)),
      getReturn: async (shop, id) => {
        reads.returnCase += 1;
        return shop === SHOP && id === 'r1'
          ? ({
              returnCase: {
                id,
                code: 'HH-0003',
                status: 'checking',
                ...(options.caseCreator ? { createdBy: options.caseCreator } : {}),
                ...(options.anchored ? { anchorPublishedAtDevice: 1 } : {}),
              } as unknown as ReturnCase,
            } as ReturnDetails)
          : null;
      },
      applyMediaEvent: async () => ({ ok: false, error: 'MEDIA_NOT_FOUND' }),
    },
  };
  return { s, reads };
}

describe('loadSyncJobs', () => {
  it('gộp tệp đóng gói + media hàng hoàn, kèm tên hồ sơ, cũ nhất trước, chỉ đúng trạng thái', async () => {
    const { s, reads } = stores(
      [file('e1', 'queued'), file('e2', 'needs_attention', { createdAtDevice: 200 })],
      [media('m1', 'upload_failed'), media('m2', 'verified')],
      { sessionCreator: 'uid-1', caseCreator: 'uid-1', anchored: true },
    );
    const jobs = await loadSyncJobs(s, SHOP, 'uid-1', [
      'queued',
      'needs_attention',
      'upload_failed',
    ]);
    expect(jobs.map((j) => j.key)).toEqual(['return:m1', 'pack:e1', 'pack:e2']);
    expect(jobs[1]?.record).toEqual({
      kind: 'pack',
      orderId: 'o1',
      orderCode: 'DH-77',
      packageIndex: 2,
    });
    expect(jobs[0]?.record).toEqual({
      kind: 'return',
      returnId: 'r1',
      caseCode: 'HH-0003',
      caseStatus: 'checking',
    });
    expect(jobs.every((j) => j.uploader === 'current')).toBe(true);
    // Bộ đệm: hai tệp cùng phiên/đơn chỉ đọc một lần.
    expect(reads).toEqual({ session: 1, order: 1, returnCase: 1 });
  });

  it('quan hệ người tạo: phiên/ảnh của tài khoản khác, hồ sơ chưa đăng do người khác tạo', async () => {
    const { s } = stores([file('e1', 'queued')], [media('m1', 'queued')], {
      sessionCreator: 'uid-2',
      caseCreator: 'uid-2',
    });
    const jobs = await loadSyncJobs(s, SHOP, 'uid-1', ['queued']);
    expect(Object.fromEntries(jobs.map((j) => [j.key, j.uploader]))).toEqual({
      'pack:e1': 'other',
      'return:m1': 'case_owner',
    });
  });

  it('phiên không rõ người tạo: unknown; chưa biết ai đăng nhập: không kết luận', async () => {
    const { s } = stores([file('e1', 'queued')], []);
    expect((await loadSyncJobs(s, SHOP, 'uid-1', ['queued']))[0]?.uploader).toBe('unknown');
    expect((await loadSyncJobs(s, SHOP, null, ['queued']))[0]?.uploader).toBe('current');
  });

  it('cô lập shop: shop khác không thấy gì', async () => {
    const { s } = stores([file('e1', 'queued')], [media('m1', 'queued')]);
    expect(await loadSyncJobs(s, OTHER, 'uid-1', ['queued'])).toEqual([]);
  });

  it('hồ sơ không còn đọc được: tên "chưa rõ", không có trạng thái hồ sơ', async () => {
    const { s } = stores(
      [file('e1', 'queued', { orderId: 'gone' as OrderId })],
      [media('m1', 'queued', { returnId: 'gone' as ReturnCaseId })],
    );
    const jobs = await loadSyncJobs(s, SHOP, null, ['queued']);
    expect(jobs.map((j) => j.record)).toEqual([
      { kind: 'return', returnId: 'gone', caseCode: null, caseStatus: null },
      { kind: 'pack', orderId: 'gone', orderCode: null, packageIndex: null },
    ]);
  });
});

describe('loadSyncJob (UI-F02)', () => {
  it('tìm đúng tệp theo nguồn + id + trạng thái; shop khác hoặc trạng thái khác = null', async () => {
    const { s } = stores([file('e1', 'needs_attention')], [media('m1', 'upload_failed')]);
    const states: FileState[] = ['needs_attention', 'upload_failed'];
    expect((await loadSyncJob(s, SHOP, null, { source: 'pack', id: 'e1' }, states))?.key).toBe(
      'pack:e1',
    );
    expect((await loadSyncJob(s, SHOP, null, { source: 'return', id: 'm1' }, states))?.key).toBe(
      'return:m1',
    );
    expect(await loadSyncJob(s, OTHER, null, { source: 'pack', id: 'e1' }, states)).toBeNull();
    expect(await loadSyncJob(s, SHOP, null, { source: 'pack', id: 'e1' }, ['queued'])).toBeNull();
    expect(await loadSyncJob(s, SHOP, null, { source: 'return', id: 'e1' }, states)).toBeNull();
  });
});
