import { installCrashReportingEarly } from './crash-reporting-early';

describe('installCrashReportingEarly (V1-16, review PR #62)', () => {
  it('bản build cho phép: tạo adapter (cài handler lọc) ngay khi nạp module', () => {
    const install = jest.fn();
    expect(installCrashReportingEarly(true, install)).toBe(true);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('dev/test/cổng giả: không nạp SDK', () => {
    const install = jest.fn();
    expect(installCrashReportingEarly(false, install)).toBe(false);
    expect(install).not.toHaveBeenCalled();
    // Môi trường Jest: mặc định không cho phép (lần nạp module ở trên cũng không cài gì).
    expect(installCrashReportingEarly(undefined, install)).toBe(false);
  });
});
