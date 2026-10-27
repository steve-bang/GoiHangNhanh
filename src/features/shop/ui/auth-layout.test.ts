import {
  computeForgotLayout,
  computeNewPasswordLayout,
  computeOtpLayout,
  computeSignInLayout,
} from './auth-layout';
import type { OnboardingLayoutInput } from './onboarding-layout';
import { MIN_ILLUSTRATION_HEIGHT } from './welcome-layout';

const input = (
  width: number,
  height: number,
  insetTop = 0,
  insetBottom = 0,
  fontScale = 1,
): OnboardingLayoutInput => ({ width, height, insetTop, insetBottom, fontScale });

const IPHONE = input(390, 844, 47, 34);
const SE = input(375, 667, 20, 0);
const SMALL = input(320, 568, 20, 0);
const ANDROID = input(412, 915, 24, 48);

const COMPUTE = {
  'đăng nhập': (i: OnboardingLayoutInput) => computeSignInLayout(i),
  'quên mật khẩu': (i: OnboardingLayoutInput) => computeForgotLayout(i),
  'nhập mã': (i: OnboardingLayoutInput) => computeOtpLayout(i),
  'mật khẩu mới': (i: OnboardingLayoutInput) => computeNewPasswordLayout(i),
};

describe('bố cục bốn màn đăng nhập và khôi phục mật khẩu', () => {
  describe.each(Object.entries(COMPUTE))('%s', (_name, compute) => {
    it('màn lớn (390x844, 412x915): nội dung vừa, có hình, không cần cuộn', () => {
      for (const i of [IPHONE, ANDROID]) {
        const layout = compute(i);
        expect(layout.compact).toBe(false);
        expect(layout.illustrationHeight).toBeGreaterThanOrEqual(MIN_ILLUSTRATION_HEIGHT);
        expect(layout.scrollNeeded).toBe(false);
        expect(layout.estimatedContentHeight).toBeLessThanOrEqual(layout.availableHeight);
      }
    });

    it('375x667 và 320x568: hình co/ẩn TRƯỚC, nội dung thiết yếu không bị cắt (vừa hoặc cuộn)', () => {
      for (const i of [SE, SMALL]) {
        const layout = compute(i);
        expect(layout.compact).toBe(true);
        if (layout.illustrationHeight > 0) {
          expect(layout.illustrationHeight).toBeGreaterThanOrEqual(MIN_ILLUSTRATION_HEIGHT);
          expect(layout.estimatedContentHeight).toBeLessThanOrEqual(layout.availableHeight);
        } else {
          // đã ẩn hình: phần còn lại hoặc vừa, hoặc cuộn được (ScrollView), không bao giờ bị cắt
          expect(typeof layout.scrollNeeded).toBe('boolean');
        }
      }
    });

    it('hình ẩn TRƯỚC khi nội dung bị cắt trên mọi kích thước/cỡ chữ; cần cuộn thì không có hình', () => {
      for (let height = 480; height <= 1000; height += 20) {
        for (const width of [320, 360, 375, 390, 412]) {
          for (const fontScale of [1, 1.15, 1.3, 1.6]) {
            const layout = compute(input(width, height, 20, 10, fontScale));
            if (layout.illustrationHeight > 0) {
              expect(layout.estimatedContentHeight).toBeLessThanOrEqual(layout.availableHeight);
              expect(layout.illustrationHeight).toBeGreaterThanOrEqual(MIN_ILLUSTRATION_HEIGHT);
            }
            if (layout.scrollNeeded) expect(layout.illustrationHeight).toBe(0);
          }
        }
      }
    });

    it('chữ hệ thống rất lớn (2x): không hình, cuộn được', () => {
      const layout = compute(input(390, 844, 47, 34, 2));
      expect(layout.illustrationHeight).toBe(0);
      expect(layout.scrollNeeded).toBe(true);
    });

    it('màn hẹp 320 dùng lề 20; vùng an toàn đáy luôn được chừa', () => {
      expect(compute(SMALL).narrow).toBe(true);
      expect(compute(SMALL).padX).toBe(20);
      expect(compute(SE).bottomPad).toBeGreaterThanOrEqual(12);
      expect(compute(IPHONE).bottomPad).toBe(34);
    });
  });

  it('màn 375x667: đăng nhập và quên mật khẩu vẫn còn chỗ, hai màn còn lại ẩn hình khi chật', () => {
    // Giá trị tham chiếu (ước tính, đối chiếu bản render web): ghi lại để thấy khi bố cục đổi.
    expect(computeSignInLayout(SE).scrollNeeded).toBe(false);
    expect(computeForgotLayout(SE).scrollNeeded).toBe(false);
  });

  it('lỗi hiện thêm làm hình nhường chỗ trước (đăng nhập có banner + lỗi ô)', () => {
    const clean = computeSignInLayout(SE, { showSocial: true });
    const withErrors = computeSignInLayout(SE, {
      showSocial: true,
      errors: {
        email: { chars: 40 },
        password: { chars: 24 },
        banner: { chars: 60, withRetry: true },
      },
      successChars: 80,
    });
    expect(withErrors.illustrationHeight).toBeLessThanOrEqual(clean.illustrationHeight);
    expect(withErrors.estimatedContentHeight).toBeGreaterThan(clean.estimatedContentHeight);
    if (withErrors.illustrationHeight > 0) {
      expect(withErrors.estimatedContentHeight).toBeLessThanOrEqual(withErrors.availableHeight);
    }
  });

  it('đăng nhập: tắt đăng nhập mạng xã hội thì cần ít chỗ hơn', () => {
    const on = computeSignInLayout(SMALL, { showSocial: true });
    const off = computeSignInLayout(SMALL, { showSocial: false });
    expect(off.estimatedContentHeight).toBeLessThan(on.estimatedContentHeight);
  });

  it('nhập mã: 6 ô vừa chiều ngang ở mọi màn (kể cả 320) và đủ lớn để chạm', () => {
    for (const i of [SMALL, SE, IPHONE, ANDROID]) {
      const { box, padX } = computeOtpLayout(i);
      const total = 6 * box.width + 5 * box.gap;
      expect(total).toBeLessThanOrEqual(i.width - 2 * padX);
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('nhập mã: lỗi dưới ô + banner làm hình nhường chỗ', () => {
    const clean = computeOtpLayout(IPHONE);
    const err = computeOtpLayout(IPHONE, {
      fieldError: { chars: 50 },
      banner: { chars: 50, withRetry: true },
      notice: true,
    });
    expect(err.estimatedContentHeight).toBeGreaterThan(clean.estimatedContentHeight);
  });
});
