import { AbortedError, TimeoutError, withTimeout } from './with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('trả kết quả nếu xong trước hạn', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it('chuyển tiếp lỗi của lệnh', async () => {
    await expect(withTimeout(Promise.reject(new Error('x')), 1000)).rejects.toThrow('x');
  });

  it('lệnh treo: ném TimeoutError khi hết hạn', async () => {
    const pending = withTimeout(new Promise<never>(() => undefined), 30_000);
    jest.advanceTimersByTime(29_999);
    let settled = false;
    void pending.catch(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
  });

  it('hủy qua signal: ném AbortedError ngay, kể cả khi đã hủy từ trước', async () => {
    const controller = new AbortController();
    const pending = withTimeout(new Promise<never>(() => undefined), 30_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(AbortedError);
    await expect(withTimeout(Promise.resolve(1), 10, controller.signal)).rejects.toBeInstanceOf(
      AbortedError,
    );
  });

  it('ms = null: không hết giờ, chỉ hủy qua signal', async () => {
    const controller = new AbortController();
    const pending = withTimeout(new Promise<never>(() => undefined), null, controller.signal);
    expect(jest.getTimerCount()).toBe(0);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(AbortedError);
    await expect(withTimeout(Promise.resolve(3), null)).resolves.toBe(3);
  });

  it('dọn bộ hẹn giờ sau khi xong', async () => {
    await withTimeout(Promise.resolve(1), 1000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
