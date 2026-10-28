import { SESSION_STATUSES, canChangeSessionStatus, isSessionStatus } from './session-status';

describe('canChangeSessionStatus', () => {
  it('cho đi tới theo chuỗi created -> recording -> kết thúc/gián đoạn/cần xử lý -> confirmed', () => {
    expect(canChangeSessionStatus('created', 'recording')).toBe(true);
    for (const to of ['ended', 'interrupted', 'needs_attention']) {
      expect(canChangeSessionStatus('recording', to)).toBe(true);
    }
    for (const from of ['ended', 'interrupted', 'needs_attention']) {
      expect(canChangeSessionStatus(from, 'confirmed')).toBe(true);
    }
  });

  it('từ chối lùi và nhảy cóc', () => {
    expect(canChangeSessionStatus('recording', 'created')).toBe(false);
    expect(canChangeSessionStatus('ended', 'recording')).toBe(false);
    expect(canChangeSessionStatus('created', 'ended')).toBe(false);
    expect(canChangeSessionStatus('recording', 'confirmed')).toBe(false);
  });

  it('confirmed là điểm cuối: chỉ đặt lại đúng nó', () => {
    for (const to of SESSION_STATUSES) {
      expect(canChangeSessionStatus('confirmed', to)).toBe(to === 'confirmed');
    }
  });

  it('trạng thái lạ ở bất kỳ phía nào bị từ chối, kể cả cùng giá trị', () => {
    expect(canChangeSessionStatus('xyz', 'xyz')).toBe(false);
    expect(canChangeSessionStatus('created', 'xyz')).toBe(false);
    expect(canChangeSessionStatus('xyz', 'recording')).toBe(false);
    expect(isSessionStatus('')).toBe(false);
  });
});
