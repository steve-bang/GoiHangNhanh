import { createHash, randomBytes } from 'node:crypto';

import { hashFile, HASH_CHUNK_BYTES } from './file-hasher';

const mockFiles = new Map<string, Uint8Array>();
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
