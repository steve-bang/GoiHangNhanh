import {
  deleteAllEvidenceFiles,
  deleteRecording,
  excludeEvidenceDirFromBackup,
  findPersistedRecording,
  getAvailableDiskBytes,
  persistRecording,
  probeEvidenceDirWritable,
  recordingExists,
  resolveRecordingUri,
} from './recording-files';

const mockExclude = jest.fn(async (_target: string, _uri: string) => 'excluded');
let mockExclusionSupported = true;

jest.mock('./backup-exclusion', () => ({
  excludeFromBackup: (target: string, uri: string) => mockExclude(target, uri),
  isBackupExclusionSupported: () => mockExclusionSupported,
}));

const mockFiles = new Map<string, number>();
const mockDirs = new Set<string>();
let mockMoveError: (Error & { code?: string }) | null = null;
let mockDocument = 'file:///docs';
let mockWriteError: Error | null = null;
let mockDeleteMode: 'ok' | 'throw' | 'noop' = 'ok';
const mockProbeLog: string[] = [];
let mockDisk: number | (() => number) = 1_000_000;

jest.mock('expo-file-system', () => {
  const join = (a: string | { uri: string }, b?: string) =>
    typeof a === 'string' ? a : `${a.uri}/${b}`;
  class MockFile {
    uri: string;
    name: string;
    constructor(a: string | { uri: string }, b?: string) {
      this.uri = join(a, b);
      this.name = this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri) ?? null;
    }
    create() {
      mockFiles.set(this.uri, 0);
      mockProbeLog.push(`create:${this.uri}`);
    }
    write() {
      if (mockWriteError) throw mockWriteError;
    }
    delete() {
      if (mockDeleteMode === 'throw') throw new Error('locked');
      if (mockDeleteMode === 'noop') return;
      mockFiles.delete(this.uri);
      mockProbeLog.push(`delete:${this.uri}`);
    }
    move(target: MockFile) {
      if (mockMoveError) throw mockMoveError;
      mockFiles.set(target.uri, mockFiles.get(this.uri) ?? 0);
      mockFiles.delete(this.uri);
    }
  }
  class MockDirectory {
    uri: string;
    constructor(a: string | { uri: string }, b?: string) {
      this.uri = join(a, b);
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
    list() {
      return [...mockFiles.keys()]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => new MockFile(uri));
    }
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      get document() {
        return { uri: mockDocument };
      },
      get availableDiskSpace() {
        return typeof mockDisk === 'function' ? mockDisk() : mockDisk;
      },
    },
  };
});

beforeEach(() => {
  mockExclude.mockClear();
  mockExclusionSupported = true;
  mockFiles.clear();
  mockDirs.clear();
  mockMoveError = null;
  mockWriteError = null;
  mockDeleteMode = 'ok';
  mockProbeLog.length = 0;
  mockDocument = 'file:///docs';
  mockDisk = 1_000_000;
});

describe('persistRecording', () => {
  it('chuyển (không sao chép) tệp tạm sang thư mục tài liệu; trả đường dẫn TƯƠNG ĐỐI để lưu', () => {
    mockFiles.set('file:///cache/x.mp4', 2048);
    expect(persistRecording('file:///cache/x.mp4', 'ev-1', '.mp4')).toEqual({
      ok: true,
      uri: 'evidence/ev-1.mp4',
      sizeBytes: 2048,
    });
    expect(mockFiles.has('file:///cache/x.mp4')).toBe(false);
    expect(mockFiles.has('file:///docs/evidence/ev-1.mp4')).toBe(true);
    expect(recordingExists('evidence/ev-1.mp4')).toBe(true);
  });

  it('tệp tạm mất: FILE_MISSING', () => {
    expect(persistRecording('file:///cache/none.mp4', 'ev-2', 'mp4')).toEqual({
      ok: false,
      reason: 'FILE_MISSING',
    });
  });

  it('đích đã có thì không ghi đè', () => {
    mockFiles.set('file:///cache/x.mp4', 1);
    mockFiles.set('file:///docs/evidence/ev-3.mp4', 99);
    expect(persistRecording('file:///cache/x.mp4', 'ev-3', 'mp4')).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    expect(mockFiles.get('file:///docs/evidence/ev-3.mp4')).toBe(99);
    expect(mockFiles.has('file:///cache/x.mp4')).toBe(true);
  });

  it('hết dung lượng nhận ra bằng mã lỗi (hoặc nội dung ENOSPC); lỗi khác là FAILED; tệp tạm còn nguyên', () => {
    mockFiles.set('file:///cache/x.mp4', 1);
    mockMoveError = Object.assign(new Error('write failed'), { code: 'ERR_ENOSPC' });
    expect(persistRecording('file:///cache/x.mp4', 'ev-4', 'mp4')).toEqual({
      ok: false,
      reason: 'STORAGE_FULL',
    });
    mockMoveError = new Error('ENOSPC: no space left on device');
    expect(persistRecording('file:///cache/x.mp4', 'ev-4', 'mp4')).toMatchObject({
      reason: 'STORAGE_FULL',
    });
    mockMoveError = new Error('other');
    expect(persistRecording('file:///cache/x.mp4', 'ev-5', 'mp4')).toMatchObject({
      reason: 'FAILED',
    });
    expect(mockFiles.has('file:///cache/x.mp4')).toBe(true);
  });
});

