import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appColors } from './app-colors';
import { colors } from './colors';
import { components } from './components';
import { palette } from './primitives';
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
    ['action.primary/raised', color.action.primary, color.surface.raised],
    ['action.link/screen', color.action.link, color.surface.screen],
    ['action.link/raised', color.action.link, color.surface.raised],
    ['action.link/brandSoft', color.action.link, color.brand.soft],
    ['brand.onSoft/softStrong', color.brand.onSoft, color.brand.softStrong],
    ['text.secondary/brandSoft', color.text.secondary, color.brand.soft],
    ['text.secondary/muted', color.text.secondary, color.surface.muted],
    ['text.primary/softStrong', color.text.primary, color.brand.softStrong],
    ['info', color.feedback.info.fg, color.feedback.info.bg],
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

/** Trộn màu rgba (alpha) lên nền hex đặc để đo tương phản thật khi chữ mờ nằm trên nền đậm. */
function over(rgba: string, hexBackground: string): string {
  const m = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(rgba);
  if (!m) throw new Error(`không phải rgba: ${rgba}`);
  const n = parseInt(hexBackground.slice(1), 16);
  const bg = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const alpha = Number(m[4]);
  const mixed = [m[1], m[2], m[3]].map((v, i) =>
    Math.round(alpha * Number(v) + (1 - alpha) * (bg[i] as number)),
  );
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('token mới của đợt nâng cấp tab Cá nhân (PR-A, Q-21g)', () => {
  const { color } = semantic;

  it('primitive xanh dương và tham chiếu tầng 2 trỏ đúng primitive', () => {
    expect(palette.blue).toEqual({ 50: '#E8F0FA', 700: '#1F5EA8' });
    expect(color.accent.blue.fg).toBe(palette.blue[700]);
    expect(color.accent.blue.bg).toBe(palette.blue[50]);
    expect(color.text.onBrandMuted).toBe(palette.alpha.white75);
  });

  it('token thành phần mới có đúng giá trị', () => {
    expect(components.progress.height).toBe(6);
    expect(components.checkbox.size).toBe(24);
    expect(components.field.multilineMinHeight).toBe(120);
    // ô nhiều dòng phải cao hơn ô một dòng
    expect(components.field.multilineMinHeight).toBeGreaterThan(components.field.minHeight);
  });

  it('chữ trên nền xanh dương và trên thẻ hero đạt 4.5:1', () => {
    expect(contrast(color.accent.blue.fg, color.accent.blue.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.accent.blue.fg, color.surface.raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.text.onAction, color.brand.deep)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(over(color.text.onBrandMuted, color.brand.deep), color.brand.deep),
    ).toBeGreaterThanOrEqual(4.5);
  });

  // Biểu tượng/tông ô icon (IconTile) và mô tả trong thẻ trạng thái (StatusCard) nằm trên nền thẻ trắng.
  it.each([
    ['brand', color.brand.onSoft, color.brand.soft],
    ['blue', color.accent.blue.fg, color.accent.blue.bg],
    ['warning', color.feedback.warning.fg, color.feedback.warning.bg],
    ['success', color.feedback.success.fg, color.feedback.success.bg],
    ['danger', color.feedback.danger.fg, color.feedback.danger.bg],
    ['neutral', color.text.secondary, color.surface.muted],
  ] as const)('tông ô icon %s: biểu tượng >= 3:1, chữ >= 4.5:1', (_tone, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(semantic.status))(
    'mô tả trạng thái %s trên thẻ trắng đạt 4.5:1',
    (_name, v) => {
      expect(contrast(v.fg, color.surface.raised)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('thanh tiến độ (vạch uploading trên nền border.field) nhìn thấy được >= 3:1 với nền thẻ', () => {
    expect(contrast(semantic.status.uploading.fg, color.border.field)).toBeGreaterThanOrEqual(3);
  });

  it('viền hộp kiểm chưa chọn (text.secondary) và viền lỗi đạt 3:1 trên nền thẻ (WCAG 1.4.11)', () => {
    // `border.default` chỉ ~1.5:1 nên KHÔNG dùng cho ranh giới hộp kiểm.
    expect(contrast(color.text.secondary, color.surface.raised)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.feedback.danger.fg, color.surface.raised)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.border.default, color.surface.raised)).toBeLessThan(3);
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

describe('token mở rộng của đợt nâng cấp design system v2', () => {
  const { color, status } = semantic;

  it.each([
    ['text.tertiary/screen', color.text.tertiary, color.surface.screen],
    ['text.tertiary/raised', color.text.tertiary, color.surface.raised],
    ['text.tertiary/muted', color.text.tertiary, color.surface.muted],
    ['text.onAction/primaryPressed', color.text.onAction, color.action.primaryPressed],
  ] as const)('chữ %s đạt 4.5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('ranh giới điều khiển border.strong đạt 3:1 trên nền thẻ; border.subtle chỉ để phân nhóm', () => {
    expect(contrast(color.border.strong, color.surface.raised)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.border.subtle, color.surface.raised)).toBeLessThan(3);
  });

  it('nhấn nút chính đậm hơn trạng thái thường; thứ bậc chữ secondary >= tertiary > disabled', () => {
    expect(luminance(color.action.primaryPressed)).toBeLessThan(luminance(color.action.primary));
    const onRaised = (fg: string) => contrast(fg, color.surface.raised);
    expect(onRaised(color.text.secondary)).toBeGreaterThanOrEqual(onRaised(color.text.tertiary));
    expect(onRaised(color.text.tertiary)).toBeGreaterThan(onRaised(color.text.disabled));
  });

  it('trạng thái vận hành có bộ token riêng, đủ tương phản trên nền của chính nó', () => {
    const keys = [
      'recording',
      'interrupted',
      'retrying',
      'offline',
      'syncPending',
      'synced',
    ] as const;
    for (const key of keys) {
      expect(status[key]).toBeDefined();
      expect(contrast(status[key].fg, status[key].bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('chỉ lỗi và đang ghi hình (ngoại lệ D-18) dùng sắc đỏ; mất mạng/gián đoạn không dùng đỏ', () => {
    const red = color.feedback.danger.fg;
    const reds = Object.entries(status)
      .filter(([, v]) => v.fg === red)
      .map(([k]) => k)
      .sort();
    expect(reds).toEqual(['error', 'recording']);
  });

  it('thang cỡ biểu tượng tăng dần và số liệu dùng chữ số cùng bề rộng', () => {
    const sizes = Object.values(semantic.icon);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(typography.numeric.fontVariant).toContain('tabular-nums');
    expect(typography.cardTitle.fontSize).toBeGreaterThan(typography.body.fontSize);
  });
});

describe('Bright Orange (v3)', () => {
  const { color, status } = semantic;

  it('giá trị nhận diện đúng palette được duyệt', () => {
    expect(color.brand.primary).toBe('#EE4D2D');
    expect(color.brand.hover).toBe('#FF6A45');
    expect(color.brand.pressed).toBe('#D93B20');
    expect(color.brand.soft).toBe('#FFF1EC');
    expect(color.brand.softStrong).toBe('#FCE5DE');
    expect(color.surface.screen).toBe('#FFFAF7');
    expect(color.surface.raised).toBe('#FFFFFF');
    expect(color.surface.muted).toBe('#FFF5F0');
    expect(color.text.primary).toBe('#292524');
    expect(color.border.default).toBe('#F0E4DE');
    expect(color.feedback.success.fg).toBe('#15803D');
    expect(color.feedback.warning.fg).toBe('#B45309');
    expect(color.feedback.danger.fg).toBe('#B91C1C');
    expect(color.feedback.info.fg).toBe('#0369A1');
  });

  it('chữ trắng trên nền cam: nền nút/thẻ chính đạt 4.5:1; màu nhận diện sáng chỉ cho đồ họa (>= 3:1)', () => {
    expect(contrast(color.text.onAction, color.action.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.text.onAction, color.action.primaryPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.text.onAction, color.brand.deep)).toBeGreaterThanOrEqual(4.5);
    // Trắng trên #EE4D2D chỉ ~3.66:1: KHÔNG được dùng làm nền chữ cỡ thường.
    expect(contrast(color.text.onAction, color.brand.primary)).toBeLessThan(4.5);
    expect(contrast(color.brand.primary, color.surface.raised)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.text.onAction, color.brand.primary)).toBeGreaterThanOrEqual(3);
  });

  it('màu thương hiệu không bị dùng làm màu trạng thái nghiệp vụ', () => {
    const brand = new Set<string>([
      color.brand.primary,
      color.brand.hover,
      color.brand.pressed,
      color.brand.soft,
      color.brand.softStrong,
      color.action.primary,
      color.action.link,
    ]);
    for (const [name, v] of Object.entries(status)) {
      expect(brand.has(v.fg)).toBe(false);
      expect(brand.has(v.bg)).toBe(false);
      expect(name).toBeTruthy();
    }
  });

  it('trạng thái dùng đúng sắc: thành công xanh lá, đang tải xanh dương, chờ/cảnh báo vàng cam, lỗi đỏ', () => {
    expect(status.verified.fg).toBe(color.feedback.success.fg);
    expect(status.uploaded.fg).toBe(color.feedback.success.fg);
    expect(status.uploading.fg).toBe(color.feedback.info.fg);
    expect(status.waitingUpload.fg).toBe(color.feedback.warning.fg);
    expect(status.error.fg).toBe(color.feedback.danger.fg);
  });

  it('bảng phẳng của màn trong app (appColors) khớp token ngữ nghĩa, bảng cũ đóng băng không đổi', () => {
    expect(appColors.brand).toBe(color.action.primary);
    expect(appColors.background).toBe(color.surface.screen);
    expect(appColors.text).toBe(color.text.primary);
    expect(colors.brand).toBe(palette.jade[700]);
    expect(Object.keys(appColors).sort()).toEqual(Object.keys(colors).sort());
  });
});
