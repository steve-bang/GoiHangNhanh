import { layout, MIN_TOUCH_TARGET, typography } from '@/core/theme';

import {
  COMPACT_HEIGHT_BELOW,
  HIDE_ILLUSTRATION_FONT_SCALE,
  MIN_ILLUSTRATION_HEIGHT,
  NARROW_WIDTH_BELOW,
} from './welcome-layout';

/**
 * Bố cục ba màn thiết lập (UI-A03 đăng ký, UI-A04, UI-A06): thuần TypeScript, không React/RN để dễ
 * test. Mỗi hàm cho biết khoảng cách và chiều cao hình minh họa theo kích thước cửa sổ, kèm ước
 * tính chiều cao nội dung để biết màn có phải cuộn. Cỡ chữ KHÔNG do tệp này quyết: màn dùng
 * `<Text variant>` và ước tính đọc cùng `typography` (D-20, chuyển sang Design Token). Khoảng cách
 * lấy từ thang `layout.space`. Quy tắc chung: hình minh họa co lại rồi
 * ẨN trước khi nội dung thiết yếu (tiêu đề, trường, nút chính, liên kết chính) bị cắt; không vừa
 * thì cuộn.
 *
 * Các hằng số chiều cao ngoài chữ (ô nhập, nút, thẻ...) là chính các giá trị mà component dùng
 * (xuất ra để component và ước tính không lệch nhau), suy từ token. Số dòng chữ ước tính theo độ rộng ký tự
 * trung bình; đã đối chiếu với bản render web, cần đo lại trên thiết bị thật.
 */

export interface OnboardingLayoutInput {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  /** Cỡ chữ hệ thống (1 = mặc định). */
  fontScale: number;
}

export interface OnboardingLayoutBase {
  compact: boolean;
  narrow: boolean;
  /** Lề ngang của nội dung (dp). */
  padX: number;
  /** Lề đáy của vùng cuộn (dp), đã gồm vùng an toàn. */
  bottomPad: number;
  availableHeight: number;
  /** Chiều cao hình minh họa; 0 nghĩa là ẩn. */
  illustrationHeight: number;
  /** Chiều cao nội dung ước tính, gồm cả hình nếu đang hiện. */
  estimatedContentHeight: number;
  /** true khi ước tính nội dung không vừa: màn phải cuộn. */
  scrollNeeded: boolean;
}

/** Sai số chừa lại khi quyết định có hiện hình hay không (dp). */
export const ESTIMATE_SAFETY_MARGIN = layout.space.sm;

/**
 * Vùng chạm đủ cho CẢ HAI nền tảng (iOS 44, Android 48): hàng cố định dùng chung một số để bố cục
 * và ước tính giống nhau trên iOS và Android. Component vẫn so thêm với `getMinTouchTarget()`.
 */
const TOUCH_BOTH_PLATFORMS = Math.max(MIN_TOUCH_TARGET.ios, MIN_TOUCH_TARGET.android);

/** Chiều cao hàng nút quay lại. */
export const BACK_ROW_HEIGHT = TOUCH_BOTH_PLATFORMS;
export const BUTTON_HEIGHT = layout.component.button.minHeight.primary;
export const SOCIAL_BUTTON_HEIGHT = TOUCH_BOTH_PLATFORMS;
export const LINK_ROW_HEIGHT = TOUCH_BOTH_PLATFORMS;
/** Dòng chữ `body` / `caption` (variant của `Text`). */
export const BODY_LINE_HEIGHT = typography.body.lineHeight;
export const CAPTION_LINE_HEIGHT = typography.caption.lineHeight;
/** Chữ lỗi dưới ô nhập = variant `formBody` (đủ lớn để đọc, không dùng cỡ chú thích 12). */
export const FIELD_ERROR_FONT_SIZE = typography.formBody.fontSize;
export const FIELD_ERROR_LINE_HEIGHT = typography.formBody.lineHeight;
/** Khung lỗi chung phía trên nút chính (chữ variant `body`). */
export const BANNER_LINE_HEIGHT = typography.body.lineHeight;
export const BANNER_PADDING = layout.space.md;
const FIELD_ERROR_MARGIN_TOP = layout.space.tight;
const BANNER_GAP = layout.space.md;
/** Lề trái + biểu tượng + khoảng cách của dòng lỗi (trừ khỏi bề rộng chữ khi ước tính số dòng). */
const FIELD_ERROR_ICON_AND_GAPS = layout.space.xs + layout.icon.sm + layout.space.xs;
/** Biểu tượng + khoảng cách + viền hai bên của khung lỗi chung. */
const BANNER_ICON_AND_BORDER = layout.icon.md + layout.space.sm + 2 * layout.borderWidth.thin;

