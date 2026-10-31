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
const mockAuthCalls: string[] = [];
let mockLanguageError: unknown = null;
let mockReauthError: unknown = null;
jest.mock('@react-native-firebase/auth', () => ({
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ email, passwordLength: password.length }),
  },
  reauthenticateWithCredential: async (
    user: { uid: string },
    credential: { email: string; passwordLength: number },
  ) => {
    mockAuthCalls.push(`reauth:${user.uid}:${credential.email}:${credential.passwordLength}`);
    if (mockReauthError) throw mockReauthError;
  },
  updatePassword: async (user: { uid: string }, next: string) => {
    mockAuthCalls.push(`updatePassword:${user.uid}:${next.length}`);
  },
  updateProfile: async (user: { uid: string }, profile: { displayName?: string }) => {
    mockAuthCalls.push(`updateProfile:${user.uid}:${profile.displayName}`);
  },
  setLanguageCode: async (_auth: unknown, code: string) => {
    mockAuthCalls.push(`lang:${code}`);
    if (mockLanguageError) throw mockLanguageError;
  },
  sendPasswordResetEmail: async (_auth: unknown, email: string, settings?: unknown) => {
    mockAuthCalls.push(`reset:${email}:${settings === undefined ? 'no-settings' : 'settings'}`);
  },
}));
jest.mock('@react-native-firebase/functions', () => ({}));

const ops = createFirebaseOps({ auth: {}, db: {}, functions: {} } as FirebaseServices);

beforeEach(() => {
  mockDocs.clear();
  mockErrors.clear();
  mockAuthCalls.length = 0;
  mockLanguageError = null;
  mockReauthError = null;
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

describe('FirebaseOps.sendPasswordReset (D-14 v1)', () => {
  it('đặt ngôn ngữ thư tiếng Việt TRƯỚC khi gửi; không actionCodeSettings (trang của Firebase)', async () => {
    await ops.sendPasswordReset('lan@example.com');
    expect(mockAuthCalls).toEqual(['lang:vi', 'reset:lan@example.com:no-settings']);
  });

  it('đặt ngôn ngữ lỗi: vẫn gửi thư (không chặn người dùng lấy lại mật khẩu)', async () => {
    mockLanguageError = new Error('native');
    await ops.sendPasswordReset('lan@example.com');
    expect(mockAuthCalls).toEqual(['lang:vi', 'reset:lan@example.com:no-settings']);
  });
});

describe('FirebaseOps: đổi mật khẩu, họ tên, nguồn bán (V1-05)', () => {
  const user = { uid: 'u1', email: 'lan@example.com' };
  const withUser = (currentUser: unknown) =>
    createFirebaseOps({ auth: { currentUser }, db: {}, functions: {} } as FirebaseServices);

  it('xác thực lại bằng email + mật khẩu hiện tại TRƯỚC rồi mới đặt mật khẩu mới', async () => {
    await withUser(user).changePassword('cu-123456', 'moi-1234567');
    expect(mockAuthCalls).toEqual(['reauth:u1:lan@example.com:9', 'updatePassword:u1:11']);
  });

  it('xác thực lại lỗi: không đổi mật khẩu, ném nguyên lỗi SDK để lớp trên ánh xạ', async () => {
    const wrong = { code: 'auth/wrong-password' };
    mockReauthError = wrong;
    await expect(withUser(user).changePassword('sai', 'moi-1234567')).rejects.toBe(wrong);
    expect(mockAuthCalls).toEqual(['reauth:u1:lan@example.com:3']);
  });

  it('không còn người dùng (hoặc thiếu email): lỗi auth/no-current-user, không gọi SDK', async () => {
    await expect(withUser(null).changePassword('a', 'b')).rejects.toMatchObject({
      code: 'auth/no-current-user',
    });
    await expect(
      withUser({ uid: 'u1', email: null }).changePassword('a', 'b'),
    ).rejects.toMatchObject({ code: 'auth/no-current-user' });
    await expect(withUser(null).updateDisplayName('A')).rejects.toMatchObject({
      code: 'auth/no-current-user',
    });
    expect(mockAuthCalls).toEqual([]);
  });

  it('đổi họ tên gọi updateProfile của người dùng hiện tại', async () => {
    await withUser(user).updateDisplayName('Chị Lan');
    expect(mockAuthCalls).toEqual(['updateProfile:u1:Chị Lan']);
  });

  it('nguồn bán: mảng chuỗi thì trả nguyên; thiếu tài liệu hoặc sai kiểu thì null', async () => {
    mockDocs.set('shops/s1', { name: 'S', sellingSources: ['shopee', 'other_unknown'] });
    await expect(ops.readShopSellingSources('s1')).resolves.toEqual(['shopee', 'other_unknown']);
    mockDocs.set('shops/s1', { name: 'S' });
    await expect(ops.readShopSellingSources('s1')).resolves.toBeNull();
    mockDocs.set('shops/s1', { name: 'S', sellingSources: ['shopee', 3] });
    await expect(ops.readShopSellingSources('s1')).resolves.toBeNull();
    await expect(ops.readShopSellingSources('khong-co')).resolves.toBeNull();
  });
});
