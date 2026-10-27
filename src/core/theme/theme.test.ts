import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors } from './colors';
import { semantic } from './semantic';
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
    // Nhóm màn form/quy trình (nền trắng, khối xám nhạt, ô nhắc xanh nhạt).
    ['ink', 'formBackground'],
    ['inkMuted', 'formBackground'],
    ['brand', 'formBackground'],
    ['ink', 'surfaceMuted'],
    ['inkMuted', 'surfaceMuted'],
    ['onBrand', 'brand'],
    ['brand', 'infoSoft'],
    ['ink', 'infoSoft'],
    ['inkMuted', 'infoSoft'],
    ['inkMuted', 'brandSoft'],
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

describe('tương phản token ngữ nghĩa (WCAG AA)', () => {
  const { color, status } = semantic;
  it.each([
    ['text.primary/screen', color.text.primary, color.surface.screen],
    ['text.primary/raised', color.text.primary, color.surface.raised],
    ['text.primary/muted', color.text.primary, color.surface.muted],
    ['text.secondary/screen', color.text.secondary, color.surface.screen],
    ['text.secondary/raised', color.text.secondary, color.surface.raised],
    ['text.strong/raised', color.text.strong, color.surface.raised],
    ['text.subtle/raised', color.text.subtle, color.surface.raised],
    ['text.onAction/primary', color.text.onAction, color.action.primary],
    ['text.onAction/destructive', color.text.onAction, color.action.destructive],
    ['action.primary/screen', color.action.primary, color.surface.screen],
    ['action.primary/brandSoft', color.action.primary, color.brand.soft],
    ['text.primary/brandSoft', color.text.primary, color.brand.soft],
    ['text.primary/info', color.text.primary, color.feedback.info.bg],
    ['text.primary/dangerBg', color.text.primary, color.feedback.danger.bg],
    ['success', color.feedback.success.fg, color.feedback.success.bg],
    ['warning', color.feedback.warning.fg, color.feedback.warning.bg],
    ['danger', color.feedback.danger.fg, color.feedback.danger.bg],
    ['warning/screen', color.feedback.warning.fg, color.surface.screen],
    ['danger/screen', color.feedback.danger.fg, color.surface.screen],
    ['camera', color.camera.onCamera, color.camera.background],
    ...Object.entries(status).map(([k, v]) => [`status.${k}`, v.fg, v.bg] as const),
  ] as const)('%s', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('nhãn trạng thái bằng chứng (docs/09 mục 3)', () => {
  const entries = Object.entries(EVIDENCE_STATUS_PRESENTATION);

  it('có đúng 6 nhãn và mỗi nhãn có biểu tượng riêng (màu không là tín hiệu duy nhất)', () => {
    expect(entries).toHaveLength(6);
    expect(new Set(entries.map(([, p]) => p.icon)).size).toBe(6);
  });

  it('mỗi nhãn có khóa màu riêng trong semantic.status (không dùng chung)', () => {
    expect(new Set(entries.map(([, p]) => p.statusToken)).size).toBe(6);
    for (const [, p] of entries) expect(semantic.status[p.statusToken]).toBeDefined();
  });

  it('Đã tải lên và Đã xác minh cùng sắc xanh nhưng khác biểu tượng', () => {
    const { uploaded, verified } = EVIDENCE_STATUS_PRESENTATION;
    expect(semantic.status[uploaded.statusToken].fg).toBe(semantic.status[verified.statusToken].fg);
    expect(uploaded.icon).not.toBe(verified.icon);
  });

  it('Đã lưu trên máy không dùng màu thành công hay biểu tượng tick', () => {
    const p = EVIDENCE_STATUS_PRESENTATION.saved_on_device;
    expect(semantic.status[p.statusToken].fg).not.toBe(semantic.color.feedback.success.fg);
    expect(p.icon).not.toMatch(/check|done|tick/);
  });

  it('chỉ trạng thái lỗi dùng màu đỏ', () => {
    for (const [label, p] of entries) {
      const isRed = semantic.status[p.statusToken].fg === semantic.color.feedback.danger.fg;
      expect(isRed).toBe(label === 'error');
    }
  });
});

describe('typography', () => {
  it('chú thích >= 12pt, nội dung >= 15pt, tiêu đề màn 24-28pt', () => {
    expect(typography.caption.fontSize).toBeGreaterThanOrEqual(12);
    expect(typography.overlay.fontSize).toBeGreaterThanOrEqual(12); // mã đơn trên màn quay
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(typography.screenTitle.fontSize).toBeGreaterThanOrEqual(24);
    expect(typography.screenTitle.fontSize).toBeLessThanOrEqual(28);
  });

  // NGOẠI LỆ có ghi trong docs/09 mục 3: nhóm chữ form (theo mockup 03) nhỏ hơn mức nội dung chung.
  // Số ở đây phải bằng đúng số trong tài liệu; đổi một bên phải đổi bên kia.
  it('nhóm chữ form đúng bằng ngoại lệ đã ghi trong docs/09 mục 3 (không hạ ngầm)', () => {
    expect(typography.formLabel.fontSize).toBe(13);
    expect(typography.formBody.fontSize).toBe(14);
    expect(typography.formButton.fontSize).toBe(14);
    expect(typography.formButtonSmall.fontSize).toBe(13);
    const doc = readFileSync(join(__dirname, '../../../docs/09-ui-ux-design.md'), 'utf8');
    expect(doc).toContain('Ngoại lệ nhóm chữ form');
    for (const token of ['formLabel 13', 'formBody 14', 'formButton 14', 'formButtonSmall 13']) {
      expect(doc).toContain(token);
    }
    expect(doc).toContain('overlay 12');
  });

  it('vùng chạm tối thiểu 44pt iOS / 48dp Android', () => {
    expect(MIN_TOUCH_TARGET).toEqual({ ios: 44, android: 48 });
  });
});