/** Chiều cao của widget có chữ: không nhỏ hơn mức cơ bản, nở ra theo cỡ chữ hệ thống. */
function grow(baseHeight: number, textHeight: number, padding: number, scale: number): number {
  return Math.max(baseHeight, textHeight * scale + padding);
}

function base(input: OnboardingLayoutInput) {
  const { width, height, insetTop, insetBottom, fontScale } = input;
  const compact = height < COMPACT_HEIGHT_BELOW;
  const narrow = width < NARROW_WIDTH_BELOW;
  const padX = narrow ? layout.space.lg : layout.space.xl;
  const bottomPad = Math.max(insetBottom, layout.space.md);
  return {
    compact,
    narrow,
    padX,
    bottomPad,
    contentWidth: width - 2 * padX,
    scale: Math.max(1, fontScale),
    fontScale,
    availableHeight: height - insetTop - bottomPad,
  };
}

/** Dùng chung cho bố cục các màn đăng nhập/khôi phục (`auth-layout.ts`). */
export { base as layoutBase, finish as finishLayout, grow as growHeight };

/** Số dòng ước tính của đoạn chữ (độ rộng ký tự trung bình ~0,5 em; đậm ~0,52 em). */
export function estimateLines(
  text: { chars: number; fontSize: number; bold?: boolean },
  contentWidth: number,
  scale: number,
): number {
  const perChar = text.fontSize * (text.bold ? 0.52 : 0.5) * scale;
  return Math.max(1, Math.ceil((text.chars * perChar) / contentWidth));
}

function finish(
  b: ReturnType<typeof base>,
  fixedHeight: number,
  illustration: { maxHeight: number; chrome: number },
): Pick<
  OnboardingLayoutBase,
  'illustrationHeight' | 'estimatedContentHeight' | 'scrollNeeded' | 'availableHeight'
> {
  // Chừa một đoạn an toàn vì ước tính số dòng chữ chỉ gần đúng.
  const room = b.availableHeight - fixedHeight - ESTIMATE_SAFETY_MARGIN;
  const fits =
    b.fontScale < HIDE_ILLUSTRATION_FONT_SCALE &&
    room - illustration.chrome >= MIN_ILLUSTRATION_HEIGHT;
  const illustrationHeight = fits
    ? Math.min(illustration.maxHeight, Math.floor(room - illustration.chrome))
    : 0;
  const estimatedContentHeight =
    fixedHeight + (illustrationHeight > 0 ? illustrationHeight + illustration.chrome : 0);
  return {
    illustrationHeight,
    estimatedContentHeight,
    availableHeight: b.availableHeight,
    scrollNeeded: estimatedContentHeight > b.availableHeight,
  };
}

/* ------------------------------------------------------------------ UI-A03 đăng ký */

export interface SignUpLayout extends OnboardingLayoutBase {
  fieldHeight: number;
  gaps: {
    afterBack: number;
    titleToSubtitle: number;
    subtitleToFields: number;
    betweenFields: number;
    fieldsToButton: number;
    buttonToDivider: number;
    dividerToSocial: number;
    socialToLink: number;
  };
}

const TITLE = typography.screenTitle;
/** Trần chiều cao hình khiên + bảng ghi của màn đăng ký (đơn vị dp, hình minh họa). */
export const SIGN_UP_ILLUSTRATION_MAX_HEIGHT = 170;
/** Ô nhập có nhãn của màn đăng ký: nhãn `caption` + giá trị `body` + đệm dọc hai bên. */
const ICON_FIELD_CONTENT_HEIGHT = CAPTION_LINE_HEIGHT + BODY_LINE_HEIGHT + 2 * layout.space.sm;
const SIGN_UP_SUBTITLE_CHARS = 62;
const SIGN_UP_TITLE_CHARS = 23;

/** Lỗi dưới một ô nhập: số ký tự của chữ và có nút hành động hay không. */
export interface FieldErrorSpec {
  chars: number;
  withAction?: boolean;
}

/** Khung lỗi chung: ký tự của câu đầu, câu sau (nếu có) và có nút "Thử lại" hay không. */
export interface BannerErrorSpec {
  chars: number;
  withRetry?: boolean;
}

