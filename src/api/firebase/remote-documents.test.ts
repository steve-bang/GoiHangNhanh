import type { FirebaseServices } from './client';
import { createFirestoreRemoteDocuments } from './remote-documents';

const mockExisting = new Set<string>();
const mockBatchSets: { path: string; data: unknown }[] = [];
const mockCommit = jest.fn(async () => undefined);
const mockUpdateDoc = jest.fn(async () => undefined);

jest.mock('@react-native-firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: async (ref: { path: string }) => ({ exists: () => mockExisting.has(ref.path) }),
  serverTimestamp: () => 'SERVER_TS',
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  updateDoc: (...args: unknown[]) => (mockUpdateDoc as (...a: unknown[]) => Promise<void>)(...args),
  writeBatch: () => ({
    set: (ref: { path: string }, data: unknown) =>
      void mockBatchSets.push({ path: ref.path, data }),
    commit: mockCommit,
  }),
}));

const services = { auth: { currentUser: { uid: 'u1' } }, db: {} } as unknown as FirebaseServices;

beforeEach(() => {
  mockExisting.clear();
  mockBatchSets.length = 0;
  mockCommit.mockClear();
  mockUpdateDoc.mockClear();
});

describe('createFirestoreRemoteDocuments', () => {
  it('uid lấy từ phiên đăng nhập; null khi chưa đăng nhập', () => {
    expect(createFirestoreRemoteDocuments(services).currentUid()).toBe('u1');
    const anon = { auth: { currentUser: null }, db: {} } as unknown as FirebaseServices;
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
});