describe('resolveRecordingUri (container có thể đổi trên iOS)', () => {
  it('đường dẫn tương đối ghép với thư mục tài liệu HIỆN TẠI', () => {
    mockDocument = 'file:///container-moi/Documents';
    expect(resolveRecordingUri('evidence/ev-1.mp4')).toBe(
      'file:///container-moi/Documents/evidence/ev-1.mp4',
    );
  });

  it('dữ liệu cũ lưu tuyệt đối: còn tồn tại thì giữ, container đổi thì ghép lại phần evidence/...', () => {
    mockFiles.set('file:///docs/evidence/ev-1.mp4', 1);
    expect(resolveRecordingUri('file:///docs/evidence/ev-1.mp4')).toBe(
      'file:///docs/evidence/ev-1.mp4',
    );
    mockFiles.delete('file:///docs/evidence/ev-1.mp4'); // container cũ không còn
    mockDocument = 'file:///container-moi';
    expect(resolveRecordingUri('file:///docs/evidence/ev-1.mp4')).toBe(
      'file:///container-moi/evidence/ev-1.mp4',
    );
  });

  it('tệp tạm của camera (không nằm trong evidence/) được giữ nguyên', () => {
    expect(resolveRecordingUri('file:///cache/Camera/v.mov')).toBe('file:///cache/Camera/v.mov');
  });

  it('recordingExists theo đường dẫn đã ghép, kể cả sau khi container đổi', () => {
    mockFiles.set('file:///container-moi/evidence/ev-1.mp4', 5);
    mockDocument = 'file:///container-moi';
    expect(recordingExists('file:///docs/evidence/ev-1.mp4')).toBe(true);
    expect(recordingExists('evidence/ev-1.mp4')).toBe(true);
    expect(recordingExists('evidence/khong-co.mp4')).toBe(false);
  });
});

describe('findPersistedRecording', () => {
  it('tìm tệp bền theo ID bằng chứng, trả đường dẫn tương đối', () => {
    mockDirs.add('file:///docs/evidence');
    mockFiles.set('file:///docs/evidence/ev-1.mov', 5);
    mockFiles.set('file:///docs/evidence/ev-10.mp4', 5);
    expect(findPersistedRecording('ev-1')).toBe('evidence/ev-1.mov');
    expect(findPersistedRecording('ev-9')).toBeNull();
  });

  it('chưa có thư mục evidence: null', () => {
    expect(findPersistedRecording('ev-1')).toBeNull();
  });
});

describe('getAvailableDiskBytes', () => {
  it('trả dung lượng trống; không đọc được thì null (không chặn quay)', () => {
    expect(getAvailableDiskBytes()).toBe(1_000_000);
    mockDisk = () => {
      throw new Error('x');
    };
    expect(getAvailableDiskBytes()).toBeNull();
  });
});

