import {
  computeCreateShopLayout,
  computeSetupDoneLayout,
  computeSignUpLayout,
  getSetupDoneGeometry,
  getShieldClipboardGeometry,
  SETUP_ILLUSTRATION_MAX_HEIGHT,
  type OnboardingLayoutInput,
} from './onboarding-layout';
import { MIN_ILLUSTRATION_HEIGHT } from './welcome-layout';
import { getStepSegments, ONBOARDING_TOTAL_STEPS } from './onboarding-progress';

const input = (
  width: number,
  height: number,
  insetTop = 0,
  insetBottom = 0,
  fontScale = 1,
): OnboardingLayoutInput => ({ width, height, insetTop, insetBottom, fontScale });

/** iPhone 14 (có tai thỏ), iPhone SE (không tai thỏ, 375x667), máy nhỏ 320x568, Android lớn. */
const IPHONE = input(390, 844, 47, 34);
const SE = input(375, 667, 20, 0);
const SMALL = input(320, 568, 20, 0);
const ANDROID = input(412, 915, 24, 48);

const COMPUTE = {
  'đăng ký': (i: OnboardingLayoutInput) => computeSignUpLayout(i),
  'tạo shop': (i: OnboardingLayoutInput) => computeCreateShopLayout(i),
  'hoàn tất': (i: OnboardingLayoutInput) => computeSetupDoneLayout(i),
};

describe('bố cục ba màn thiết lập', () => {
  describe.each(Object.entries(COMPUTE))('%s', (_name, compute) => {
    it('màn lớn (390x844, 412x915): nội dung vừa, không cần cuộn', () => {
      for (const i of [IPHONE, ANDROID]) {
        const layout = compute(i);
        expect(layout.compact).toBe(false);
        expect(layout.scrollNeeded).toBe(false);
        expect(layout.estimatedContentHeight).toBeLessThanOrEqual(layout.availableHeight);
      }
    });

    it('hình minh họa ẩn TRƯỚC khi nội dung bị cắt: còn hình thì nội dung vẫn vừa; cần cuộn thì không có hình', () => {
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

    it('chữ hệ thống rất lớn (2x): không hình, nội dung cuộn được', () => {
      const layout = compute(input(390, 844, 47, 34, 2));
      expect(layout.illustrationHeight).toBe(0);
      expect(layout.scrollNeeded).toBe(true);
    });

    it('màn hẹp 320 dùng lề 20; màn thấp 375x667 và 320x568 dùng khoảng cách thu gọn', () => {
      expect(compute(SMALL).narrow).toBe(true);
      expect(compute(SMALL).padX).toBe(20);
      expect(compute(SE).narrow).toBe(false);
      expect(compute(SE).compact).toBe(true);
      expect(compute(SMALL).compact).toBe(true);
    });

    it('vùng an toàn đáy luôn được chừa', () => {
      expect(compute(SE).bottomPad).toBeGreaterThanOrEqual(12);
      expect(compute(IPHONE).bottomPad).toBe(34);
    });
  });

  describe('đăng ký (UI-A03)', () => {
    it('390x844 có hình; 375x667 và 320x568 ẩn hình nhưng vẫn không cần cuộn', () => {
      expect(computeSignUpLayout(IPHONE).illustrationHeight).toBeGreaterThanOrEqual(110);
      for (const i of [SE, SMALL]) {
        const layout = computeSignUpLayout(i);
        expect(layout.illustrationHeight).toBe(0);
        expect(layout.scrollNeeded).toBe(false);
      }
    });

    it('cờ social tắt: bớt đường kẻ và hàng nút nên nội dung thấp hơn', () => {
      const withSocial = computeSignUpLayout(IPHONE, { showSocial: true });
      const without = computeSignUpLayout(IPHONE, { showSocial: false });
      expect(without.estimatedContentHeight).toBeLessThan(withSocial.estimatedContentHeight);
    });

    it('màn hẹp dùng tiêu đề nhỏ hơn', () => {
      expect(computeSignUpLayout(SMALL).title.fontSize).toBeLessThan(
        computeSignUpLayout(IPHONE).title.fontSize,
      );
    });
  });

  describe('tạo hồ sơ shop (UI-A04)', () => {
    it('không có hình minh họa; 375x667 và 320x568 cuộn được (nút chính ở cuối nội dung)', () => {
      for (const i of [IPHONE, SE, SMALL]) {
        expect(computeCreateShopLayout(i).illustrationHeight).toBe(0);
      }
      expect(computeCreateShopLayout(SE).scrollNeeded).toBe(true);
      expect(computeCreateShopLayout(SMALL).scrollNeeded).toBe(true);
    });

    it('thẻ nguồn bán luôn đủ vùng chạm 48dp', () => {
      for (const i of [IPHONE, SE, SMALL]) {
        expect(computeCreateShopLayout(i).cardHeight).toBeGreaterThanOrEqual(48);
      }
    });
  });

  describe('hoàn tất (UI-A06)', () => {
    it('390x844 hình đủ lớn; 375x667 vẫn có hình; 320x568 ẩn hình', () => {
      expect(computeSetupDoneLayout(IPHONE).illustrationHeight).toBe(SETUP_ILLUSTRATION_MAX_HEIGHT);
      expect(computeSetupDoneLayout(SE).illustrationHeight).toBeGreaterThanOrEqual(110);
      expect(computeSetupDoneLayout(SMALL).illustrationHeight).toBe(0);
    });
  });
});

describe('hình học hình minh họa', () => {
  it('khung hình tỉ lệ theo một tham số chiều cao', () => {
    const a = getSetupDoneGeometry(230);
    const b = getSetupDoneGeometry(115);
    expect(b.frame.width).toBeCloseTo(a.frame.width / 2);
    expect(b.shield.size).toBeCloseTo(a.shield.size / 2);
    expect(a.confetti.length).toBeGreaterThan(0);
    const c = getShieldClipboardGeometry(150);
    expect(getShieldClipboardGeometry(75).frame.width).toBeCloseTo(c.frame.width / 2);
  });

  it('hình hoàn tất vừa chiều ngang vùng nội dung của iPhone 14 (342dp) ở cỡ tối đa', () => {
    expect(getSetupDoneGeometry(SETUP_ILLUSTRATION_MAX_HEIGHT).frame.width).toBeLessThanOrEqual(
      342,
    );
  });
});

describe('thanh tiến trình đếm theo luồng thật (3 bước)', () => {
  it('có 3 đoạn; ở bước 2: bước 1 xong, bước 2 đang làm, bước 3 chưa tới', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(3);
    expect(getStepSegments(2)).toEqual(['done', 'current', 'todo']);
    expect(getStepSegments(1)).toEqual(['current', 'todo', 'todo']);
    expect(getStepSegments(3)).toEqual(['done', 'done', 'current']);
    expect(getStepSegments(2)).toHaveLength(3);
  });
});
