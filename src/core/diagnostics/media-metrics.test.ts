import { buildMediaMetrics, MEDIA_METRICS_KEYS } from './media-metrics';

describe('buildMediaMetrics (V1-27)', () => {
  it('quay 1 phút: tính byte/phút và MB/giây băm', () => {
    const m = buildMediaMetrics({
      kind: 'record_save',
      platform: 'ios',
      sizeBytes: 45_000_000,
      wallMs: 60_000,
      hashMs: 3000,
      persistMs: 12,
      hashCount: 1,
    });
    expect(m).toMatchObject({
      kind: 'record_save',
      platform: 'ios',
      sizeBytes: 45_000_000,
      bytesPerMinute: 45_000_000,
      hashMs: 3000,
      hashMBps: 15,
      persistMs: 12,
      hashCount: 1,
      uploadMs: null,
      uploadMBps: null,
    });
  });

  it('chia cho 0 hoặc thiếu thời lượng: null, không Infinity/NaN', () => {
    const m = buildMediaMetrics({
      kind: 'upload',
      platform: 'android',
      sizeBytes: 1000,
      wallMs: 0,
      hashMs: 0,
      uploadMs: 0,
    });
    expect(m.bytesPerMinute).toBeNull();
    expect(m.hashMBps).toBeNull();
    expect(m.uploadMBps).toBeNull();
    const none = buildMediaMetrics({ kind: 'upload', platform: 'other' });
    expect(Object.values(none).filter((v) => typeof v === 'number')).toEqual([]);
  });

  it('giá trị âm/NaN/Infinity bị loại thành null; số lẻ làm tròn', () => {
    const m = buildMediaMetrics({
      kind: 'recovery_save',
      platform: 'ios',
      sizeBytes: -1,
      wallMs: Number.NaN,
      hashMs: Number.POSITIVE_INFINITY,
      persistMs: 4.6,
    });
    expect(m.sizeBytes).toBeNull();
    expect(m.wallMs).toBeNull();
    expect(m.hashMs).toBeNull();
    expect(m.persistMs).toBe(5);
  });

  it('khóa của bản ghi nằm đúng trong danh sách cho phép và không chứa khóa nhạy cảm', () => {
    const m = buildMediaMetrics({ kind: 'record_save', platform: 'ios', sizeBytes: 1 });
    expect(Object.keys(m).sort()).toEqual([...MEDIA_METRICS_KEYS].sort());
    const sensitive = /id|path|uri|code|shop|order|message|error|uid|email/i;
    // `kind`/`platform`/`sizeBytes`... không khớp; chỉ khóa nằm ngoài danh sách mới bị bắt
    for (const key of Object.keys(m)) expect(key).not.toMatch(sensitive);
  });
});
