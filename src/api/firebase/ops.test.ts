import type { FirebaseServices } from './client';
import { createFirebaseOps, isPermissionDenied } from './ops';

// Mô phỏng SDK Firestore ở mức getDoc để kiểm tra NHÁNH XỬ LÝ LỖI của readShopDetails. Việc Rules cho/
// từ chối thật được kiểm chứng riêng bằng emulator: firebase/tests/rules/firestore.rules.test.ts
// (mục "đọc thông tin shop và vai trò").
const mockDocs = new Map<string, unknown>();
const mockErrors = new Map<string, unknown>();

jest.mock('@react-native-firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: async (ref: { path: string }) => {
    if (mockErrors.has(ref.path)) throw mockErrors.get(ref.path);
    return {
      exists: () => mockDocs.has(ref.path),
      data: () => mockDocs.get(ref.path),
    };
  },
  getDocFromCache: async () => {
    throw new Error('unused');
  },
}));
jest.mock('@react-native-firebase/auth', () => ({}));
jest.mock('@react-native-firebase/functions', () => ({}));

const ops = createFirebaseOps({ auth: {}, db: {}, functions: {} } as FirebaseServices);

beforeEach(() => {
  mockDocs.clear();
  mockErrors.clear();
});

const seed = (status: string, roles: string[]) => {
  mockDocs.set('shops/s1', { name: 'Shop thật' });
  mockDocs.set('shops/s1/members/u1', { status, roles });
};

describe('FirebaseOps.readShopDetails', () => {
  it('thành viên đang hoạt động: trả tên shop, vai trò và quyền sửa', async () => {
    seed('active', ['owner']);
    await expect(ops.readShopDetails('s1', 'u1')).resolves.toEqual({
      id: 's1',
      name: 'Shop thật',
      role: 'owner',
      canEdit: true,
    });
    seed('active', ['packer']);
    await expect(ops.readShopDetails('s1', 'u1')).resolves.toMatchObject({
      role: 'member',
      canEdit: false,
    });
  });

  it('thành viên không hoạt động hoặc không có tài liệu: null', async () => {
    seed('suspended', ['owner']);
    await expect(ops.readShopDetails('s1', 'u1')).resolves.toBeNull();
    await expect(ops.readShopDetails('s1', 'nguoi-la')).resolves.toBeNull();
  });

  it('Rules từ chối (permission-denied): null như comment nói, không ném', async () => {
    seed('active', ['owner']);
    mockErrors.set('shops/s1', { code: 'firestore/permission-denied' });
    await expect(ops.readShopDetails('s1', 'u1')).resolves.toBeNull();
    mockErrors.clear();
    mockErrors.set('shops/s1/members/u1', { code: 'permission-denied' });
    await expect(ops.readShopDetails('s1', 'u1')).resolves.toBeNull();
  });

  it('lỗi mạng hoặc lỗi khác vẫn ném (không nhầm là "chưa có shop")', async () => {
    seed('active', ['owner']);
    const network = { code: 'firestore/unavailable' };
    mockErrors.set('shops/s1', network);
    await expect(ops.readShopDetails('s1', 'u1')).rejects.toBe(network);
  });
});

describe('isPermissionDenied', () => {
  it('chỉ nhận mã permission-denied', () => {
    expect(isPermissionDenied({ code: 'firestore/permission-denied' })).toBe(true);
    expect(isPermissionDenied({ code: 'firestore/unavailable' })).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
    expect(isPermissionDenied(new Error('x'))).toBe(false);
  });
});
