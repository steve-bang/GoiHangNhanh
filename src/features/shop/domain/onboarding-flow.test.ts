import {
  INITIAL_ONBOARDING_STATE,
  onboardingReducer,
  type OnboardingState,
} from './onboarding-flow';

const run = (actions: Parameters<typeof onboardingReducer>[1][]): OnboardingState =>
  actions.reduce(onboardingReducer, INITIAL_ONBOARDING_STATE);

describe('trạng thái luồng thiết lập', () => {
  it('giữ email, tên shop và nguồn bán đã nhập', () => {
    const state = run([
      { type: 'email_changed', email: 'a@b.co' },
      { type: 'shop_name_changed', name: 'Shop Minh Anh' },
      { type: 'source_toggled', source: 'tiktok_shop' },
      { type: 'source_toggled', source: 'shopee' },
    ]);
    expect(state.email).toBe('a@b.co');
    expect(state.shopName).toBe('Shop Minh Anh');
    expect(state.sources).toEqual(['shopee', 'tiktok_shop']);
  });

  it('chặn tên shop quá 50 ký tự', () => {
    const state = run([{ type: 'shop_name_changed', name: 'x'.repeat(80) }]);
    expect(Array.from(state.shopName)).toHaveLength(50);
  });

  it('xóa lựa chọn nguồn bán nhưng giữ tên shop', () => {
    const state = run([
      { type: 'shop_name_changed', name: 'Shop' },
      { type: 'source_toggled', source: 'lazada' },
      { type: 'sources_cleared' },
    ]);
    expect(state.sources).toEqual([]);
    expect(state.shopName).toBe('Shop');
  });

  it('không có mật khẩu trong trạng thái; tài khoản/shop chỉ có sau khi cổng xác nhận', () => {
    expect(Object.keys(INITIAL_ONBOARDING_STATE)).not.toContain('password');
    expect(INITIAL_ONBOARDING_STATE.account).toBeNull();
    expect(INITIAL_ONBOARDING_STATE.shop).toBeNull();
    const state = run([
      {
        type: 'account_created',
        account: { uid: 'u1', email: 'a@b.co', emailVerified: false },
      },
    ]);
    expect(state.account?.emailVerified).toBe(false);
  });

  it('reset đưa về trạng thái ban đầu', () => {
    expect(run([{ type: 'email_changed', email: 'x@y.z' }, { type: 'reset' }])).toEqual(
      INITIAL_ONBOARDING_STATE,
    );
  });
});
