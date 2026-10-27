import { colors } from './colors';
import { EVIDENCE_STATUS_PRESENTATION } from './evidence-status';
import { MIN_TOUCH_TARGET, typography } from './typography';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('tương phản màu (WCAG AA 4.5:1 cho chữ thường)', () => {
  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['textMuted', 'background'],
    ['brand', 'background'],
    ['onBrand', 'brand'],
    ['onSuccess', 'success'],
    ['onDanger', 'danger'],
    ['success', 'background'],
    ['warning', 'background'],
    ['danger', 'background'],
    ['text', 'brandSoft'],
    ['brand', 'brandSoft'],
    ['success', 'successSoft'],
    ['warning', 'warningSoft'],
    ['danger', 'dangerSoft'],
    ['onCamera', 'cameraBackground'],
    ['brandDark', 'welcomeBackground'],
    ['text', 'welcomeBackground'],
    ['textMuted', 'welcomeBackground'],
    ['textMuted', 'welcomeBlob'],
    ['brand', 'welcomeBackground'],
    ['brand', 'surface'],
    ['ink', 'onboardingBackground'],
    ['ink', 'surface'],
    ['inkMuted', 'onboardingBackground'],
    ['inkMuted', 'surface'],
    ['brand', 'onboardingBackground'],
    ['danger', 'onboardingBackground'],
    ['danger', 'dangerSoft'],
    ['onBrand', 'brand'],
    // Thông báo lỗi dễ đọc: chữ tối trên nền hồng nhạt, nút/liên kết xanh, biểu tượng + viền đỏ.
    ['ink', 'dangerSoft'],
    ['brand', 'dangerSoft'],
    ['danger', 'surface'],
    // Màn Splash: chữ trắng trên sóng (cả hai đầu của dải màu) và chữ xanh trên nền Splash.
    ['onSplashWave', 'splashWave'],
    ['onSplashWave', 'splashWaveDeep'],
    ['splashWordmark', 'splashBackground'],
    ['splashTagline', 'splashBackground'],
    ['splashFeatureLabel', 'splashBackground'],
    ['splashFeatureLabel', 'splashFeatureDisc'],
    ['splashFeatureIcon', 'splashFeatureDisc'],
  ] as const)('%s trên %s', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('nhãn trạng thái bằng chứng (docs/09 mục 3)', () => {
  const entries = Object.entries(EVIDENCE_STATUS_PRESENTATION);

  it('có đúng 6 nhãn và mỗi nhãn có biểu tượng riêng (màu không là tín hiệu duy nhất)', () => {
    expect(entries).toHaveLength(6);
    expect(new Set(entries.map(([, p]) => p.icon)).size).toBe(6);
  });

  it('Đã tải lên và Đã xác minh cùng sắc xanh nhưng khác biểu tượng', () => {
    const { uploaded, verified } = EVIDENCE_STATUS_PRESENTATION;
    expect(uploaded.colorRole).toBe(verified.colorRole);
    expect(uploaded.icon).not.toBe(verified.icon);
  });

  it('Đã lưu trên máy không dùng màu thành công hay biểu tượng tick', () => {
    const p = EVIDENCE_STATUS_PRESENTATION.saved_on_device;
    expect(p.colorRole).not.toBe('success');
    expect(p.icon).not.toMatch(/check|done|tick/);
  });

  it('chỉ trạng thái lỗi dùng màu đỏ', () => {
    for (const [label, p] of entries) {
      expect(p.colorRole === 'danger').toBe(label === 'error');
    }
  });
});

describe('typography', () => {
  it('chú thích >= 12pt, nội dung >= 15pt, tiêu đề màn 24-28pt', () => {
    expect(typography.caption.fontSize).toBeGreaterThanOrEqual(12);
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(typography.screenTitle.fontSize).toBeGreaterThanOrEqual(24);
    expect(typography.screenTitle.fontSize).toBeLessThanOrEqual(28);
  });

  it('vùng chạm tối thiểu 44pt iOS / 48dp Android', () => {
    expect(MIN_TOUCH_TARGET).toEqual({ ios: 44, android: 48 });
  });
});
