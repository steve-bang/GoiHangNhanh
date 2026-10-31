import { semantic } from '@/core/theme';

/**
 * Bố cục màn Splash (UI-A01): thuần TypeScript, không React/RN để dễ test.
 *
 * Cấu trúc dọc (từ trên xuống): vùng an toàn + khối đầu (khiên, tên, khẩu hiệu, hàng tính năng) neo
 * trên; ảnh minh họa ngay trên sóng; sóng + câu viết tay neo dưới (cộng vùng an toàn dưới). Ảnh luôn
 * rộng bằng màn (ảnh bị cắt sát mép như thiết kế) vì thu nhỏ hơn thì mép laptop bị cắt giữa màn.
 *
 * Màn thấp: ẩn dần theo thứ tự câu viết tay -> hàng 4 tính năng -> khẩu hiệu -> thu nhỏ ảnh. Khiên
 * và tên LUÔN hiện. Chữ hệ thống lớn (fontScale >= 1,25): ẩn hàng tính năng và khẩu hiệu. Màn cao
 * hơn thiết kế (2:3): phần dư chia vào khoảng cách (có giới hạn trên) rồi cho ảnh lớn thêm chút.
 *
 * Cỡ chữ KHÔNG tính ở đây: màn dùng `<Text variant>` cố định (`SPLASH_TEXT_VARIANTS`); hàm chỉ đọc
 * `lineHeight` của các variant đó để ước tính chiều cao. Khoảng cách lấy từ thang `semantic.space`.
 */

/** Kích thước ảnh minh họa sau khi cắt biên trong suốt (assets/images/splash/splash-hero.webp). */
// token-exception: kích thước điểm ảnh của tệp ảnh minh họa, không phải giá trị thiết kế
export const HERO_IMAGE = { width: 1024, height: 1050 } as const;
const HERO_ASPECT = HERO_IMAGE.height / HERO_IMAGE.width;
/** Ảnh nhỏ hơn mức này (so với chiều rộng màn) thì ẩn hẳn. */
export const HERO_MIN_SCALE = 0.6;
/** Ảnh lớn thêm tối đa mức này khi còn dư chỗ (lớn hơn thì bong bóng sát mép bị cắt; ảnh có chừng 1% lề). */
export const HERO_MAX_SCALE = 1.02;

/** Màn hẹp hơn ngưỡng này (dp) dùng khoảng cách và hình nhỏ hơn. */
export const NARROW_WIDTH_BELOW = 340;
/** Từ cỡ chữ hệ thống này trở lên: ẩn hàng tính năng và khẩu hiệu. */
export const HIDE_DETAILS_FONT_SCALE = 1.25;

/** Giới hạn phóng chữ theo `maxFontSizeMultiplier` (không khóa `allowFontScaling`). */
export const FONT_CAPS = { wordmark: 1.2, tagline: 1.3, feature: 1.3, slogan: 1.3 } as const;

/**
 * Variant chữ của từng khối (`Text variant`). Nhãn tính năng dùng `caption` (12dp, không co theo
 * ảnh). Câu viết tay dùng `sectionTitle` với trọng số thường (màn đặt `fontWeight.regular`).
 */
export const SPLASH_TEXT_VARIANTS = {
  wordmark: 'screenTitle',
  tagline: 'cardTitle',
  feature: 'caption',
  slogan: 'sectionTitle',
} as const;
const lineHeightOf = (key: keyof typeof SPLASH_TEXT_VARIANTS) =>
  semantic.type[SPLASH_TEXT_VARIANTS[key]].lineHeight;
const { space } = semantic;

/** Đường cong sóng vẽ trong khung 1024 x 130 (đơn vị thiết kế); sóng đậm sâu nhất khoảng y = 118. */
// token-exception: khung toạ độ của đường cong SVG, không phải kích thước hiển thị
export const WAVE_VIEWBOX = { width: 1024, height: 130 } as const;
const WAVE_DEEPEST_TOP = 100; // chỗ sóng đậm sâu nhất ở phần giữa, nơi mép bàn chạm sóng
/** Ảnh phủ xuống dưới đỉnh sóng sâu nhất (dp) để sóng che mép dưới ảnh. */
const HERO_OVERLAP = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cap = (fontScale: number, max: number) => clamp(fontScale, 1, max);