describe('probeEvidenceDirWritable', () => {
  it('ghi được: tạo thư mục, tạo + ghi + XÓA đúng tệp thăm dò, không đụng tệp bằng chứng', () => {
    mockFiles.set('file:///docs/evidence/ev-1.mp4', 123);
    expect(probeEvidenceDirWritable()).toBe(true);
    expect(mockProbeLog.map((l) => l.split(':')[0])).toEqual(['create', 'delete']);
    expect(mockProbeLog[0]).toMatch(/\.probe-\d+$/);
    expect([...mockFiles.keys()]).toEqual(['file:///docs/evidence/ev-1.mp4']);
    expect(mockFiles.get('file:///docs/evidence/ev-1.mp4')).toBe(123);
  });

  it('dọn tệp thăm dò sót lại, chỉ đúng tên .probe-<số>; không đụng tệp bằng chứng hay tệp tên gần giống', () => {
    mockFiles.set('file:///docs/evidence/.probe-111', 1);
    mockFiles.set('file:///docs/evidence/.probe-222', 1);
    mockFiles.set('file:///docs/evidence/ev-1.mp4', 123);
    mockFiles.set('file:///docs/evidence/.probe-keep.mp4', 5);
    mockFiles.set('file:///docs/evidence/x.probe-333', 7);
    expect(probeEvidenceDirWritable()).toBe(true);
    expect([...mockFiles.keys()].sort()).toEqual([
      'file:///docs/evidence/.probe-keep.mp4',
      'file:///docs/evidence/ev-1.mp4',
      'file:///docs/evidence/x.probe-333',
    ]);
  });

  it('không ghi được: false và vẫn dọn tệp thăm dò', () => {
    mockWriteError = new Error('read-only');
    expect(probeEvidenceDirWritable()).toBe(false);
    expect(mockProbeLog.map((l) => l.split(':')[0])).toEqual(['create', 'delete']);
    expect(mockFiles.size).toBe(0);
  });
});

describe('deleteRecording (chỉ cho ngoại lệ xóa ảnh hàng hoàn, Q-26j)', () => {
  it('xóa tệp bền theo đường dẫn tương đối; chỉ đúng tệp đó', () => {
    mockFiles.set('file:///docs/evidence/a.jpg', 5);
    mockFiles.set('file:///docs/evidence/b.jpg', 5);
    expect(deleteRecording('evidence/a.jpg')).toEqual({ ok: true, deleted: true });
    expect(mockFiles.has('file:///docs/evidence/a.jpg')).toBe(false);
    expect(mockFiles.has('file:///docs/evidence/b.jpg')).toBe(true);
  });

  it('tệp không còn: ok (xóa lặp lại an toàn)', () => {
    expect(deleteRecording('evidence/gone.jpg')).toEqual({ ok: true, deleted: false });
  });

  it('dữ liệu cũ lưu đường dẫn tuyệt đối với container đã đổi: tìm lại theo thư mục tài liệu hiện tại', () => {
    mockFiles.set('file:///docs/evidence/a.jpg', 5);
    expect(deleteRecording('file:///old-container/evidence/a.jpg')).toEqual({
      ok: true,
      deleted: true,
    });
    expect(mockFiles.size).toBe(0);
  });

  it('tệp ngoài thư mục evidence (tệp tạm camera) và đường dẫn có ".." thì KHÔNG đụng tới', () => {
    mockFiles.set('file:///cache/Camera/x.jpg', 5);
    mockFiles.set('file:///docs/other.txt', 5);
    expect(deleteRecording('file:///cache/Camera/x.jpg')).toEqual({ ok: true, deleted: false });
    expect(deleteRecording('evidence/../other.txt')).toEqual({ ok: false });
    expect(mockFiles.has('file:///cache/Camera/x.jpg')).toBe(true);
    expect(mockFiles.has('file:///docs/other.txt')).toBe(true);
  });

  it('xóa lỗi (ném lỗi hoặc tệp còn nguyên): ok false, không ném', () => {
    mockFiles.set('file:///docs/evidence/a.jpg', 5);
    mockDeleteMode = 'throw';
    expect(deleteRecording('evidence/a.jpg')).toEqual({ ok: false });
    mockDeleteMode = 'noop';
    expect(deleteRecording('evidence/a.jpg')).toEqual({ ok: false });
    expect(mockFiles.has('file:///docs/evidence/a.jpg')).toBe(true);
  });
});

