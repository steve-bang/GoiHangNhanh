import { createHash, randomBytes } from 'node:crypto';

import { fileFingerprint, hashFile, HASH_CHUNK_BYTES } from './file-hasher';

const mockFiles = new Map<string, Uint8Array>();
/** Thời điểm sửa đổi theo uri; vắng = hệ tệp không báo (`null`). */
const mockMtimes = new Map<string, number>();
let mockFailInfo = false;
let mockFailRead = false;
const mockClosed: string[] = [];

jest.mock('expo-file-system', () => ({
  FileMode: { ReadOnly: 'r' },
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      if (mockFailInfo) throw new Error('io');
      return mockFiles.get(this.uri)?.length ?? 0;
    }
    get modificationTime() {
      return mockMtimes.get(this.uri) ?? null;
    }
    open() {
      const bytes = mockFiles.get(this.uri) ?? new Uint8Array();
      let offset = 0;
      const uri = this.uri;
      return {
        readBytes: async (length: number) => {
          if (mockFailRead) throw new Error('io');
          const chunk = bytes.subarray(offset, offset + length);
          offset += chunk.length;
          return chunk;
        },
        close: () => void mockClosed.push(uri),
      };
    }
  },
}));

beforeEach(() => {
  mockFiles.clear();
  mockMtimes.clear();
  mockFailInfo = false;
  mockClosed.length = 0;
  mockFailRead = false;
});

describe('hashFile', () => {
  it('khớp SHA-256 của node cho tệp nhiều khối và báo đúng kích thước', async () => {
    const bytes = new Uint8Array(randomBytes(HASH_CHUNK_BYTES * 2 + 123));
    mockFiles.set('file:///a.mp4', bytes);
    expect(await hashFile('file:///a.mp4')).toEqual({
      ok: true,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: bytes.length,
    });
    expect(mockClosed).toEqual(['file:///a.mp4']);
  });

  it('tệp rỗng vẫn băm được', async () => {
    mockFiles.set('file:///e', new Uint8Array());
    expect(await hashFile('file:///e')).toMatchObject({ ok: true, sizeBytes: 0 });
  });

  it('tệp không có: FILE_MISSING', async () => {
    expect(await hashFile('file:///khong-co')).toEqual({ ok: false, reason: 'FILE_MISSING' });
  });

  it('lỗi đọc giữa chừng: FILE_UNREADABLE và vẫn đóng tệp', async () => {
    mockFiles.set('file:///b', new Uint8Array(10));
    mockFailRead = true;
    expect(await hashFile('file:///b')).toEqual({ ok: false, reason: 'FILE_UNREADABLE' });
    expect(mockClosed).toEqual(['file:///b']);
  });
});

describe('hashFile nhường luồng (V1-13)', () => {
  it('xét nhường sau từng lát của mỗi khối; mã băm không đổi', async () => {
    const bytes = new Uint8Array(randomBytes(HASH_CHUNK_BYTES * 2 + 5));
    mockFiles.set('file:///y.mp4', bytes);
    let calls = 0;
    const result = await hashFile('file:///y.mp4', {
      yielder: {
        maybeYield: async () => {
          calls += 1;
        },
      },
    });
    expect(result).toEqual({
      ok: true,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: bytes.length,
    });
    // 2 khối đủ × 4 lát 256 KB + 1 khối 5 byte.
    expect(calls).toBe(9);
  });
});

describe('fileFingerprint', () => {
  it('kích thước + thời điểm sửa đổi (làm tròn xuống ms)', () => {
    mockFiles.set('file:///f.mp4', new Uint8Array(42));
    mockMtimes.set('file:///f.mp4', 1_700_000_000_123.9);
    expect(fileFingerprint('file:///f.mp4')).toEqual({
      sizeBytes: 42,
      modifiedAtMs: 1_700_000_000_123,
    });
  });

  it('không có tệp, hệ tệp không báo thời điểm sửa đổi hoặc đọc lỗi: null (bên gọi phải băm lại)', () => {
    expect(fileFingerprint('file:///khong-co')).toBeNull();
    mockFiles.set('file:///n.mp4', new Uint8Array(3));
    expect(fileFingerprint('file:///n.mp4')).toBeNull();
    mockMtimes.set('file:///n.mp4', 5);
    mockFailInfo = true;
    expect(fileFingerprint('file:///n.mp4')).toBeNull();
  });
});
