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

  describe('dữ liệu shop gắn với tài khoản chủ sở hữu (bất biến #8)', () => {
    const accountA = { uid: 'uA', email: 'a@x.co', emailVerified: false };
    const accountB = { uid: 'uB', email: 'b@x.co', emailVerified: false };
    const shopA = { id: 'sA', name: 'Shop A', sellingSources: ['shopee' as const] };
    const withShopA: Parameters<typeof onboardingReducer>[1][] = [
      { type: 'account_created', account: accountA },
      { type: 'shop_name_changed', name: 'Shop A' },
      { type: 'shop_created', shop: shopA },
    ];

    it('shop_created ghi nhận chủ sở hữu là tài khoản hiện tại', () => {
      const state = run(withShopA);
      expect(state.shop).toEqual(shopA);
      expect(state.shopOwnerUid).toBe('uA');
    });

    it('đổi sang tài khoản khác: xóa shop, tên shop, nguồn bán; chỉ giữ tài khoản mới', () => {
      const state = run([...withShopA, { type: 'account_created', account: accountB }]);
      expect(state.account).toEqual(accountB);
      expect(state.shop).toBeNull();
      expect(state.shopOwnerUid).toBeNull();
      expect(state.shopName).toBe('');
      expect(state.sources).toEqual([]);
    });

    it('cùng tài khoản (đăng nhập lại): giữ nguyên dữ liệu shop', () => {
      const state = run([...withShopA, { type: 'account_created', account: accountA }]);
      expect(state.shop).toEqual(shopA);
      expect(state.shopName).toBe('Shop A');
      expect(state.sources).toEqual(['shopee']);
    });

    it('shop do chủ khác để lại (kể cả khi chưa có tài khoản) bị xóa khi tài khoản được tạo', () => {
      const state = run([
        { type: 'shop_created', shop: shopA },
        { type: 'account_created', account: accountB },
      ]);
      expect(state.shop).toBeNull();
      expect(state.shopOwnerUid).toBeNull();
    });

    it('kết quả tạo shop của tài khoản cũ đến muộn khi đã sang tài khoản khác: bị bỏ qua', () => {
      const state = run([
        { type: 'account_created', account: accountA },
        { type: 'account_created', account: accountB },
        { type: 'shop_created', shop: shopA, ownerUid: 'uA' },
      ]);
      expect(state.shop).toBeNull();
      expect(state.sources).toEqual([]);
    });
  });
});
