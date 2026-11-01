import {
  RECORDING_ACTIVITY_MAX_MS,
  beginRecordingActivity,
  isRecordingActive,
  resetRecordingActivityForTest,
  subscribeRecordingActivity,
} from './recording-activity';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  resetRecordingActivityForTest();
  jest.useRealTimers();
});

describe('recording-activity (V1-28)', () => {
  it('bật khi bắt đầu, tắt khi kết thúc, báo người nghe đúng một lần mỗi chiều', () => {
    const seen: boolean[] = [];
    subscribeRecordingActivity((v) => seen.push(v));
    expect(isRecordingActive()).toBe(false);
    const end = beginRecordingActivity();
    expect(isRecordingActive()).toBe(true);
    end();
    end(); // idempotent
    expect(isRecordingActive()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('nhiều lần quay chồng nhau: chỉ tắt khi phiếu cuối trả lại', () => {
    const seen: boolean[] = [];
    subscribeRecordingActivity((v) => seen.push(v));
    const a = beginRecordingActivity();
    const b = beginRecordingActivity();
    a();
    expect(isRecordingActive()).toBe(true);
    b();
    expect(isRecordingActive()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('lưới an toàn: phiếu bị bỏ quên tự hết hạn, cờ không kẹt', () => {
    const seen: boolean[] = [];
    subscribeRecordingActivity((v) => seen.push(v));
    beginRecordingActivity();
    jest.advanceTimersByTime(RECORDING_ACTIVITY_MAX_MS - 1);
    expect(isRecordingActive()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(isRecordingActive()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('người nghe ném lỗi không làm kẹt cờ hay chặn người nghe khác', () => {
    const seen: boolean[] = [];
    subscribeRecordingActivity(() => {
      throw new Error('boom');
    });
    subscribeRecordingActivity((v) => seen.push(v));
    const end = beginRecordingActivity();
    end();
    expect(seen).toEqual([true, false]);
    expect(isRecordingActive()).toBe(false);
  });

  it('hủy đăng ký thì không nhận nữa', () => {
    const seen: boolean[] = [];
    const off = subscribeRecordingActivity((v) => seen.push(v));
    off();
    beginRecordingActivity()();
    expect(seen).toEqual([]);
  });
});
