import {
  INITIAL_SESSION,
  sessionKey,
  sessionReducer,
  type SessionState,
  type SessionUser,
} from './session-state';

const USER: SessionUser = { uid: 'u1', email: 'a@example.com', displayName: 'An' };

describe('sessionReducer', () => {
  it('đăng nhập đặt người dùng + shop và tăng epoch', () => {
    const next = sessionReducer(INITIAL_SESSION, { type: 'signed_in', user: USER, shopId: 's1' });
    expect(next).toMatchObject({ status: 'signed_in', user: USER, shopId: 's1', epoch: 1 });
  });

  it('đổi shop tăng epoch và đổi khóa; cùng shop thì không đổi gì', () => {
    const a = sessionReducer(INITIAL_SESSION, { type: 'signed_in', user: USER, shopId: 's1' });
    const b = sessionReducer(a, { type: 'shop_changed', shopId: 's2' });
    expect(b.epoch).toBe(a.epoch + 1);
    expect(sessionKey(b)).not.toBe(sessionKey(a));
    expect(sessionReducer(b, { type: 'shop_changed', shopId: 's2' })).toBe(b);
  });

  it('đổi shop khi chưa đăng nhập bị bỏ qua', () => {
    expect(sessionReducer(INITIAL_SESSION, { type: 'shop_changed', shopId: 's9' })).toBe(
      INITIAL_SESSION,
    );
  });

  it('cập nhật họ tên không đổi epoch (cache theo phiên giữ nguyên)', () => {
    const a = sessionReducer(INITIAL_SESSION, { type: 'signed_in', user: USER, shopId: 's1' });
    const b = sessionReducer(a, { type: 'profile_updated', displayName: 'Bình' });
    expect(b.user?.displayName).toBe('Bình');
    expect(b.epoch).toBe(a.epoch);
    expect(sessionKey(b)).toBe(sessionKey(a));
    expect(b.profileRevision).toBe(a.profileRevision + 1);
  });

  it('cập nhật họ tên khi phiên chưa biết người dùng vẫn tăng profileRevision (để màn tải lại hồ sơ)', () => {
    const b = sessionReducer(INITIAL_SESSION, { type: 'profile_updated', displayName: 'Bình' });
    expect(b.user).toBeNull();
    expect(b.profileRevision).toBe(1);
    expect(b.epoch).toBe(INITIAL_SESSION.epoch);
  });

  it('đăng nhập/đăng xuất đặt lại profileRevision về 0', () => {
    const a = sessionReducer(INITIAL_SESSION, { type: 'profile_updated', displayName: 'Bình' });
    const b = sessionReducer(a, { type: 'signed_in', user: USER, shopId: null });
    expect(b.profileRevision).toBe(0);
    const c = sessionReducer(sessionReducer(b, { type: 'profile_updated', displayName: 'X' }), {
      type: 'signed_out',
    });
    expect(c.profileRevision).toBe(0);
  });

  it('đăng xuất xóa người dùng và shop, epoch vẫn tăng (không quay về 0)', () => {
    const a = sessionReducer(INITIAL_SESSION, { type: 'signed_in', user: USER, shopId: 's1' });
    const out = sessionReducer(a, { type: 'signed_out' });
    expect(out).toEqual({
      status: 'signed_out',
      user: null,
      shopId: null,
      epoch: a.epoch + 1,
      profileRevision: 0,
    });
    expect(sessionKey(out)).toBe('anonymous');
    expect(sessionReducer(out, { type: 'signed_out' })).toBe(out);
  });

  it('hai tài khoản khác nhau không bao giờ có cùng khóa phiên', () => {
    const state = (uid: string): SessionState =>
      sessionReducer(INITIAL_SESSION, {
        type: 'signed_in',
        user: { ...USER, uid },
        shopId: 's1',
      });
    expect(sessionKey(state('u1'))).not.toBe(sessionKey(state('u2')));
  });
});