export interface SignUpErrorSpecs {
  email?: FieldErrorSpec | undefined;
  password?: FieldErrorSpec | undefined;
  banner?: BannerErrorSpec | undefined;
}

/** Chiều cao dòng lỗi dưới ô nhập (gồm khoảng cách trên). Nút hành động nằm cùng dòng, cao `touch`. */
export function estimateFieldErrorHeight(
  spec: FieldErrorSpec | undefined,
  contentWidth: number,
  scale: number,
  touch: number,
): number {
  if (!spec) return 0;
  const textWidth = contentWidth - FIELD_ERROR_ICON_AND_GAPS - (spec.withAction ? 96 : 0);
  const lines = estimateLines(
    { chars: spec.chars, fontSize: FIELD_ERROR_FONT_SIZE },
    textWidth,
    scale,
  );
  const textHeight = lines * FIELD_ERROR_LINE_HEIGHT * scale;
  return FIELD_ERROR_MARGIN_TOP + (spec.withAction ? Math.max(textHeight, touch) : textHeight);
}

/** Chiều cao khung lỗi chung (gồm khoảng cách trên là `marginTop`). */
export function estimateBannerHeight(
  spec: BannerErrorSpec | undefined,
  contentWidth: number,
  scale: number,
  touch: number,
  marginTop: number,
): number {
  if (!spec) return 0;
  const lines = estimateLines(
    { chars: spec.chars, fontSize: typography.body.fontSize },
    contentWidth - 2 * BANNER_PADDING - BANNER_ICON_AND_BORDER,
    scale,
  );
  return (
    marginTop +
    2 * BANNER_PADDING +
    2 * layout.borderWidth.thin +
    lines * BANNER_LINE_HEIGHT * scale +
    (spec.withRetry ? BANNER_GAP + Math.max(touch, BUTTON_HEIGHT) : 0)
  );
}

