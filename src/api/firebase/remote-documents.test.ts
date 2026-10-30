import type { FirebaseServices } from './client';
import {
  createFirestoreRemoteDocuments,
  REMOTE_CALL_TIMEOUT_MS,
  RemoteDeadlineError,
} from './remote-documents';

const mockExisting = new Set<string>();
const mockBatchSets: { path: string; data: unknown }[] = [];
const mockCommit = jest.fn(async () => undefined);
const mockUpdateDoc = jest.fn(async () => undefined);

const mockQueries: { parent: string; ids: string[] }[] = [];

jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ collectionPath: path }),
  documentId: () => 'DOC_ID',
  where: (_field: string, _op: string, ids: string[]) => ({ ids }),
  query: (ref: { collectionPath: string }, filter: { ids: string[] }) => ({
    parent: ref.collectionPath,
    ids: filter.ids,
  }),
  getDocs: async (q: { parent: string; ids: string[] }) => {
    mockQueries.push(q);
    return {
      docs: q.ids
        .filter((id) => mockExisting.has(`${q.parent}/${id}`))
        .map((id) => ({ id, data: () => ({ id }) })),
    };
  },
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: async (ref: { path: string }) => ({
    exists: () => mockExisting.has(ref.path),
    data: () => ({}),
  }),
  serverTimestamp: () => 'SERVER_TS',
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  updateDoc: (...args: unknown[]) => (mockUpdateDoc as (...a: unknown[]) => Promise<void>)(...args),
  writeBatch: () => ({
    set: (ref: { path: string }, data: unknown) =>
      void mockBatchSets.push({ path: ref.path, data }),
    commit: mockCommit,
  }),
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
  mockQueries.length = 0;
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
});
