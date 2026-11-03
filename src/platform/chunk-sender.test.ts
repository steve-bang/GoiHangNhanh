import { createTempFileChunkSender, removeOrphanChunkFiles } from './chunk-sender';

const mockState = {
  files: new Map<string, { bytes: Uint8Array }>(),
  deleted: [] as string[],
  uploads: [] as { url: string; uri: string; options: unknown }[],
  uploadResult: { status: 308, headers: { Range: 'bytes=0-9' } } as unknown,
  uploadError: null as Error | null,
  cancelled: 0,
  hang: false,
  rejectHang: (() => undefined) as () => void,
  listed: [] as string[],
};

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    name: string;
    constructor(...parts: unknown[]) {
      const last = parts[parts.length - 1];
      this.name = typeof last === 'string' ? (last.split('/').pop() as string) : 'x';
      this.uri = parts.map((p) => (typeof p === 'string' ? p : 'file:///cache')).join('/');
    }
    get exists() {
      return mockState.files.has(this.uri);
    }
    open() {
      const entry = mockState.files.get(this.uri);
      let offset = 0;
      return {
        get offset() {
          return offset;
        },
        set offset(v: number) {
          offset = v;
        },
        readBytes: async (n: number) =>
          entry ? entry.bytes.slice(offset, offset + n) : new Uint8Array(),
        close: () => undefined,
      };
    }
    create() {
      mockState.files.set(this.uri, { bytes: new Uint8Array() });
    }
    async write(bytes: Uint8Array) {
      mockState.files.set(this.uri, { bytes });
    }
    delete() {
      mockState.files.delete(this.uri);
      mockState.deleted.push(this.name);
    }
  }
  class MockDirectory {
    list() {
      return mockState.listed.map((name) => {
        const f = new MockFile(`file:///cache/${name}`);
        f.name = name;
        return f;
      });
    }
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    FileMode: { ReadOnly: 'r' },
    Paths: { cache: 'file:///cache' },
  };
});
jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  createUploadTask: (url: string, uri: string, options: unknown) => {
    mockState.uploads.push({ url, uri, options });
    return {
      uploadAsync: async () => {
        if (mockState.hang) {
          return new Promise((_resolve, reject) => {
            mockState.rejectHang = () => reject(new Error('cancelled'));
          });
        }
        if (mockState.uploadError) throw mockState.uploadError;
        return mockState.uploadResult;
      },
      cancelAsync: async () => {
        mockState.cancelled += 1;
        mockState.rejectHang();
      },
    };
  },
}));

const SOURCE = 'file:///docs/evidence/e1.mp4';
const request = (over: Record<string, unknown> = {}) => ({
  url: 'https://session/1',
  localUri: SOURCE,
  start: 4,
  end: 9,
  contentRange: 'bytes 4-9/20',
  evidenceId: 'ev-1',
  ...over,
});

beforeEach(() => {
  mockState.files.clear();
  mockState.deleted.length = 0;
  mockState.uploads.length = 0;
  mockState.uploadResult = { status: 308, headers: { Range: 'bytes=0-9' } };
  mockState.uploadError = null;
  mockState.cancelled = 0;
  mockState.hang = false;
  mockState.listed = [];
  mockState.files.set(SOURCE, { bytes: Uint8Array.from({ length: 20 }, (_, i) => i) });
});

describe('createTempFileChunkSender', () => {
  it('đọc đúng dải byte, gửi tệp tạm kèm Content-Range, trả status + Range, rồi xóa tệp tạm', async () => {
    const response = await createTempFileChunkSender().send(request());
    expect(response).toEqual({ status: 308, range: 'bytes=0-9' });
    expect(mockState.uploads).toHaveLength(1);
    const upload = mockState.uploads[0] as {
      url: string;
      uri: string;
      options: { httpMethod: string; headers: Record<string, string> };
    };
    expect(upload.url).toBe('https://session/1');
    expect(upload.options.httpMethod).toBe('PUT');
    expect(upload.options.headers).toEqual({ 'Content-Range': 'bytes 4-9/20' });
    expect(upload.uri).toContain('upload-chunk-ev-1.part');
    expect(mockState.files.has(upload.uri)).toBe(false); // tệp tạm đã xóa
    expect(mockState.deleted).toContain('upload-chunk-ev-1.part');
    // tệp gốc không bị đụng
    expect(mockState.files.has(SOURCE)).toBe(true);
  });

  it('đã ghi đúng 6 byte [4..9] vào tệp tạm trước khi gửi', async () => {
    let written: number[] = [];
    mockState.uploadResult = { status: 200, headers: {} };
    const sender = createTempFileChunkSender();
    const original = mockState.files.set.bind(mockState.files);
    mockState.files.set = ((key: string, value: { bytes: Uint8Array }) => {
      if (key.includes('upload-chunk-')) written = Array.from(value.bytes);
      return original(key, value);
    }) as typeof mockState.files.set;
    const response = await sender.send(request());
    mockState.files.set = original as typeof mockState.files.set;
    expect(written).toEqual([4, 5, 6, 7, 8, 9]);
    expect(response).toEqual({ status: 200, range: null });
  });

  it('đọc thiếu byte (tệp ngắn hơn dự kiến): ném lỗi, không gửi, xóa tệp tạm', async () => {
    mockState.files.set(SOURCE, { bytes: new Uint8Array(6) });
    await expect(createTempFileChunkSender().send(request())).rejects.toThrow('short_read');
    expect(mockState.uploads).toHaveLength(0);
  });

  it('lỗi mạng khi gửi: ném lỗi và vẫn xóa tệp tạm', async () => {
    mockState.uploadError = new Error('offline');
    await expect(createTempFileChunkSender().send(request())).rejects.toThrow('offline');
    expect(mockState.deleted).toContain('upload-chunk-ev-1.part');
  });

  it('hủy bằng signal: hủy tác vụ native, ném lỗi và xóa tệp tạm', async () => {
    mockState.hang = true;
    const controller = new AbortController();
    const pending = createTempFileChunkSender().send(request({ signal: controller.signal }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
    expect(mockState.cancelled).toBe(1);
    expect(mockState.deleted).toContain('upload-chunk-ev-1.part');
  });

  it('tên tệp tạm bỏ ký tự lạ trong evidenceId', async () => {
    await createTempFileChunkSender().send(request({ evidenceId: '../x/y' }));
    expect((mockState.uploads[0] as { uri: string }).uri).toContain('upload-chunk-___x_y.part');
  });
});

describe('removeOrphanChunkFiles', () => {
  it('chỉ xóa tệp có đúng tiền tố và đuôi của bộ gửi khối', () => {
    mockState.listed = [
      'upload-chunk-a.part',
      'khac.mp4',
      'upload-chunk-b.txt',
      'upload-chunk-c.part',
    ];
    for (const name of mockState.listed)
      mockState.files.set(`file:///cache/${name}`, { bytes: new Uint8Array() });
    expect(removeOrphanChunkFiles()).toBe(2);
    expect(mockState.deleted.sort()).toEqual(['upload-chunk-a.part', 'upload-chunk-c.part']);
    expect(mockState.files.has('file:///cache/khac.mp4')).toBe(true);
  });

  it('không liệt kê được cache: trả 0, không ném', () => {
    mockState.listed = null as unknown as string[];
    expect(removeOrphanChunkFiles()).toBe(0);
  });
});
