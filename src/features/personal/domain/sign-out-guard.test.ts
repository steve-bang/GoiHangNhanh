import { evaluateSignOutGuard } from './sign-out-guard';

describe('evaluateSignOutGuard', () => {
  it('không quay, không tệp chưa đồng bộ: cho đăng xuất', () => {
    expect(evaluateSignOutGuard({ recording: false, unsynced: 0 })).toEqual({ kind: 'clear' });
  });
  it('đang quay: chặn, kể cả khi cũng còn tệp chưa đồng bộ', () => {
    expect(evaluateSignOutGuard({ recording: true, unsynced: 3 })).toEqual({
      kind: 'blocked_recording',
    });
  });
  it('còn tệp chưa đồng bộ: cảnh báo kèm số lượng', () => {
    expect(evaluateSignOutGuard({ recording: false, unsynced: 2 })).toEqual({
      kind: 'unsynced',
      count: 2,
    });
  });
  it('không đọc được kho: không coi là an toàn', () => {
    expect(evaluateSignOutGuard({ recording: null, unsynced: 0 })).toEqual({ kind: 'unknown' });
    expect(evaluateSignOutGuard({ recording: false, unsynced: null })).toEqual({
      kind: 'unknown',
    });
  });
  it('không đọc được số chưa đồng bộ nhưng biết đang quay: vẫn chặn vì đang quay', () => {
    expect(evaluateSignOutGuard({ recording: true, unsynced: null })).toEqual({
      kind: 'blocked_recording',
    });
  });
});
