import {
  chunkContentRange,
  GCS_CHUNK_ALIGNMENT,
  nextChunk,
  parseReceivedBytes,
  statusQueryContentRange,
  UPLOAD_CHUNK_BYTES,
} from './upload-protocol';

describe('hằng số', () => {
  it('khối mặc định là bội của 256 KiB (quy tắc của GCS)', () => {
    expect(GCS_CHUNK_ALIGNMENT).toBe(262_144);
    expect(UPLOAD_CHUNK_BYTES % GCS_CHUNK_ALIGNMENT).toBe(0);
    expect(UPLOAD_CHUNK_BYTES).toBe(8 * 1024 * 1024);
  });
});

describe('parseReceivedBytes', () => {
  it('Range bytes=0-N nghĩa là đã nhận N+1 byte; vắng Range là 0', () => {
    expect(parseReceivedBytes('bytes=0-262143', 1_000_000)).toBe(262_144);
    expect(parseReceivedBytes('bytes=0-0', 10)).toBe(1);
    expect(parseReceivedBytes(null, 10)).toBe(0);
    expect(parseReceivedBytes(undefined, 10)).toBe(0);
    expect(parseReceivedBytes('  ', 10)).toBe(0);
  });

  it('không hiểu được hoặc vô lý thì null (không đoán)', () => {
    expect(parseReceivedBytes('bytes=5-9', 100)).toBeNull(); // phải bắt đầu từ 0
    expect(parseReceivedBytes('bytes 0-9', 100)).toBeNull();
    expect(parseReceivedBytes('rác', 100)).toBeNull();
    expect(parseReceivedBytes('bytes=0-99', 99)).toBeNull(); // nhận nhiều hơn tổng
    expect(parseReceivedBytes('bytes=0-99999999999999999999', 100)).toBeNull();
  });

  it('nhận đủ tổng thì trả đúng tổng', () => {
    expect(parseReceivedBytes('bytes=0-99', 100)).toBe(100);
  });
});

describe('nextChunk', () => {
  const A = GCS_CHUNK_ALIGNMENT;

  it('tệp nhỏ hơn một khối: một khối duy nhất cũng là khối cuối', () => {
    expect(nextChunk(0, 1000, 4 * A)).toEqual({ start: 0, end: 999, isLast: true });
  });

  it('chia đều theo khối, khối cuối là phần còn lại', () => {
    const total = 10 * A + 123;
    const first = nextChunk(0, total, 4 * A);
    expect(first).toEqual({ start: 0, end: 4 * A - 1, isLast: false });
    const second = nextChunk(4 * A, total, 4 * A);
    expect(second).toEqual({ start: 4 * A, end: 8 * A - 1, isLast: false });
    const last = nextChunk(8 * A, total, 4 * A);
    expect(last).toEqual({ start: 8 * A, end: total - 1, isLast: true });
  });

  it('tiếp tục từ điểm máy chủ báo, kể cả khi nó nhận ít hơn khối đã gửi', () => {
    const total = 10 * A;
    expect(nextChunk(3 * A, total, 4 * A)).toEqual({ start: 3 * A, end: 7 * A - 1, isLast: false });
  });

  it('không còn gì để gửi hoặc tham số vô lý thì null', () => {
    expect(nextChunk(100, 100)).toBeNull();
    expect(nextChunk(101, 100)).toBeNull();
    expect(nextChunk(0, 0)).toBeNull();
    expect(nextChunk(-1, 100)).toBeNull();
    expect(nextChunk(0.5, 100)).toBeNull();
    expect(nextChunk(0, 100, 1000)).toBeNull(); // khối không bội của 256 KiB
    expect(nextChunk(0, 100, 0)).toBeNull();
  });

  it('khối khớp đúng bội số ở cuối tệp cũng là khối cuối', () => {
    expect(nextChunk(4 * A, 8 * A, 4 * A)).toEqual({ start: 4 * A, end: 8 * A - 1, isLast: true });
  });
});

describe('Content-Range', () => {
  it('định dạng khối và lệnh hỏi trạng thái', () => {
    expect(chunkContentRange({ start: 0, end: 262_143, isLast: false }, 1_000_000)).toBe(
      'bytes 0-262143/1000000',
    );
    expect(statusQueryContentRange(1_000_000)).toBe('bytes */1000000');
  });
});