export interface SplashLayoutInput {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  /** Cỡ chữ hệ thống (1 = mặc định). */
  fontScale: number;
}

export interface SplashLayout {
  showSlogan: boolean;
  showFeatures: boolean;
  showTagline: boolean;
  /** false: không đủ chỗ cho ảnh (ảnh nhỏ hơn `HERO_MIN_SCALE`). */
  showHero: boolean;
  header: {
    paddingTop: number;
    shield: { width: number; height: number };
    feature: { disc: number; gap: number; lineHeight: number };
    gaps: { shieldWordmark: number; wordmarkTagline: number; taglineFeatures: number };
    /** Mép dưới của khối đầu so với đỉnh màn (dp, ước tính theo cỡ chữ đã giới hạn). */
    bottom: number;
  };
  hero: {
    width: number;
    height: number;
    /** Chiều rộng ảnh / chiều rộng màn (1 = vừa khít; < 1: cần làm mờ hai mép). */
    scale: number;
    /** Khoảng cách từ đáy ảnh tới đáy màn. */
    bottomOffset: number;
    /** Mép trên của ảnh so với đỉnh màn. */
    top: number;
  };
  wave: {
    height: number;
    /** Chiều cao phần đường cong (trên cùng) của sóng. */
    contourHeight: number;
    slogan: { top: number };
  };
  /** true khi mọi khối vừa chiều cao màn (khối đầu không đè lên ảnh hoặc sóng). */
  fits: boolean;
}

type GapKey = 'paddingTop' | 'shieldWordmark' | 'wordmarkTagline' | 'taglineFeatures' | 'headHero';

interface Visibility {
  slogan: boolean;
  features: boolean;
  tagline: boolean;
}

