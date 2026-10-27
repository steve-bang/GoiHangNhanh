/**
 * Tính bố cục màn Chào mừng (UI-A02): thuần TypeScript, không React/RN để dễ test.
 * Hai việc: (1) cỡ + khoảng cách dọc theo chiều cao màn, (2) hình học của hình minh họa từ MỘT tham số
 * kích thước để cả khối co giãn như một.
 */

/** Khung thiết kế của hình minh họa (đơn vị thiết kế): rộng x cao. Rộng = vùng nội dung của iPhone 14. */
export const ILLUSTRATION_DESIGN_WIDTH = 342;
export const ILLUSTRATION_DESIGN_HEIGHT = 260;
/** Chiều cao tối đa của hình (màn lớn không vượt). */
export const ILLUSTRATION_MAX_HEIGHT = ILLUSTRATION_DESIGN_HEIGHT;
/** Dưới ngưỡng này hình không còn đủ chỗ nên ẩn. */
export const MIN_ILLUSTRATION_HEIGHT = 110;
/** Màn thấp hơn ngưỡng này (dp) dùng khoảng cách dọc thu gọn. Màn 390x844 trở lên giữ nguyên. */
export const COMPACT_HEIGHT_BELOW = 700;
/** Từ cỡ chữ hệ thống này trở lên: ẩn hình, để nội dung cuộn. */
export const HIDE_ILLUSTRATION_FONT_SCALE = 1.25;

/** Màn hẹp hơn ngưỡng này (dp) dùng tiêu đề nhỏ hơn để không gãy thành 4 dòng (ví dụ 320x568). */
export const NARROW_WIDTH_BELOW = 340;

/** Cỡ tiêu đề (dp): mặc định và màn hẹp. */
const TITLE_REGULAR = { fontSize: 30, lineHeight: 38 };
const TITLE_NARROW = { fontSize: 24, lineHeight: 30 };

/**
 * Chiều cao (dp, fontScale 1, không gồm lề đáy) của mọi thứ ngoài hình minh họa: logo, chữ, nút, social,
 * dòng pháp lý, khoảng cách và đệm của ô hình. Đo trên bản render web (react-native-web, Chromium).
 */
const CHROME_REGULAR = 528;
const CHROME_COMPACT = 492;
/** Màn hẹp (tiêu đề 24dp, 2 dòng) theo khoảng cách thường / thu gọn. */
const CHROME_NARROW_REGULAR = 512;
const CHROME_NARROW_COMPACT = 476;

export interface WelcomeLayoutInput {
  /** Chiều rộng cửa sổ. */
  width: number;
  /** Chiều cao cửa sổ. */
  height: number;
  insetTop: number;
  insetBottom: number;
  /** Cỡ chữ hệ thống (1 = mặc định). */
  fontScale: number;
}

export interface WelcomeLayout {
  compact: boolean;
  title: { fontSize: number; lineHeight: number };
  /** Khoảng cách dọc giữa các khối (dp). */
  gaps: { top: number; section: number };
  /** Chiều cao hình; 0 nghĩa là ẩn hình. */
  illustrationHeight: number;
  /** Chiều cao nội dung ước tính (không gồm phần hình dư) để so với chỗ khả dụng. */
  estimatedContentHeight: number;
  availableHeight: number;
  /** true khi ước tính nội dung không vừa: màn phải cuộn (ví dụ chữ hệ thống rất lớn). */
  scrollNeeded: boolean;
}

export function computeWelcomeLayout(input: WelcomeLayoutInput): WelcomeLayout {
  const { width, height, insetTop, insetBottom, fontScale } = input;
  const compact = height < COMPACT_HEIGHT_BELOW;
  const gaps = compact ? { top: 12, section: 16 } : { top: 24, section: 24 };
  const bottomPad = Math.max(insetBottom, 16) + 8;
  const availableHeight = height - insetTop - bottomPad;
  const scale = Math.max(1, fontScale);
  const narrow = width < NARROW_WIDTH_BELOW;
  const base = narrow
    ? compact
      ? CHROME_NARROW_COMPACT
      : CHROME_NARROW_REGULAR
    : compact
      ? CHROME_COMPACT
      : CHROME_REGULAR;
  const chrome = base * scale;
  const room = availableHeight - chrome;
  const fits = fontScale < HIDE_ILLUSTRATION_FONT_SCALE && room >= MIN_ILLUSTRATION_HEIGHT;
  const illustrationHeight = fits ? Math.min(ILLUSTRATION_MAX_HEIGHT, Math.floor(room)) : 0;
  const estimatedContentHeight = chrome + illustrationHeight;
  return {
    compact,
    title: narrow ? TITLE_NARROW : TITLE_REGULAR,
    gaps,
    illustrationHeight,
    estimatedContentHeight,
    availableHeight,
    scrollNeeded: estimatedContentHeight > availableHeight,
  };
}

export interface IllustrationGeometry {
  /** Khung chứa toàn bộ hình. */
  frame: { width: number; height: number };
  blob: { diameter: number };
  leafLeft: { left: number; bottom: number; size: number };
  leafRight: { right: number; bottom: number; size: number };
  boxLarge: { left: number; bottom: number; size: number };
  boxSmall: { left: number; bottom: number; size: number };
  shield: { right: number; top: number; size: number; checkSize: number };
}

/** Mọi kích thước và độ lệch đều = giá trị thiết kế x (height / 260): một tham số duy nhất. */
export function getIllustrationGeometry(height: number): IllustrationGeometry {
  const u = height / ILLUSTRATION_DESIGN_HEIGHT;
  return {
    frame: { width: ILLUSTRATION_DESIGN_WIDTH * u, height: ILLUSTRATION_DESIGN_HEIGHT * u },
    blob: { diameter: 230 * u },
    leafLeft: { left: 36 * u, bottom: 30 * u, size: 64 * u },
    leafRight: { right: 30 * u, bottom: 18 * u, size: 52 * u },
    boxLarge: { left: 58 * u, bottom: 22 * u, size: 92 * u },
    boxSmall: { left: 120 * u, bottom: 12 * u, size: 70 * u },
    shield: { right: 52 * u, top: 18 * u, size: 128 * u, checkSize: 64 * u },
  };
}
