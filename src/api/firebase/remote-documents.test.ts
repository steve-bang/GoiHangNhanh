import type { FirebaseServices } from './client';
import {
  createFirestoreRemoteDocuments,
  REMOTE_CALL_TIMEOUT_MS,
  RemoteDeadlineError,
} from './remote-documents';

const mockExisting = new Set<string>();
/** Bộ đệm SDK: tài liệu đang chờ ghi (pending write) hiện "đã có" ở đây dù máy chủ chưa nhận. */
const mockCached = new Set<string>();
const mockBatchSets: { path: string; data: unknown }[] = [];
const mockCommit = jest.fn(async () => undefined);
const mockUpdateDoc = jest.fn(async () => undefined);

const mockQueries: { parent: string; ids: string[] }[] = [];
const mockListQueries: unknown[] = [];
let mockListDocs: { id: string; data: Record<string, unknown> }[] = [];

jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ collectionPath: path }),
  documentId: () => 'DOC_ID',
  where: (_field: string, _op: string, ids: string[]) => ({ ids }),
  query: (ref: { collectionPath: string }, ...constraints: { ids?: string[] }[]) => ({
    parent: ref.collectionPath,
    ids: constraints[0]?.ids,
    constraints,
  }),
  orderBy: (field: string, direction: string) => ({ orderBy: [field, direction] }),
  startAfter: (...values: unknown[]) => ({ startAfter: values }),
  limit: (n: number) => ({ limit: n }),
  // Đọc từ bộ đệm: KHÔNG được dùng (pending write trông như đã có). Ném để test bắt nếu lỡ dùng.
  getDoc: async () => {
    throw new Error('không được đọc bộ đệm');
  },
  getDocs: async () => {
    throw new Error('không được đọc bộ đệm');
  },
  getDocsFromServer: async (q: {
    parent: string;
    ids?: string[];
    constraints: { limit?: number; startAfter?: unknown[] }[];
  }) => {
    if (!q.ids) {
      mockListQueries.push(q);
      const after = q.constraints.find((c) => c.startAfter)?.startAfter;
      const size = q.constraints.find((c) => c.limit)?.limit ?? 0;
      const start = after ? mockListDocs.findIndex((d) => d.id === after[1]) + 1 : 0;
      return {
        docs: mockListDocs
          .slice(start, start + size)
          .map((d) => ({ id: d.id, data: () => d.data })),
      };
    }
    mockQueries.push({ parent: q.parent, ids: q.ids });
    return {
      docs: q.ids
        .filter((id) => mockExisting.has(`${q.parent}/${id}`))
        .map((id) => ({ id, data: () => ({ id }) })),
    };
  },
  doc: (_db: unknown, path: string) => ({ path }),
  getDocFromServer: async (ref: { path: string }) => ({
    exists: () => mockExisting.has(ref.path),
    data: () => ({}),
  }),
  serverTimestamp: () => 'SERVER_TS',
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  updateDoc: (...args: unknown[]) => (mockUpdateDoc as (...a: unknown[]) => Promise<void>)(...args),
  writeBatch: () => {
    const paths: string[] = [];
    return {
      set: (ref: { path: string }, data: unknown) => {
        paths.push(ref.path);
        mockBatchSets.push({ path: ref.path, data });
      },
      commit: () => {
        // SDK ghi vào bộ đệm ngay (pending), máy chủ chỉ có khi commit được xác nhận.
        paths.forEach((p) => mockCached.add(p));
        return mockCommit();
      },
    };
  },
}));

const mockCall = jest.fn();
jest.mock('@react-native-firebase/functions', () => ({
  httpsCallable: (_f: unknown, name: string) => (data: unknown) => mockCall(name, data),
}));

const services = {
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  functions: {},
} as unknown as FirebaseServices;

beforeEach(() => {
  mockExisting.clear();
  mockCached.clear();
  mockQueries.length = 0;
  mockListQueries.length = 0;
  mockListDocs = [];
  mockBatchSets.length = 0;
  mockCommit.mockClear();
  mockUpdateDoc.mockClear();
});

