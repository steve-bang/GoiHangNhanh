import { logger } from '@/core/logging/logger';

import { excludeFromBackup, isBackupExclusionSupported } from './backup-exclusion';

const mockRequire = jest.fn();

jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => mockRequire(name),
}));

const PATH = 'file:///var/mobile/Containers/Data/Application/ABC-123/Documents/evidence';

let warn: jest.SpyInstance;
let debug: jest.SpyInstance;

beforeEach(() => {
  mockRequire.mockReset();
  warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  debug = jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  debug.mockRestore();
});

function withNative(impl: (path: string) => Promise<string>) {
  const excludeFromBackupNative = jest.fn(impl);
  mockRequire.mockReturnValue({ excludeFromBackup: excludeFromBackupNative });
  return excludeFromBackupNative;
}

/** Không log nào được chứa đường dẫn (UUID container, ID bằng chứng). */
function expectNoPathInLogs() {
  for (const call of [...warn.mock.calls, ...debug.mock.calls]) {
    expect(JSON.stringify(call)).not.toContain('Containers');
    expect(JSON.stringify(call)).not.toContain('file://');
  }
}

describe('excludeFromBackup', () => {
  it('không có module native (Android, web, Expo Go): unsupported, không ném, không cảnh báo', async () => {
    mockRequire.mockReturnValue(null);
    await expect(excludeFromBackup('evidence', PATH)).resolves.toBe('unsupported');
    await expect(excludeFromBackup('database', '/db')).resolves.toBe('unsupported');
    expect(isBackupExclusionSupported()).toBe(false);
    expect(mockRequire).toHaveBeenCalledWith('DonChungBackupExclusion');
    expect(warn).not.toHaveBeenCalled();
    expect(debug.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('nạp module lỗi: coi như không có module', async () => {
    mockRequire.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(isBackupExclusionSupported()).toBe(false);
    await expect(excludeFromBackup('evidence', PATH)).resolves.toBe('unsupported');
  });

  it('module đặt được cờ: excluded, truyền nguyên đường dẫn, không cảnh báo', async () => {
    const native = withNative(async () => 'excluded');
    expect(isBackupExclusionSupported()).toBe(true);
    await expect(excludeFromBackup('evidence', PATH)).resolves.toBe('excluded');
    expect(native).toHaveBeenCalledWith(PATH);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['not_found', 'failed'] as const)(
    'module trả %s: trả nguyên, cảnh báo theo loại thư mục, không đường dẫn',
    async (raw) => {
      withNative(async () => raw);
      await expect(excludeFromBackup('database', PATH)).resolves.toBe(raw);
      expect(warn).toHaveBeenCalledWith('backup_exclusion.not_applied', {
        target: 'database',
        result: raw,
      });
      expectNoPathInLogs();
    },
  );

  it('giá trị lạ, promise bị từ chối hoặc ném đồng bộ: failed, không ném', async () => {
    withNative(async () => 'yes');
    await expect(excludeFromBackup('evidence', PATH)).resolves.toBe('failed');
    withNative(async () => {
      throw new Error(`cannot set ${PATH}`);
    });
    await expect(excludeFromBackup('evidence', PATH)).resolves.toBe('failed');
    withNative(() => {
      throw new Error(`sync ${PATH}`);
    });
    await expect(excludeFromBackup('evidence', PATH)).resolves.toBe('failed');
    expect(warn).toHaveBeenCalledTimes(3);
    expectNoPathInLogs();
  });

  it('gọi lặp lại vô hại (idempotent): mỗi lần gọi module một lần', async () => {
    const native = withNative(async () => 'excluded');
    await excludeFromBackup('evidence', PATH);
    await excludeFromBackup('evidence', PATH);
    expect(native).toHaveBeenCalledTimes(2);
  });
});
