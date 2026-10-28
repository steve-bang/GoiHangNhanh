import type { FirebaseServices } from './client';
import { createFirestoreRemoteDocuments } from './remote-documents';

const mockExisting = new Set<string>();
const mockBatchSets: { path: string; data: unknown }[] = [];
const mockCommit = jest.fn(async () => undefined);
const mockUpdateDoc = jest.fn(async () => undefined);

jest.mock('@react-native-firebase/firestore', () => ({
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

  it('gọi Cloud Function callable và trả data', async () => {
    mockCall.mockResolvedValue({ data: { status: 'ready' } });
    expect(
      await createFirestoreRemoteDocuments(services).callFunction('createUploadSession', { a: 1 }),
    ).toEqual({
      status: 'ready',
    });
    expect(mockCall).toHaveBeenCalledWith('createUploadSession', { a: 1 });
  });
});
