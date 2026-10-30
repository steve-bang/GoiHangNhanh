import type * as LocalDb from './local-db';

// Test riêng của adapter (jest.setup thay `local-db` bằng bản trả `null` cho mọi test khác).
jest.unmock('@/platform/local-db');

const mockExclude = jest.fn(async (_target: string, _path: string) => 'excluded');
const mockOpen = jest.fn();
let mockDir: unknown = '/var/mobile/Documents/SQLite';

jest.mock('./backup-exclusion', () => ({
  excludeFromBackup: (target: string, path: string) => mockExclude(target, path),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (name: string) => mockOpen(name),
  get defaultDatabaseDirectory() {
    return mockDir;
  },
}));

function fakeDb() {
  return {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => undefined),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
}

beforeEach(() => {
  jest.resetModules();
  mockExclude.mockClear();
  mockOpen.mockReset();
  mockDir = '/var/mobile/Documents/SQLite';
});

/** Nạp lại mô-đun để kết nối dùng chung (`shared`) bắt đầu trống ở mỗi test. */
function load(): typeof LocalDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./local-db') as typeof LocalDb;
}

describe('openLocalDatabase: loại thư mục CSDL khỏi sao lưu (V1-12, Q-24d)', () => {
  it('sau khi mở lần đầu: đặt cờ cho thư mục mặc định của expo-sqlite, một lần mỗi tiến trình', async () => {
    mockOpen.mockResolvedValue(fakeDb());
    const { openLocalDatabase } = load();
    await openLocalDatabase();
    await openLocalDatabase();
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockExclude).toHaveBeenCalledTimes(1);
    expect(mockExclude).toHaveBeenCalledWith('database', '/var/mobile/Documents/SQLite');
  });

  it('đặt cờ lỗi không chặn mở CSDL', async () => {
    mockOpen.mockResolvedValue(fakeDb());
    mockExclude.mockRejectedValueOnce(new Error('x'));
    const { openLocalDatabase } = load();
    await expect(openLocalDatabase()).resolves.not.toBeNull();
  });

  it('mở CSDL lỗi: không đặt cờ (thư mục có thể chưa có); lần sau mở lại được', async () => {
    mockOpen.mockRejectedValueOnce(new Error('open failed'));
    const { openLocalDatabase } = load();
    await expect(openLocalDatabase()).rejects.toThrow('open failed');
    expect(mockExclude).not.toHaveBeenCalled();
    mockOpen.mockResolvedValue(fakeDb());
    await expect(openLocalDatabase()).resolves.not.toBeNull();
    expect(mockExclude).toHaveBeenCalledTimes(1);
  });

  it('không đọc được thư mục mặc định: không gọi adapter', async () => {
    mockDir = undefined;
    mockOpen.mockResolvedValue(fakeDb());
    const { openLocalDatabase } = load();
    await openLocalDatabase();
    expect(mockExclude).not.toHaveBeenCalled();
  });
});
