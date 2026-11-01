import { reportMediaMetrics } from './media-metrics-log';

describe('reportMediaMetrics (V1-27)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ghi đúng một dòng media.metrics chỉ có số/nhãn, không đường dẫn hay ID', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    reportMediaMetrics({
      kind: 'record_save',
      sizeBytes: 45_000_000,
      wallMs: 60_000,
      hashMs: 3000,
    });
    expect(info).toHaveBeenCalledTimes(1);
    const [label, payload] = info.mock.calls[0] as [string, Record<string, unknown>];
    expect(label).toBe('[info] media.metrics');
    expect(payload).toMatchObject({ kind: 'record_save', bytesPerMinute: 45_000_000 });
    expect(typeof payload.platform).toBe('string');
    expect(JSON.stringify(payload)).not.toMatch(/file:|evidence\/|\.mp4|\.mov/);
  });

  it('không ném lỗi ra ngoài khi log lỗi', () => {
    jest.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => reportMediaMetrics({ kind: 'upload', sizeBytes: 1 })).not.toThrow();
  });
});