export function computeSplashLayout(input: SplashLayoutInput): SplashLayout {
  const { width, height, insetTop, insetBottom, fontScale } = input;
  const narrow = width < NARROW_WIDTH_BELOW;
  const k = width / WAVE_VIEWBOX.width;

  const shieldWidth = clamp(Math.round(width * 0.145), 42, 60);
  const shield = { width: shieldWidth, height: Math.round((shieldWidth * 156) / 140) };
  const feature = {
    disc: narrow ? 38 : 42,
    gap: narrow ? space.xs : space.tight,
    lineHeight: lineHeightOf('feature'),
  };

  const wordmarkH = lineHeightOf('wordmark') * cap(fontScale, FONT_CAPS.wordmark);
  const taglineH = 2 * lineHeightOf('tagline') * cap(fontScale, FONT_CAPS.tagline);
  const featuresH =
    feature.disc + feature.gap + 2 * feature.lineHeight * cap(fontScale, FONT_CAPS.feature);
  const sloganH = 2 * lineHeightOf('slogan') * cap(fontScale, FONT_CAPS.slogan);

  const base: Record<GapKey, number> = {
    paddingTop: narrow ? space.tight : space.sm,
    shieldWordmark: space.sm,
    wordmarkTagline: space.xs,
    taglineFeatures: narrow ? space.md : space.lg,
    headHero: space.xs,
  };
  const contour = Math.round(WAVE_VIEWBOX.height * k);
  const sloganGap = space.md;
  const bottomPad = Math.max(insetBottom, space.md) + (narrow ? space.sm : space.md);
  const heroFullHeight = width * HERO_ASPECT;

  const waveHeight = (v: Visibility) => contour + (v.slogan ? sloganGap + sloganH : 0) + bottomPad;
  /** Từ đáy ảnh tới đáy màn (ảnh phủ xuống quá điểm sâu nhất của sóng một đoạn). */
  const heroBottom = (v: Visibility) =>
    waveHeight(v) - Math.round(WAVE_DEEPEST_TOP * k) - HERO_OVERLAP;
  const headerHeight = (v: Visibility, gaps: typeof base) =>
    insetTop +
    gaps.paddingTop +
    shield.height +
    gaps.shieldWordmark +
    wordmarkH +
    (v.tagline ? gaps.wordmarkTagline + taglineH : 0) +
    (v.features ? gaps.taglineFeatures + featuresH : 0);

  const hideDetails = fontScale >= HIDE_DETAILS_FONT_SCALE;
  const order: Visibility[] = [
    { slogan: true, features: !hideDetails, tagline: !hideDetails },
    { slogan: false, features: !hideDetails, tagline: !hideDetails },
    { slogan: false, features: false, tagline: !hideDetails },
    { slogan: false, features: false, tagline: false },
  ];
  // Cỡ chữ lớn: khối ẩn sẵn là features/tagline; vẫn thử câu viết tay trước khi bỏ nó.
  let vis = order[order.length - 1] as Visibility;
  let scale = 1;
  let fitted = false;
  for (const candidate of order) {
    const needed =
      headerHeight(candidate, base) + base.headHero + heroFullHeight + heroBottom(candidate);
    if (needed <= height) {
      vis = candidate;
      fitted = true;
      break;
    }
  }

  let gaps = { ...base };
  if (fitted) {
    // Phần dư: chia vào khoảng cách (có giới hạn trên), rồi cho ảnh lớn thêm.
    let spare =
      height - (headerHeight(vis, base) + base.headHero + heroFullHeight + heroBottom(vis));
    const grow = (
      key: 'paddingTop' | 'shieldWordmark' | 'wordmarkTagline' | 'taglineFeatures',
      max: number,
    ) => {
      const add = clamp(spare, 0, max);
      gaps[key] += add;
      spare -= add;
    };
    grow('paddingTop', 20);
    if (vis.features) grow('taglineFeatures', 14);
    grow('shieldWordmark', 6);
    if (vis.tagline) grow('wordmarkTagline', 4);
    const heroGrow = clamp(spare / heroFullHeight, 0, HERO_MAX_SCALE - 1);
    scale = 1 + heroGrow;
  } else {
    // Không đủ chỗ cả khi ẩn hết: thu nhỏ ảnh (không nhỏ hơn mức tối thiểu thì ẩn ảnh).
    const room = height - headerHeight(vis, base) - base.headHero - heroBottom(vis);
    scale = clamp(room / heroFullHeight, 0, 1);
  }

  const showHero = scale >= HERO_MIN_SCALE;
  const heroWidth = showHero ? width * scale : 0;
  const heroHeight = showHero ? heroWidth * HERO_ASPECT : 0;
  const bottomOffset = heroBottom(vis);
  const headerBottom = headerHeight(vis, gaps);
  const top = height - bottomOffset - heroHeight;
  const waveH = waveHeight(vis);
  // Ngoài phần ảnh, khối đầu không được chạm đáy sóng; ảnh ẩn thì chỉ cần không đè lên sóng.
  const fits = showHero
    ? headerBottom + gaps.headHero <= top + 0.5
    : headerBottom <= height - waveH + 0.5;

  return {
    showSlogan: vis.slogan,
    showFeatures: vis.features,
    showTagline: vis.tagline,
    showHero,
    header: {
      paddingTop: gaps.paddingTop,
      shield,
      feature,
      gaps: {
        shieldWordmark: gaps.shieldWordmark,
        wordmarkTagline: gaps.wordmarkTagline,
        taglineFeatures: gaps.taglineFeatures,
      },
      bottom: headerBottom,
    },
    hero: { width: heroWidth, height: heroHeight, scale: showHero ? scale : 0, bottomOffset, top },
    wave: {
      height: waveH,
      contourHeight: contour,
      slogan: { top: contour + sloganGap },
    },
    fits,
  };
}
