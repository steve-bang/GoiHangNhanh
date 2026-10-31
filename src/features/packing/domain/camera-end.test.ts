import { classifyCameraEnd, LIMIT_TOLERANCE_MS } from './camera-end';

describe('classifyCameraEnd', () => {
  const limitSeconds = 600;

  it('đã yêu cầu dừng: requested, kể cả khi đã tới hạn', () => {
    expect(classifyCameraEnd({ stopRequested: true, elapsedMs: 5000, limitSeconds })).toBe(
      'requested',
    );
    expect(classifyCameraEnd({ stopRequested: true, elapsedMs: 600_000, limitSeconds })).toBe(
      'requested',
    );
  });

  it('camera tự dừng ở giới hạn (trong sai lệch cho phép): limit', () => {
    expect(classifyCameraEnd({ stopRequested: false, elapsedMs: 600_000, limitSeconds })).toBe(
      'limit',
    );
    expect(
      classifyCameraEnd({
        stopRequested: false,
        elapsedMs: 600_000 - LIMIT_TOLERANCE_MS,
        limitSeconds,
      }),
    ).toBe('limit');
  });

  it('camera tự dừng sớm hơn hạn mà không ai yêu cầu: early (gián đoạn)', () => {
    expect(
      classifyCameraEnd({
        stopRequested: false,
        elapsedMs: 600_000 - LIMIT_TOLERANCE_MS - 1,
        limitSeconds,
      }),
    ).toBe('early');
    expect(classifyCameraEnd({ stopRequested: false, elapsedMs: 0, limitSeconds })).toBe('early');
  });
});
