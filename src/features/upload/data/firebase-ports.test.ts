import type { RemoteDocuments, RemoteWriteSpec } from '@/api/contract';
import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import { isUserRetryableAttention, NOT_EVIDENCE_CREATOR } from '@/features/evidence';

import { UploadPortError } from '../domain/create-upload-gateway';
import type { UploadRequest } from '../domain/ports';
import { createFirebaseUploadPorts, toPortError } from './firebase-ports';

const request: UploadRequest & { mimeType: string } = {
  evidenceId: 'e1' as EvidenceId,
  shopId: 's1' as ShopId,
  owner: {
    kind: 'packing',
    orderId: 'o1' as OrderId,
    sessionId: 'ss1' as SessionId,
    packageId: 'p1' as PackageId,
  },
  kind: 'video',
  createdAtDevice: 5000,
  durationMs: 60000,
  localPath: 'file:///v/e1.mp4',
  sizeBytes: 100,
  sha256Client: 'ab'.repeat(32),
  mimeType: 'video/mp4',
};

function fakeDocs(overrides: Partial<RemoteDocuments> = {}) {
  const created: RemoteWriteSpec[] = [];
  const docs: RemoteDocuments = {
    values: { serverTimestamp: () => 'TS', timestamp: (ms) => `T${ms}` },
    currentUid: () => 'uid-1',
    createMissing: async (writes) => void created.push(...writes),
    updateFields: async () => undefined,
    getFields: async () => null,
    getManyFields: async () => new Map(),
    callFunction: async () => ({ status: 'already_received' }) as never,
    ...overrides,
  };
  return { docs, created };
}

const sdkError = (code: string) => Object.assign(new Error('x'), { code });

describe('toPortError', () => {
  it('lỗi cần người dùng xử lý và lỗi tạm, bỏ tiền tố functions/', () => {
    expect(toPortError(sdkError('functions/permission-denied'))).toMatchObject({
      kind: 'attention',
      code: 'PERMISSION_DENIED',
    });
    expect(toPortError(sdkError('failed-precondition'))).toMatchObject({ kind: 'attention' });
    expect(toPortError(sdkError('functions/unavailable'))).toMatchObject({
      kind: 'network',
      code: 'UNAVAILABLE',
    });
    expect(toPortError(sdkError('firestore/unavailable'))).toMatchObject({ kind: 'network' });
    // Hết giờ của RemoteDocuments (R4) dùng cùng mã với SDK.
    expect(toPortError(sdkError('deadline-exceeded'))).toMatchObject({
      kind: 'network',
      code: 'DEADLINE_EXCEEDED',
    });
    // `internal`/`unknown` không có details từ máy chủ (không tới được máy chủ) -> lỗi mạng.
    expect(toPortError(sdkError('functions/internal'))).toMatchObject({
      kind: 'network',
      code: 'INTERNAL',
    });
    expect(toPortError(sdkError('firestore/unknown'))).toMatchObject({ kind: 'network' });
    // Có details (Function trả lỗi có nội dung) -> lỗi máy chủ, tính lượt.
    expect(
      toPortError(Object.assign(sdkError('functions/internal'), { details: { reason: 'x' } })),
    ).toMatchObject({ kind: 'retryable', code: 'INTERNAL' });
    expect(toPortError(sdkError('not-found'))).toMatchObject({ kind: 'retryable' });
    expect(toPortError(new Error('?'))).toMatchObject({ kind: 'network', code: 'UNKNOWN' });
    const mine = new UploadPortError('attention', 'X');
    expect(toPortError(mine)).toBe(mine);
  });
});

describe('toPortError: máy chủ từ chối vì người tạo khác (V1-07b)', () => {
  const withReason = (code: string, reason: unknown) =>
    Object.assign(sdkError(code), { details: { reason } });

  it.each(['not_evidence_declarer', 'not_session_creator', 'not_return_creator'])(
    'permission-denied + %s -> cần xử lý ngay, mã NOT_EVIDENCE_CREATOR, không cho bấm Thử lại',
    (reason) => {
      const mapped = toPortError(withReason('functions/permission-denied', reason));
      expect(mapped).toMatchObject({ kind: 'attention', code: NOT_EVIDENCE_CREATOR });
      expect(isUserRetryableAttention(mapped.code)).toBe(false);
    },
  );

  it('lý do khác, thiếu lý do hoặc mã khác giữ phân loại cũ', () => {
    expect(toPortError(withReason('functions/permission-denied', 'x'))).toMatchObject({
      kind: 'attention',
      code: 'PERMISSION_DENIED',
    });
    expect(toPortError(withReason('functions/permission-denied', 5))).toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    expect(
      toPortError(withReason('functions/failed-precondition', 'session_missing')),
    ).toMatchObject({ kind: 'attention', code: 'FAILED_PRECONDITION' });
    expect(toPortError(withReason('functions/internal', 'not_session_creator'))).toMatchObject({
      kind: 'retryable',
      code: 'INTERNAL',
    });
  });

  it('xin phiên tải bị từ chối vì phiên của tài khoản khác: lỗi vĩnh viễn', async () => {
    const t = fakeDocs({
      callFunction: async () => {
        throw withReason('functions/permission-denied', 'not_session_creator');
      },
    });
    await expect(
      createFirebaseUploadPorts(t.docs).sessions.create('s1' as ShopId, 'e1' as EvidenceId),
    ).rejects.toMatchObject({ kind: 'attention', code: NOT_EVIDENCE_CREATOR });
  });
});