export function computeSignUpLayout(
  input: OnboardingLayoutInput,
  options: { showSocial: boolean; touch?: number; errors?: SignUpErrorSpecs } = {
    showSocial: true,
  },
): SignUpLayout {
  const b = base(input);
  const touch = options.touch ?? 48;
  const errors = options.errors ?? {};
  const { space } = layout;
  const gaps = b.compact
    ? {
        afterBack: space.xs,
        titleToSubtitle: space.sm,
        subtitleToFields: space.lg,
        betweenFields: space.md,
        fieldsToButton: space.lg,
        buttonToDivider: space.lg,
        dividerToSocial: space.md,
        socialToLink: space.sm,
      }
    : {
        afterBack: space.sm,
        titleToSubtitle: space.md,
        subtitleToFields: space.xl,
        betweenFields: space.lg,
        fieldsToButton: space.xl,
        buttonToDivider: space.xl,
        dividerToSocial: space.lg,
        socialToLink: space.sm,
      };
  const fieldHeight = ICON_FIELD_CONTENT_HEIGHT + (b.compact ? space.xs : space.sm);
  const titleLines = estimateLines(
    { chars: SIGN_UP_TITLE_CHARS, fontSize: TITLE.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines(
    { chars: SIGN_UP_SUBTITLE_CHARS, fontSize: typography.body.fontSize },
    b.contentWidth,
    b.scale,
  );
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterBack +
    titleLines * TITLE.lineHeight * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.subtitleToFields +
    2 * grow(fieldHeight, CAPTION_LINE_HEIGHT + BODY_LINE_HEIGHT, 16, b.scale) +
    estimateFieldErrorHeight(errors.email, b.contentWidth, b.scale, touch) +
    estimateFieldErrorHeight(errors.password, b.contentWidth, b.scale, touch) +
    gaps.betweenFields +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, space.md) +
    gaps.fieldsToButton +
    grow(BUTTON_HEIGHT, BODY_LINE_HEIGHT, 20, b.scale) +
    (options.showSocial
      ? gaps.buttonToDivider +
        CAPTION_LINE_HEIGHT * b.scale +
        gaps.dividerToSocial +
        SOCIAL_BUTTON_HEIGHT
      : 0) +
    gaps.socialToLink +
    grow(
      LINK_ROW_HEIGHT,
      estimateLines({ chars: 30, fontSize: typography.body.fontSize }, b.contentWidth, b.scale) *
        BODY_LINE_HEIGHT,
      8,
      b.scale,
    );
  const fin = finish(b, fixed, { maxHeight: SIGN_UP_ILLUSTRATION_MAX_HEIGHT, chrome: space.lg });
  return { ...b, ...fin, fieldHeight, gaps };
}

/** Hình khiên + bảng ghi ở đáy màn đăng ký: một tham số (chiều cao), khung rộng = 1,7 x cao. */
export function getShieldClipboardGeometry(height: number) {
  const u = height / 150; // khung thiết kế cao 150, hình có thể phóng đến 170
  return {
    frame: { width: 255 * u, height: 150 * u },
    ground: { width: 200 * u, height: 22 * u, bottom: 4 * u },
    clipboard: { left: 88 * u, top: 6 * u, width: 96 * u, height: 124 * u },
    shield: { left: 54 * u, top: 14 * u, size: 104 * u, checkSize: 52 * u },
    leafLeft: { left: 20 * u, bottom: 14 * u, size: 44 * u },
    leafRight: { right: 18 * u, bottom: 16 * u, size: 40 * u },
  };
}

/* ------------------------------------------------------------------ UI-A04 tạo hồ sơ shop */

export interface CreateShopLayout extends OnboardingLayoutBase {
  gaps: {
    afterBack: number;
    progressToTitle: number;
    titleToSubtitle: number;
    subtitleToName: number;
    nameToSources: number;
    sourcesHeaderToCards: number;
    betweenCards: number;
    cardsToButton: number;
    buttonToSkip: number;
  };
  cardHeight: number;
}

export const PROGRESS_ROW_HEIGHT = layout.component.tile.sm;
export const SHOP_NAME_INPUT_HEIGHT = layout.component.field.minHeight;
export const SOURCE_COUNT = 4;

export function computeCreateShopLayout(input: OnboardingLayoutInput): CreateShopLayout {
  const b = base(input);
  const { space } = layout;
  const gaps = b.compact
    ? {
        afterBack: 0,
        progressToTitle: space.md,
        titleToSubtitle: space.sm,
        subtitleToName: space.lg,
        nameToSources: space.sm,
        sourcesHeaderToCards: space.sm,
        betweenCards: space.tight,
        cardsToButton: space.md,
        buttonToSkip: 0,
      }
    : {
        afterBack: 0,
        progressToTitle: space.lg,
        titleToSubtitle: space.md,
        subtitleToName: space.xl,
        nameToSources: space.md,
        sourcesHeaderToCards: space.md,
        betweenCards: space.sm,
        cardsToButton: space.xl,
        buttonToSkip: space.xs,
      };
  const cardHeight = b.compact ? TOUCH_BOTH_PLATFORMS : layout.component.tile.lg;
  const titleLines = estimateLines(
    { chars: 22, fontSize: TITLE.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines(
    { chars: 52, fontSize: typography.body.fontSize },
    b.contentWidth,
    b.scale,
  );
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterBack +
    PROGRESS_ROW_HEIGHT +
    gaps.progressToTitle +
    titleLines * TITLE.lineHeight * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.subtitleToName +
    // nhãn + ô + dòng đếm ký tự
    BODY_LINE_HEIGHT * b.scale +
    space.sm +
    grow(SHOP_NAME_INPUT_HEIGHT, BODY_LINE_HEIGHT, 24, b.scale) +
    space.xs +
    CAPTION_LINE_HEIGHT * b.scale +
    gaps.nameToSources +
    // nhãn nguồn bán + gợi ý
    BODY_LINE_HEIGHT * b.scale +
    CAPTION_LINE_HEIGHT * b.scale +
    gaps.sourcesHeaderToCards +
    SOURCE_COUNT * grow(cardHeight, BODY_LINE_HEIGHT, 24, b.scale) +
    (SOURCE_COUNT - 1) * gaps.betweenCards +
    gaps.cardsToButton +
    grow(BUTTON_HEIGHT, BODY_LINE_HEIGHT, 20, b.scale) +
    gaps.buttonToSkip +
    grow(LINK_ROW_HEIGHT, BODY_LINE_HEIGHT, 16, b.scale);
  const estimatedContentHeight = fixed;
  return {
    ...b,
    gaps,
    cardHeight,
    illustrationHeight: 0,
    estimatedContentHeight,
    scrollNeeded: estimatedContentHeight > b.availableHeight,
  };
}

/* ------------------------------------------------------------------ UI-A06 hoàn tất */

export interface SetupDoneLayout extends OnboardingLayoutBase {
  gaps: {
    top: number;
    illustrationToTitle: number;
    titleToSubtitle: number;
    subtitleToCard: number;
    cardToButton: number;
  };
}

export const SETUP_ILLUSTRATION_MAX_HEIGHT = 230;
/** Hàng tóm tắt: ô biểu tượng `tile.md` + đệm dọc `space.sm` hai bên (nở theo chữ). */
export const SUMMARY_ROW_MIN_HEIGHT = layout.component.tile.md + 2 * layout.space.sm;
export const SUMMARY_ROWS = 2;

export function computeSetupDoneLayout(input: OnboardingLayoutInput): SetupDoneLayout {
  const b = base(input);
  const { space } = layout;
  const gaps = b.compact
    ? {
        top: space.xs,
        illustrationToTitle: space.xs,
        titleToSubtitle: space.sm,
        subtitleToCard: space.md,
        cardToButton: space.md,
      }
    : {
        top: space.lg,
        illustrationToTitle: space.lg,
        titleToSubtitle: space.md,
        subtitleToCard: space.xl,
        cardToButton: space.xl,
      };
  // Dòng đầu `screenTitle`, dòng sau `sectionTitle` (variant của `Text` ở màn).
  const leadLines = 1;
  const second = typography.sectionTitle;
  const titleLines = estimateLines(
    { chars: 33, fontSize: second.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines(
    { chars: 100, fontSize: typography.body.fontSize },
    b.contentWidth,
    b.scale,
  );
  const fixed =
    gaps.top +
    gaps.illustrationToTitle +
    leadLines * TITLE.lineHeight * b.scale +
    titleLines * second.lineHeight * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.subtitleToCard +
    SUMMARY_ROWS * SUMMARY_ROW_MIN_HEIGHT * Math.max(1, b.scale * 0.9) +
    gaps.cardToButton +
    grow(BUTTON_HEIGHT, BODY_LINE_HEIGHT, 20, b.scale) +
    grow(LINK_ROW_HEIGHT, BODY_LINE_HEIGHT, 16, b.scale);
  const fin = finish(b, fixed, { maxHeight: SETUP_ILLUSTRATION_MAX_HEIGHT, chrome: 0 });
  return { ...b, ...fin, gaps };
}

/**
 * Pháo giấy của hình hoàn tất, theo ĐƠN VỊ THIẾT KẾ của khung 342 x 230 (nhân với tỉ lệ `u` khi
 * dựng): [x, y, rộng, cao, góc xoay (độ), chỉ số màu 0-2].
 */
const CONFETTI_DESIGN: readonly (readonly [number, number, number, number, number, 0 | 1 | 2])[] = [
  [22, 14, 16, 6, 35, 0],
  [80, 8, 10, 10, 0, 1],
  [150, 2, 6, 14, 20, 2],
  [232, 10, 8, 16, -25, 0],
  [296, 26, 18, 6, -35, 2],
  [316, 92, 14, 6, 30, 0],
  [8, 84, 14, 6, -20, 2],
  [268, 142, 12, 6, -30, 1],
  [52, 54, 8, 8, 0, 1],
];

/** Hình hoàn tất: khiên + hộp + bảng ghi + pháo giấy trong khung 342 x 230 (đơn vị thiết kế). */
export function getSetupDoneGeometry(height: number) {
  const u = height / SETUP_ILLUSTRATION_MAX_HEIGHT;
  return {
    frame: { width: 342 * u, height: SETUP_ILLUSTRATION_MAX_HEIGHT * u },
    blob: { diameter: 190 * u },
    clipboard: { left: 190 * u, top: 62 * u, width: 96 * u, height: 124 * u },
    shield: { left: 108 * u, top: 20 * u, size: 138 * u, checkSize: 70 * u },
    boxLarge: { left: 40 * u, bottom: 30 * u, size: 92 * u },
    boxSmall: { left: 108 * u, bottom: 24 * u, size: 62 * u },
    leafLeft: { left: 26 * u, bottom: 22 * u, size: 46 * u },
    leafRight: { right: 36 * u, bottom: 24 * u, size: 40 * u },
    /** Pháo giấy tĩnh: vị trí (đơn vị thiết kế), góc xoay, kích thước, màu theo chỉ số. */
    confetti: CONFETTI_DESIGN.map(([x, y, w, h, rotate, tone]) => ({
      left: x * u,
      top: y * u,
      width: w * u,
      height: h * u,
      rotate,
      tone,
    })),
  };
}
