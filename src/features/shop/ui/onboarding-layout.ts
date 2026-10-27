import {
  COMPACT_HEIGHT_BELOW,
  HIDE_ILLUSTRATION_FONT_SCALE,
  MIN_ILLUSTRATION_HEIGHT,
  NARROW_WIDTH_BELOW,
} from './welcome-layout';

/**
 * Bố cục ba màn thiết lập (UI-A03 đăng ký, UI-A04, UI-A06): thuần TypeScript, không React/RN để dễ
 * test. Mỗi hàm cho biết cỡ chữ, khoảng cách và chiều cao hình minh họa theo kích thước cửa sổ,
 * kèm ước tính chiều cao nội dung để biết màn có phải cuộn. Quy tắc chung: hình minh họa co lại rồi
 * ẨN trước khi nội dung thiết yếu (tiêu đề, trường, nút chính, liên kết chính) bị cắt; không vừa
 * thì cuộn.
 *
 * Các hằng số chiều cao ngoài chữ (ô nhập, nút, thẻ...) là chính các giá trị mà component dùng
 * (xuất ra để component và ước tính không lệch nhau). Số dòng chữ ước tính theo độ rộng ký tự
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

/** Chiều cao hàng nút quay lại (vùng chạm đủ cho cả iOS 44 và Android 48). */
/** Sai số chừa lại khi quyết định có hiện hình hay không (dp). */
export const ESTIMATE_SAFETY_MARGIN = 8;

export const BACK_ROW_HEIGHT = 48;
export const BUTTON_HEIGHT = 56;
export const SOCIAL_BUTTON_HEIGHT = 48;
export const LINK_ROW_HEIGHT = 48;
export const BODY_LINE_HEIGHT = 22;
export const CAPTION_LINE_HEIGHT = 16;

/** Chiều cao của widget có chữ: không nhỏ hơn mức cơ bản, nở ra theo cỡ chữ hệ thống. */
function grow(baseHeight: number, textHeight: number, padding: number, scale: number): number {
  return Math.max(baseHeight, textHeight * scale + padding);
}

