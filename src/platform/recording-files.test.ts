import {
  findPersistedRecording,
  getAvailableDiskBytes,
  persistRecording,
  probeEvidenceDirWritable,
  recordingExists,
  resolveRecordingUri,
} from './recording-files';

const mockFiles = new Map<string, number>();
const mockDirs = new Set<string>();
let mockMoveError: (Error & { code?: string }) | null = null;
let mockDocument = 'file:///docs';
let mockWriteError: Error | null = null;
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
  mockFiles.clear();
  mockDirs.clear();
  mockMoveError = null;
  mockWriteError = null;
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