describe('createFirestoreRemoteDocuments', () => {
  it('uid lấy từ phiên đăng nhập; null khi chưa đăng nhập', () => {
    expect(createFirestoreRemoteDocuments(services).currentUid()).toBe('u1');
    const anon = {
      auth: { currentUser: null },
      db: {},
      functions: {},
    } as unknown as FirebaseServices;
    expect(createFirestoreRemoteDocuments(anon).currentUid()).toBeNull();
  });

  it('giá trị đặc biệt do SDK cấp', () => {
    const { values } = createFirestoreRemoteDocuments(services);
    expect(values.serverTimestamp()).toBe('SERVER_TS');
    expect(values.timestamp(5)).toEqual({ ms: 5 });
  });

  it('chỉ ghi tài liệu chưa có, trong một batch; đã có đủ thì không mockCommit', async () => {
    const docs = createFirestoreRemoteDocuments(services);
    mockExisting.add('a');
    await docs.createMissing([
      { path: 'a', data: { x: 1 } },
      { path: 'b', data: { x: 2 } },
      { path: 'c', data: { x: 3 } },
    ]);
    expect(mockBatchSets.map((s) => s.path)).toEqual(['b', 'c']);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    mockBatchSets.length = 0;
    mockCommit.mockClear();
    mockExisting.add('b');
    mockExisting.add('c');
    await docs.createMissing([{ path: 'b', data: {} }]);
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('cập nhật trường của tài liệu đã có', async () => {
    await createFirestoreRemoteDocuments(services).updateFields('p', { status: 'ended' });
    expect(mockUpdateDoc).toHaveBeenCalledWith({ path: 'p' }, { status: 'ended' });
  });

  it('đọc trường tài liệu: null khi chưa có', async () => {
    const docs = createFirestoreRemoteDocuments(services);
    expect(await docs.getFields('missing')).toBeNull();
    mockExisting.add('present');
    expect(await docs.getFields('present')).toEqual({});
  });

  it('đọc nhiều tài liệu theo lô: gom theo bộ sưu tập, tối đa 10 mỗi truy vấn, chỉ trả tài liệu có', async () => {
    const docs = createFirestoreRemoteDocuments(services);
    const ids = Array.from({ length: 23 }, (_, i) => `e${i}`);
    for (const id of ids) mockExisting.add(`shops/s1/evidence/${id}`);
    mockExisting.add('shops/s2/evidence/x');
    const paths = [
      ...ids.map((id) => `shops/s1/evidence/${id}`),
      'shops/s2/evidence/x',
      'shops/s2/evidence/vang',
    ];
    const found = await docs.getManyFields([...paths, paths[0] as string]); // trùng đường dẫn chỉ đọc một lần
    expect(mockQueries.map((q) => [q.parent, q.ids.length])).toEqual([
      ['shops/s1/evidence', 10],
      ['shops/s1/evidence', 10],
      ['shops/s1/evidence', 3],
      ['shops/s2/evidence', 2],
    ]);
    expect(found.size).toBe(24);
    expect(found.get('shops/s2/evidence/x')).toEqual({ id: 'x' });
    expect(found.has('shops/s2/evidence/vang')).toBe(false);
    expect((await docs.getManyFields([])).size).toBe(0);
  });

  it('gọi Cloud Function callable và trả data', async () => {
    mockCall.mockResolvedValue({ data: { status: 'ready' } });
    expect(
      await createFirestoreRemoteDocuments(services).callFunction('createUploadSession', { a: 1 }),
    ).toEqual({
      status: 'ready',
    });
    expect(mockCall).toHaveBeenCalledWith('createUploadSession', { a: 1 });
  });

  it('lệnh treo (mất mạng: batch.commit chưa trả) hết giờ sau 30 giây với mã deadline-exceeded', async () => {
    jest.useFakeTimers();
    try {
      mockCommit.mockImplementationOnce(() => new Promise<undefined>(() => undefined));
      mockCall.mockImplementationOnce(() => new Promise(() => undefined));
      const docs = createFirestoreRemoteDocuments(services);
      const write = docs.createMissing([{ path: 'x', data: {} }]);
      const call = docs.callFunction('createUploadSession', {});
      const settled = Promise.allSettled([write, call]);
      await jest.advanceTimersByTimeAsync(REMOTE_CALL_TIMEOUT_MS);
      const [w, c] = await settled;
      expect(w).toMatchObject({ status: 'rejected', reason: { code: 'deadline-exceeded' } });
      expect(c).toMatchObject({ status: 'rejected' });
      expect((c as PromiseRejectedResult).reason).toBeInstanceOf(RemoteDeadlineError);
    } finally {
      jest.useRealTimers();
    }
  });

  it('lỗi SDK giữ nguyên mã (không bị đổi thành hết giờ)', async () => {
    mockCall.mockRejectedValueOnce({ code: 'functions/permission-denied' });
    const docs = createFirestoreRemoteDocuments(services);
    await expect(docs.callFunction('f', {})).rejects.toEqual({
      code: 'functions/permission-denied',
    });
  });

  it('ghi hết giờ (lệnh còn chờ trong SDK): lượt sau hỏi MÁY CHỦ, không coi bản đang chờ là đã có', async () => {
    jest.useFakeTimers();
    try {
      mockCommit.mockImplementationOnce(() => new Promise<undefined>(() => undefined));
      const docs = createFirestoreRemoteDocuments(services);
      const first = docs.createMissing([{ path: 'shops/s/orders/o1', data: {} }]);
      const settled = first.catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(REMOTE_CALL_TIMEOUT_MS);
      expect(await settled).toMatchObject({ code: 'deadline-exceeded' });
      // Bộ đệm có bản đang chờ, máy chủ chưa có: lượt sau phải ghi lại (chưa được báo "đã đăng").
      expect(mockCached.has('shops/s/orders/o1')).toBe(true);
      mockBatchSets.length = 0;
      await docs.createMissing([{ path: 'shops/s/orders/o1', data: {} }]);
      expect(mockBatchSets.map((w) => w.path)).toEqual(['shops/s/orders/o1']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('bảng hạn: ghi đè theo thao tác và theo tên callable, còn lại dùng mặc định', async () => {
    jest.useFakeTimers();
    try {
      const docs = createFirestoreRemoteDocuments(services, {
        defaultMs: 1000,
        operations: { createMissing: 5000 },
        callables: { cham: 9000 },
      });
      const hang = () => new Promise(() => undefined);
      mockCommit.mockImplementationOnce(hang as () => Promise<undefined>);
      mockCall.mockImplementation(hang);
      const results: Record<string, string> = {};
      const track = (name: string, p: Promise<unknown>) =>
        void p.catch(() => (results[name] = 'timeout'));
      track('write', docs.createMissing([{ path: 'x', data: {} }]));
      track('nhanh', docs.callFunction('nhanh', {}));
      track('cham', docs.callFunction('cham', {}));
      await jest.advanceTimersByTimeAsync(1000);
      expect(results).toEqual({ nhanh: 'timeout' });
      await jest.advanceTimersByTimeAsync(4000);
      expect(results).toEqual({ nhanh: 'timeout', write: 'timeout' });
      await jest.advanceTimersByTimeAsync(4000);
      expect(results).toEqual({ nhanh: 'timeout', write: 'timeout', cham: 'timeout' });
    } finally {
      mockCall.mockReset();
      jest.useRealTimers();
    }
  });
  it('listPage: mới trước, phân trang bằng con trỏ (mốc thời gian + id), trang cuối trả next = null', async () => {
    const docs = createFirestoreRemoteDocuments(services);
    const at = (ms: number) => ({ toMillis: () => ms });
    mockListDocs = [
      { id: 'c', data: { createdAt: at(30) } },
      { id: 'b', data: { createdAt: at(20) } },
      { id: 'a', data: { createdAt: at(10) } },
    ];
    const first = await docs.listPage({
      path: 'shops/s/orders',
      orderByField: 'createdAt',
      pageSize: 2,
    });
    expect(first.docs.map((d) => d.id)).toEqual(['c', 'b']);
    expect(first.next).toBe('20|b');
    const second = await docs.listPage({
      path: 'shops/s/orders',
      orderByField: 'createdAt',
      pageSize: 2,
      after: first.next,
    });
    expect(second.docs.map((d) => d.id)).toEqual(['a']);
    expect(second.next).toBeNull();
  });
});
