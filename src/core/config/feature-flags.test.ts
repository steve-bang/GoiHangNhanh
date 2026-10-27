import {
  SOCIAL_SIGN_IN_FLAGS,
  getEnabledSocialProviders,
  type SocialProvider,
} from './feature-flags';

describe('cờ đăng nhập Apple/Google', () => {
  it('mặc định bật cả hai theo thứ tự Apple, Google', () => {
    expect(SOCIAL_SIGN_IN_FLAGS).toEqual({ apple: true, google: true });
    expect(getEnabledSocialProviders()).toEqual(['apple', 'google']);
  });

  it.each<[Record<SocialProvider, boolean>, SocialProvider[]]>([
    [{ apple: false, google: true }, ['google']],
    [{ apple: true, google: false }, ['apple']],
    [{ apple: false, google: false }, []],
  ])('tắt từng cờ: %j', (flags, expected) => {
    expect(getEnabledSocialProviders(flags)).toEqual(expected);
  });
});
