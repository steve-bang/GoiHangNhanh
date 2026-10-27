import { evaluateSwitchShopGuard } from './switch-shop-guard';

describe('evaluateSwitchShopGuard', () => {
  it('không quay, không tệp chưa đồng bộ: cho chuyển', () => {
    expect(evaluateSwitchShopGuard({ recording: false, unsynced: 0 })).toEqual({ kind: 'clear' });
  });
  it('đang quay: chặn, kể cả khi cũng còn tệp chưa đồng bộ hoặc không đọc được số tệp', () => {
    expect(evaluateSwitchShopGuard({ recording: true, unsynced: 3 })).toEqual({
      kind: 'blocked_recording',
    });
    expect(evaluateSwitchShopGuard({ recording: true, unsynced: null })).toEqual({
      kind: 'blocked_recording',
    });
  });
  it('còn tệp chưa đồng bộ: cảnh báo kèm số lượng', () => {
    expect(evaluateSwitchShopGuard({ recording: false, unsynced: 2 })).toEqual({
      kind: 'unsynced',
      count: 2,
    });
  });
  it('không đọc được kho cục bộ: chặn bảo thủ, không coi là an toàn', () => {
    expect(evaluateSwitchShopGuard({ recording: null, unsynced: 0 })).toEqual({ kind: 'unknown' });
    expect(evaluateSwitchShopGuard({ recording: false, unsynced: null })).toEqual({
      kind: 'unknown',
    });
  });
});
