import { persistRecording, recordingExists } from './recording-files';

const mockFiles = new Map<string, number>();
const mockDirs = new Set<string>();
let mockMoveError: Error | null = null;

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(a: string | { uri: string }, b?: string) {
      this.uri = typeof a === 'string' ? a : `${a.uri}/${b}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri) ?? null;
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
      this.uri = typeof a === 'string' ? a : `${a.uri}/${b}`;
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { document: { uri: 'file:///docs' } } };
});

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  mockMoveError = null;
});

describe('persistRecording', () => {
  it('chuyển (không sao chép) tệp tạm sang thư mục tài liệu theo ID bằng chứng', () => {
    mockFiles.set('file:///cache/x.mp4', 2048);
    expect(persistRecording('file:///cache/x.mp4', 'ev-1', '.mp4')).toEqual({
      ok: true,
      uri: 'file:///docs/evidence/ev-1.mp4',
      sizeBytes: 2048,
    });
    expect(mockFiles.has('file:///cache/x.mp4')).toBe(false);
    expect(recordingExists('file:///docs/evidence/ev-1.mp4')).toBe(true);
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

  it('hết dung lượng được phân biệt với lỗi khác; tệp tạm còn nguyên', () => {
    mockFiles.set('file:///cache/x.mp4', 1);
    mockMoveError = new Error('No space left on device');
    expect(persistRecording('file:///cache/x.mp4', 'ev-4', 'mp4')).toEqual({
      ok: false,
      reason: 'STORAGE_FULL',
    });
    mockMoveError = new Error('other');
    expect(persistRecording('file:///cache/x.mp4', 'ev-5', 'mp4')).toMatchObject({
      reason: 'FAILED',
    });
    expect(mockFiles.has('file:///cache/x.mp4')).toBe(true);
  });
});