describe('loại thư mục bằng chứng khỏi sao lưu (V1-12, Q-24d)', () => {
  it('khi mở app: tạo thư mục nếu thiếu rồi đặt cờ cho đúng thư mục evidence', async () => {
    await expect(excludeEvidenceDirFromBackup()).resolves.toBe('excluded');
    expect(mockDirs.has('file:///docs/evidence')).toBe(true);
    expect(mockExclude).toHaveBeenCalledWith('evidence', 'file:///docs/evidence');
  });

  it('thư mục đã có: vẫn đặt lại cờ (idempotent), không tạo lại', async () => {
    mockDirs.add('file:///docs/evidence');
    await excludeEvidenceDirFromBackup();
    await excludeEvidenceDirFromBackup();
    expect(mockExclude).toHaveBeenCalledTimes(2);
  });

  it('không có module (Android, web, Expo Go): không đụng hệ tệp, không gọi adapter', async () => {
    mockExclusionSupported = false;
    await expect(excludeEvidenceDirFromBackup()).resolves.toBe('unsupported');
    expect(mockDirs.size).toBe(0);
    expect(mockExclude).not.toHaveBeenCalled();
  });

  it('kết quả của adapter (lỗi đặt cờ) được trả nguyên, không ném', async () => {
    mockExclude.mockResolvedValueOnce('failed');
    await expect(excludeEvidenceDirFromBackup()).resolves.toBe('failed');
  });

  it('persistRecording tự tạo lại thư mục thì đặt lại cờ; thư mục đã có thì không gọi', () => {
    mockFiles.set('file:///cache/a.mp4', 1);
    expect(persistRecording('file:///cache/a.mp4', 'ev-a', 'mp4')).toMatchObject({ ok: true });
    expect(mockExclude).toHaveBeenCalledTimes(1);
    expect(mockExclude).toHaveBeenCalledWith('evidence', 'file:///docs/evidence');
    mockFiles.set('file:///cache/b.mp4', 1);
    expect(persistRecording('file:///cache/b.mp4', 'ev-b', 'mp4')).toMatchObject({ ok: true });
    expect(mockExclude).toHaveBeenCalledTimes(1);
  });

  it('đặt cờ lỗi không làm hỏng việc lưu tệp', () => {
    mockExclude.mockRejectedValueOnce(new Error('x'));
    mockFiles.set('file:///cache/c.mp4', 5);
    expect(persistRecording('file:///cache/c.mp4', 'ev-c', 'mp4')).toEqual({
      ok: true,
      uri: 'evidence/ev-c.mp4',
      sizeBytes: 5,
    });
  });

  it('probeEvidenceDirWritable tự tạo thư mục thì cũng đặt cờ', () => {
    expect(probeEvidenceDirWritable()).toBe(true);
    expect(mockExclude).toHaveBeenCalledWith('evidence', 'file:///docs/evidence');
  });
});

describe('deleteAllEvidenceFiles (chỉ sau khi máy chủ xác nhận xóa tài khoản, V1-15)', () => {
  it('xóa mọi tệp trong evidence/, giữ thư mục, không đụng tệp ngoài evidence/', () => {
    mockDirs.add('file:///docs/evidence');
    mockFiles.set('file:///docs/evidence/ev-1.mp4', 10);
    mockFiles.set('file:///docs/evidence/m-1.jpg', 5);
    mockFiles.set('file:///docs/.pending-local-wipe', 2);
    mockFiles.set('file:///cache/tmp.mp4', 1);
    expect(deleteAllEvidenceFiles()).toBe(true);
    expect([...mockFiles.keys()].sort()).toEqual([
      'file:///cache/tmp.mp4',
      'file:///docs/.pending-local-wipe',
    ]);
    expect(mockDirs.has('file:///docs/evidence')).toBe(true);
  });

  it('idempotent: thư mục không có hoặc đã rỗng thì true', () => {
    expect(deleteAllEvidenceFiles()).toBe(true);
    mockDirs.add('file:///docs/evidence');
    expect(deleteAllEvidenceFiles()).toBe(true);
  });

  it('còn sót tệp (xóa lỗi) thì false, không ném', () => {
    mockDirs.add('file:///docs/evidence');
    mockFiles.set('file:///docs/evidence/ev-1.mp4', 10);
    mockDeleteMode = 'throw';
    expect(deleteAllEvidenceFiles()).toBe(false);
    mockDeleteMode = 'noop';
    expect(deleteAllEvidenceFiles()).toBe(false);
  });
});