function base(input: OnboardingLayoutInput) {
  const { width, height, insetTop, insetBottom, fontScale } = input;
  const compact = height < COMPACT_HEIGHT_BELOW;
  const narrow = width < NARROW_WIDTH_BELOW;
  const padX = narrow ? 20 : 24;
  const bottomPad = Math.max(insetBottom, 12);
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
  title: { fontSize: number; lineHeight: number };
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

const SIGN_UP_TITLE = {
  regular: { fontSize: 30, lineHeight: 38 },
  narrow: { fontSize: 24, lineHeight: 30 },
};
const SIGN_UP_SUBTITLE_CHARS = 62;
const SIGN_UP_TITLE_CHARS = 23;

export function computeSignUpLayout(
  input: OnboardingLayoutInput,
  options: { showSocial: boolean } = { showSocial: true },
): SignUpLayout {
  const b = base(input);
  const title = b.narrow ? SIGN_UP_TITLE.narrow : SIGN_UP_TITLE.regular;
  const gaps = b.compact
    ? {
        afterBack: 4,
        titleToSubtitle: 8,
        subtitleToFields: 20,
        betweenFields: 12,
        fieldsToButton: 16,
        buttonToDivider: 16,
        dividerToSocial: 12,
        socialToLink: 8,
      }
    : {
        afterBack: 8,
        titleToSubtitle: 12,
        subtitleToFields: 28,
        betweenFields: 16,
        fieldsToButton: 20,
        buttonToDivider: 24,
        dividerToSocial: 16,
        socialToLink: 8,
      };
  const fieldHeight = b.compact ? 58 : 64;
  const titleLines = estimateLines(
    { chars: SIGN_UP_TITLE_CHARS, fontSize: title.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines(
    { chars: SIGN_UP_SUBTITLE_CHARS, fontSize: 15 },
    b.contentWidth,
    b.scale,
  );
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterBack +
    titleLines * title.lineHeight * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.subtitleToFields +
    2 * grow(fieldHeight, CAPTION_LINE_HEIGHT + BODY_LINE_HEIGHT, 16, b.scale) +
    gaps.betweenFields +
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
      estimateLines({ chars: 30, fontSize: 15 }, b.contentWidth, b.scale) * BODY_LINE_HEIGHT,
      8,
      b.scale,
    );
  const fin = finish(b, fixed, { maxHeight: 170, chrome: 16 });
  return { ...b, ...fin, title, fieldHeight, gaps };
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
  title: { fontSize: number; lineHeight: number };
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

export const PROGRESS_ROW_HEIGHT = 28;
export const SHOP_NAME_INPUT_HEIGHT = 52;
export const SOURCE_COUNT = 4;

export function computeCreateShopLayout(input: OnboardingLayoutInput): CreateShopLayout {
  const b = base(input);
  const title = b.narrow ? { fontSize: 22, lineHeight: 28 } : { fontSize: 28, lineHeight: 34 };
  const gaps = b.compact
    ? {
        afterBack: 0,
        progressToTitle: 14,
        titleToSubtitle: 8,
        subtitleToName: 18,
        nameToSources: 8,
        sourcesHeaderToCards: 8,
        betweenCards: 6,
        cardsToButton: 14,
        buttonToSkip: 0,
      }
    : {
        afterBack: 0,
        progressToTitle: 16,
        titleToSubtitle: 12,
        subtitleToName: 24,
        nameToSources: 12,
        sourcesHeaderToCards: 12,
        betweenCards: 8,
        cardsToButton: 20,
        buttonToSkip: 4,
      };
  const cardHeight = b.compact ? 48 : 50;
  const titleLines = estimateLines(
    { chars: 22, fontSize: title.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines({ chars: 52, fontSize: 15 }, b.contentWidth, b.scale);
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterBack +
    PROGRESS_ROW_HEIGHT +
    gaps.progressToTitle +
    titleLines * title.lineHeight * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.subtitleToName +
    // nhãn + ô + dòng đếm ký tự
    BODY_LINE_HEIGHT * b.scale +
    8 +
    grow(SHOP_NAME_INPUT_HEIGHT, BODY_LINE_HEIGHT, 24, b.scale) +
    4 +
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
    title,
    gaps,
    cardHeight,
    illustrationHeight: 0,
    estimatedContentHeight,
    scrollNeeded: estimatedContentHeight > b.availableHeight,
  };
}

/* ------------------------------------------------------------------ UI-A06 hoàn tất */

export interface SetupDoneLayout extends OnboardingLayoutBase {
  titleLead: { fontSize: number; lineHeight: number };
  gaps: {
    top: number;
    illustrationToTitle: number;
    titleToSubtitle: number;
    subtitleToCard: number;
    cardToButton: number;
  };
}

export const SETUP_ILLUSTRATION_MAX_HEIGHT = 230;
export const SUMMARY_ROW_MIN_HEIGHT = 64;
export const SUMMARY_ROWS = 2;

export function computeSetupDoneLayout(input: OnboardingLayoutInput): SetupDoneLayout {
  const b = base(input);
  const titleLead = b.narrow ? { fontSize: 26, lineHeight: 32 } : { fontSize: 30, lineHeight: 36 };
  const gaps = b.compact
    ? { top: 4, illustrationToTitle: 4, titleToSubtitle: 8, subtitleToCard: 14, cardToButton: 14 }
    : {
        top: 16,
        illustrationToTitle: 16,
        titleToSubtitle: 12,
        subtitleToCard: 28,
        cardToButton: 28,
      };
  const leadLines = 1;
  const titleLines = estimateLines(
    { chars: 33, fontSize: 18, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines({ chars: 100, fontSize: 15 }, b.contentWidth, b.scale);
  const fixed =
    gaps.top +
    gaps.illustrationToTitle +
    leadLines * titleLead.lineHeight * b.scale +
    titleLines * 24 * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.subtitleToCard +
    SUMMARY_ROWS * SUMMARY_ROW_MIN_HEIGHT * Math.max(1, b.scale * 0.9) +
    gaps.cardToButton +
    grow(BUTTON_HEIGHT, BODY_LINE_HEIGHT, 20, b.scale) +
    grow(LINK_ROW_HEIGHT, BODY_LINE_HEIGHT, 16, b.scale);
  const fin = finish(b, fixed, { maxHeight: SETUP_ILLUSTRATION_MAX_HEIGHT, chrome: 0 });
  return { ...b, ...fin, titleLead, gaps };
}

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
    confetti: [
      { left: 22, top: 14, w: 16, h: 6, rotate: 35, tone: 0 },
      { left: 80, top: 8, w: 10, h: 10, rotate: 0, tone: 1 },
      { left: 150, top: 2, w: 6, h: 14, rotate: 20, tone: 2 },
      { left: 232, top: 10, w: 8, h: 16, rotate: -25, tone: 0 },
      { left: 296, top: 26, w: 18, h: 6, rotate: -35, tone: 2 },
      { left: 316, top: 92, w: 14, h: 6, rotate: 30, tone: 0 },
      { left: 8, top: 84, w: 14, h: 6, rotate: -20, tone: 2 },
      { left: 268, top: 142, w: 12, h: 6, rotate: -30, tone: 1 },
      { left: 52, top: 54, w: 8, h: 8, rotate: 0, tone: 1 },
    ].map((c) => ({
      left: c.left * u,
      top: c.top * u,
      width: c.w * u,
      height: c.h * u,
      rotate: c.rotate,
      tone: c.tone,
    })),
  };
}
