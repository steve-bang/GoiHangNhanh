import {
  PASSWORD_RECOVERY_MODE,
  SOCIAL_SIGN_IN_FLAGS,
  getEnabledSocialProviders,
  type SocialProvider,
} from './feature-flags';

describe('cờ đăng nhập Apple/Google', () => {
  it('v1 tắt cả hai (O-15: chỉ email + mật khẩu), không còn nút không hoạt động', () => {
    expect(SOCIAL_SIGN_IN_FLAGS).toEqual({ apple: false, google: false });
    expect(getEnabledSocialProviders()).toEqual([]);
  });

  it('bật lại thì giữ thứ tự Apple, Google', () => {
    expect(getEnabledSocialProviders({ apple: true, google: true })).toEqual(['apple', 'google']);
  });

  it.each<[Record<SocialProvider, boolean>, SocialProvider[]]>([
    [{ apple: false, google: true }, ['google']],
    [{ apple: true, google: false }, ['apple']],
    [{ apple: false, google: false }, []],
  ])('tắt từng cờ: %j', (flags, expected) => {
    expect(getEnabledSocialProviders(flags)).toEqual(expected);
  });
});

describe('cách lấy lại mật khẩu (D-14)', () => {
  it('v1 dùng thư đặt lại của Firebase Auth', () => {
    expect(PASSWORD_RECOVERY_MODE).toBe('email_link');
  });
});
