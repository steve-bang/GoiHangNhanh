import { layout } from '@/core/theme';

/**
 * Tính bố cục màn Chào mừng (UI-A02): thuần TypeScript, không React/RN để dễ test.
 * Hai việc: (1) khoảng cách dọc theo chiều cao màn (thang `layout.space`), (2) hình học của hình minh
 * họa từ MỘT tham số kích thước để cả khối co giãn như một. Cỡ chữ không ở đây: màn dùng
 * `<Text variant="screenTitle">` cho mọi cỡ màn (D-20).
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

/** Màn hẹp hơn ngưỡng này (dp): tiêu đề gãy thêm dòng, ước tính phần ngoài hình khác (ví dụ 320x568). */
export const NARROW_WIDTH_BELOW = 340;

/**
 * Chiều cao (dp, fontScale 1, không gồm lề đáy) của mọi thứ ngoài hình minh họa: logo, chữ, nút, social,
 * dòng pháp lý, khoảng cách và đệm của ô hình. Đo trên bản render web (react-native-web, Chromium) với
 * tiêu đề cũ 30dp; tiêu đề nay là `screenTitle` (24/32) nên số dưới đây là cận trên (an toàn: hình chỉ
 * nhỏ đi, không đè nội dung). Cần đo lại trên thiết bị thật.
 */
const CHROME_REGULAR = 528;
const CHROME_COMPACT = 492;
/** Màn hẹp (tiêu đề 2 dòng) theo khoảng cách thường / thu gọn; +8 cho dòng `screenTitle` (32 thay 30) và ô logo `tile.lg` (52 thay 48). */
const CHROME_NARROW_REGULAR = 520;
const CHROME_NARROW_COMPACT = 484;

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
  narrow: boolean;
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
  const { space } = layout;
  const gaps = compact
    ? { top: space.md, section: space.lg }
    : { top: space.xl, section: space.xl };
  const bottomPad = Math.max(insetBottom, space.lg) + space.sm;
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
    narrow,
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
