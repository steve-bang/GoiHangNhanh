import { mayHaveReachedServer } from './server-contact';

describe('mayHaveReachedServer với needs_attention (review PR #56)', () => {
  it('lỗi cục bộ trên tệp chưa từng thử: máy chủ chắc chắn chưa có', () => {
    for (const code of ['LOCAL_HASH_CHANGED', 'FILE_MISSING', 'FILE_UNREADABLE']) {
      expect(
        mayHaveReachedServer({ state: 'needs_attention', attemptCount: 0, lastErrorCode: code }),
      ).toBe(false);
    }
  });

  it('lỗi cục bộ trên tệp đã có lần thử: có thể đã tới máy chủ', () => {
    expect(
      mayHaveReachedServer({
        state: 'needs_attention',
        attemptCount: 1,
        lastErrorCode: 'FILE_MISSING',
      }),
    ).toBe(true);
  });

  it('lỗi máy chủ hoặc không rõ mã: có thể đã tới máy chủ', () => {
    expect(
      mayHaveReachedServer({
        state: 'needs_attention',
        attemptCount: 0,
        lastErrorCode: 'HTTP_403',
      }),
    ).toBe(true);
    expect(
      mayHaveReachedServer({ state: 'needs_attention', attemptCount: 0, lastErrorCode: null }),
    ).toBe(true);
  });
});
