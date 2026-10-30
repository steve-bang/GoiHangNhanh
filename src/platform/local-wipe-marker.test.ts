import {
  clearPendingLocalWipe,
  hasPendingLocalWipe,
  LOCAL_WIPE_MARKER_NAME,
  setPendingLocalWipe,
} from './local-wipe-marker';

const mockFiles = new Map<string, string>();
let mockBroken = false;

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      if (mockBroken) throw new Error('no fs');
      this.uri = `${dir.uri}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(content: string) {
      mockFiles.set(this.uri, content);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return { File: MockFile, Paths: { document: { uri: 'file:///docs' } } };
});

beforeEach(() => {
  mockFiles.clear();
  mockBroken = false;
});

describe('dấu xóa dữ liệu cục bộ (V1-15)', () => {
  it('đặt -> có -> gỡ -> không; nằm ở thư mục tài liệu, ngoài CSDL và evidence/, không chứa PII', () => {
    expect(hasPendingLocalWipe()).toBe(false);
    expect(setPendingLocalWipe()).toBe(true);
    expect(hasPendingLocalWipe()).toBe(true);
    expect([...mockFiles.entries()]).toEqual([[`file:///docs/${LOCAL_WIPE_MARKER_NAME}`, 'v1']]);
    expect(clearPendingLocalWipe()).toBe(true);
    expect(hasPendingLocalWipe()).toBe(false);
  });

  it('đặt/gỡ lặp lại an toàn', () => {
    expect(setPendingLocalWipe()).toBe(true);
    expect(setPendingLocalWipe()).toBe(true);
    expect(clearPendingLocalWipe()).toBe(true);
    expect(clearPendingLocalWipe()).toBe(true);
  });

  it('không có hệ tệp (web): không có dấu, đặt/gỡ báo false, không ném', () => {
    mockBroken = true;
    expect(hasPendingLocalWipe()).toBe(false);
    expect(setPendingLocalWipe()).toBe(false);
    expect(clearPendingLocalWipe()).toBe(false);
  });
});
