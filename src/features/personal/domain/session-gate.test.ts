import { evaluateSessionGate, type SessionGateInput } from './session-gate';

const base: SessionGateInput = {
  strict: true,
  status: 'signed_out',
  shopId: null,
  hydration: 'pending',
};

describe('evaluateSessionGate', () => {
  it('cổng giả (không chặt) luôn mở, kể cả chưa đăng nhập và chưa biết shop', () => {
    for (const hydration of ['pending', 'failed', 'settled'] as const) {
      expect(evaluateSessionGate({ ...base, strict: false, hydration })).toBe('open');
    }
  });

  it('đã đăng nhập và biết shop: mở (không phụ thuộc trạng thái nạp)', () => {
    for (const hydration of ['pending', 'failed', 'settled'] as const) {
      expect(
        evaluateSessionGate({ ...base, status: 'signed_in', shopId: 'shop-a', hydration }),
      ).toBe('open');
    }
  });

  it('đã đăng nhập nhưng chưa có shop: về Tạo cửa hàng, không mở bằng shop tạm', () => {
    expect(evaluateSessionGate({ ...base, status: 'signed_in', hydration: 'settled' })).toBe(
      'no_shop',
    );
  });

  it('chưa đăng nhập: đang nạp / lỗi nạp / đã xác nhận', () => {
    expect(evaluateSessionGate({ ...base, hydration: 'pending' })).toBe('loading');
    expect(evaluateSessionGate({ ...base, hydration: 'failed' })).toBe('unreachable');
    expect(evaluateSessionGate({ ...base, hydration: 'settled' })).toBe('signed_out');
  });
});