describe('createFirebaseUploadPorts', () => {
  it('khai báo bằng chứng đúng đường dẫn và người tạo', async () => {
    const t = fakeDocs();
    await createFirebaseUploadPorts(t.docs, '1.0').declarer.declare(request);
    expect(t.created).toHaveLength(1);
    expect(t.created[0]?.path).toBe('shops/s1/evidence/e1');
    expect(t.created[0]?.data).toMatchObject({
      createdBy: 'uid-1',
      clientFileState: 'queued',
      kind: 'original_video',
      capturedAtDevice: 'T5000',
      appVersion: '1.0',
    });
  });

  it('chưa đăng nhập: cần xử lý, không ghi gì', async () => {
    const t = fakeDocs({ currentUid: () => null });
    await expect(createFirebaseUploadPorts(t.docs).declarer.declare(request)).rejects.toMatchObject(
      {
        kind: 'attention',
        code: 'AUTH_REQUIRED',
      },
    );
    expect(t.created).toEqual([]);
  });

  it('khai báo bị Firestore từ chối quyền: tính lượt (retryable), không phải lỗi mạng', async () => {
    const t = fakeDocs({
      createMissing: async () => {
        throw sdkError('firestore/permission-denied');
      },
    });
    await expect(createFirebaseUploadPorts(t.docs).declarer.declare(request)).rejects.toMatchObject(
      {
        kind: 'retryable',
        code: 'PERMISSION_DENIED',
      },
    );
  });

  it('xin phiên tải: gọi callable với shop + bằng chứng, giữ phân loại lỗi', async () => {
    const calls: unknown[] = [];
    const ok = fakeDocs({
      callFunction: async (name, data) => {
        calls.push([name, data]);
        return { status: 'ready', url: 'u', method: 'POST', headers: {} } as never;
      },
    });
    const session = await createFirebaseUploadPorts(ok.docs).sessions.create(
      's1' as ShopId,
      'e1' as EvidenceId,
    );
    expect(session.status).toBe('ready');
    expect(calls).toEqual([['createUploadSession', { shopId: 's1', evidenceId: 'e1' }]]);
    const denied = fakeDocs({
      callFunction: async () => {
        throw sdkError('functions/permission-denied');
      },
    });
    await expect(
      createFirebaseUploadPorts(denied.docs).sessions.create('s1' as ShopId, 'e1' as EvidenceId),
    ).rejects.toMatchObject({ kind: 'attention' });
  });

  it('đọc trạng thái máy chủ: chỉ nhận uploaded/verified/hash_mismatch', async () => {
    const fields: Record<string, Record<string, unknown> | null> = {
      'shops/s1/evidence/a': { server: { state: 'verified' } },
      'shops/s1/evidence/b': { server: { state: 'hash_mismatch' } },
      'shops/s1/evidence/c': { server: { state: 'weird' } },
      'shops/s1/evidence/d': {},
      'shops/s1/evidence/e': null,
    };
    const batches: (readonly string[])[] = [];
    const t = fakeDocs({
      getManyFields: async (paths) => {
        batches.push(paths);
        return new Map(
          paths.flatMap((path) => {
            const found = fields[path];
            return found ? [[path, found] as const] : [];
          }),
        );
      },
    });
    const states = await createFirebaseUploadPorts(t.docs).serverStates.read(
      's1' as ShopId,
      ['a', 'b', 'c', 'd', 'e'] as EvidenceId[],
    );
    expect(batches).toHaveLength(1); // một lượt đọc theo lô, không đọc tuần tự từng tài liệu
    expect([...states.entries()]).toEqual([
      ['a', 'verified'],
      ['b', 'hash_mismatch'],
    ]);
  });

  it('không có tệp nào cần hỏi thì không đọc gì', async () => {
    let calls = 0;
    const t = fakeDocs({
      getManyFields: async () => {
        calls += 1;
        return new Map();
      },
    });
    expect(
      (await createFirebaseUploadPorts(t.docs).serverStates.read('s1' as ShopId, [])).size,
    ).toBe(0);
    expect(calls).toBe(0);
  });
});
