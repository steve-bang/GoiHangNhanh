import {
  BACK_ROW_HEIGHT,
  BODY_LINE_HEIGHT,
  BUTTON_HEIGHT,
  CAPTION_LINE_HEIGHT,
  LINK_ROW_HEIGHT,
  SOCIAL_BUTTON_HEIGHT,
  estimateBannerHeight,
  estimateFieldErrorHeight,
  estimateLines,
  finishLayout,
  growHeight,
  layoutBase,
  type BannerErrorSpec,
  type FieldErrorSpec,
  type OnboardingLayoutBase,
  type OnboardingLayoutInput,
} from './onboarding-layout';

/**
 * Bố cục bốn màn đăng nhập và khôi phục mật khẩu (UI-A03 đăng nhập, UI-A07, UI-A08, UI-A09):
 * thuần TypeScript, cùng quy tắc với `onboarding-layout.ts`: hình minh họa co lại rồi ẨN trước khi
 * nội dung thiết yếu bị cắt; không vừa thì cuộn. Số dòng chữ là ước tính (đối chiếu bản render web,
 * cần đo lại trên thiết bị thật).
 */

export interface AuthLayoutOptions {
  touch?: number;
}

/** Chiều cao thẻ "Mẹo" (đệm 12 + tiêu đề + nội dung); nở theo số dòng và cỡ chữ. */
export const TIP_CARD_PADDING = 12;
export const RULES_CARD_PADDING = 12;
export const OTP_BOX_HEIGHT = 52;
export const FIELD_HINT_MARGIN = 6;

function tipCardHeight(chars: number, contentWidth: number, scale: number): number {
  const lines = estimateLines(
    { chars, fontSize: 13 },
    contentWidth - 2 * TIP_CARD_PADDING - 44,
    scale,
  );
  return 2 * TIP_CARD_PADDING + 20 * scale + lines * 18 * scale;
}

const fieldHeightOf = (compact: boolean) => (compact ? 58 : 64);
const fieldBlock = (compact: boolean, scale: number) =>
  growHeight(fieldHeightOf(compact), CAPTION_LINE_HEIGHT + BODY_LINE_HEIGHT, 16, scale);
const buttonBlock = (scale: number) => growHeight(BUTTON_HEIGHT, BODY_LINE_HEIGHT, 20, scale);
const linkBlock = (touch: number) => Math.max(LINK_ROW_HEIGHT, touch);

type TitleSize = { fontSize: number; lineHeight: number };

/* ------------------------------------------------------------------ UI-A03 đăng nhập */

export interface SignInLayout extends OnboardingLayoutBase {
  title: TitleSize;
  fieldHeight: number;
  gaps: {
    top: number;
    logoToTitle: number;
    titleToSubtitle: number;
    toFields: number;
    betweenFields: number;
  };
}

export interface SignInOptions extends AuthLayoutOptions {
  showSocial: boolean;
  errors?: { email?: FieldErrorSpec; password?: FieldErrorSpec; banner?: BannerErrorSpec };
  /** Số ký tự của banner thành công (có hiện thì tính chỗ). */
  successChars?: number | undefined;
}

export const SIGN_IN_LOGO_HEIGHT = 96;
export const SIGN_IN_COMPACT_LOGO_HEIGHT = 90;

export function computeSignInLayout(
  input: OnboardingLayoutInput,
  options: SignInOptions = { showSocial: true },
): SignInLayout {
  const b = layoutBase(input);
  const touch = options.touch ?? 48;
  const errors = options.errors ?? {};
  const title: TitleSize = b.narrow
    ? { fontSize: 21, lineHeight: 28 }
    : { fontSize: 24, lineHeight: 32 };
  const gaps = b.compact
    ? { top: 12, logoToTitle: 12, titleToSubtitle: 4, toFields: 12, betweenFields: 10 }
    : { top: 24, logoToTitle: 20, titleToSubtitle: 6, toFields: 20, betweenFields: 14 };
  const titleLines = estimateLines(
    { chars: 22, fontSize: title.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const subtitleLines = estimateLines({ chars: 48, fontSize: 15 }, b.contentWidth, b.scale);
  const success = options.successChars
    ? estimateBannerHeight({ chars: options.successChars }, b.contentWidth, b.scale, touch, 0) + 12
    : 0;
  const fixed =
    gaps.top +
    (b.compact ? SIGN_IN_COMPACT_LOGO_HEIGHT : SIGN_IN_LOGO_HEIGHT) +
    gaps.logoToTitle +
    titleLines * title.lineHeight * b.scale +
    gaps.titleToSubtitle +
    subtitleLines * BODY_LINE_HEIGHT * b.scale +
    gaps.toFields +
    success +
    2 * fieldBlock(b.compact, b.scale) +
    gaps.betweenFields +
    estimateFieldErrorHeight(errors.email, b.contentWidth, b.scale, touch) +
    estimateFieldErrorHeight(errors.password, b.contentWidth, b.scale, touch) +
    linkBlock(touch) +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, 4) +
    buttonBlock(b.scale) +
    (options.showSocial ? 16 + CAPTION_LINE_HEIGHT * b.scale + 12 + SOCIAL_BUTTON_HEIGHT : 0) +
    8 +
    growHeight(
      LINK_ROW_HEIGHT,
      estimateLines({ chars: 34, fontSize: 15 }, b.contentWidth, b.scale) * BODY_LINE_HEIGHT,
      8,
      b.scale,
    );
  const fin = finishLayout(b, fixed, { maxHeight: 130, chrome: 8 });
  return { ...b, ...fin, title, fieldHeight: fieldHeightOf(b.compact), gaps };
}

/* ------------------------------------------------------------------ UI-A07 quên mật khẩu */

export interface ForgotLayout extends OnboardingLayoutBase {
  title: TitleSize;
  fieldHeight: number;
  gaps: {
    afterHeader: number;
    illustrationToTitle: number;
    titleToDescription: number;
    toField: number;
    toButton: number;
  };
}

export interface ForgotOptions extends AuthLayoutOptions {
  errors?: { email?: FieldErrorSpec; banner?: BannerErrorSpec };
}

export function computeForgotLayout(
  input: OnboardingLayoutInput,
  options: ForgotOptions = {},
): ForgotLayout {
  const b = layoutBase(input);
  const touch = options.touch ?? 48;
  const errors = options.errors ?? {};
  const title: TitleSize = b.narrow
    ? { fontSize: 19, lineHeight: 26 }
    : { fontSize: 22, lineHeight: 30 };
  const gaps = b.compact
    ? { afterHeader: 0, illustrationToTitle: 8, titleToDescription: 6, toField: 14, toButton: 14 }
    : { afterHeader: 8, illustrationToTitle: 16, titleToDescription: 8, toField: 24, toButton: 16 };
  const titleLines = estimateLines(
    { chars: 33, fontSize: title.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const descLines = estimateLines({ chars: 62, fontSize: 15 }, b.contentWidth, b.scale);
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterHeader +
    gaps.illustrationToTitle +
    titleLines * title.lineHeight * b.scale +
    gaps.titleToDescription +
    descLines * BODY_LINE_HEIGHT * b.scale +
    gaps.toField +
    fieldBlock(b.compact, b.scale) +
    (errors.email
      ? estimateFieldErrorHeight(errors.email, b.contentWidth, b.scale, touch)
      : FIELD_HINT_MARGIN + CAPTION_LINE_HEIGHT * b.scale) +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, 12) +
    gaps.toButton +
    buttonBlock(b.scale) +
    linkBlock(touch) +
    12 +
    tipCardHeight(58, b.contentWidth, b.scale);
  const fin = finishLayout(b, fixed, { maxHeight: 150, chrome: 0 });
  return { ...b, ...fin, title, fieldHeight: fieldHeightOf(b.compact), gaps };
}

/* ------------------------------------------------------------------ UI-A08 nhập mã */

export interface OtpLayout extends OnboardingLayoutBase {
  title: TitleSize;
  /** Cỡ ô số: rộng x cao. */
  box: { width: number; height: number; gap: number; fontSize: number };
  gaps: {
    afterHeader: number;
    illustrationToTitle: number;
    titleToDescription: number;
    toBoxes: number;
    toButton: number;
  };
}

export interface OtpOptions extends AuthLayoutOptions {
  /** Câu lỗi dưới ô số (mã sai/thiếu số). */
  fieldError?: FieldErrorSpec | undefined;
  banner?: BannerErrorSpec | undefined;
  /** Có thông báo nhẹ "Mã mới đã được gửi". */
  notice?: boolean;
}

export function computeOtpLayout(
  input: OnboardingLayoutInput,
  options: OtpOptions = {},
): OtpLayout {
  const b = layoutBase(input);
  const touch = options.touch ?? 48;
  const title: TitleSize = b.narrow
    ? { fontSize: 20, lineHeight: 26 }
    : { fontSize: 24, lineHeight: 32 };
  const gaps = b.compact
    ? { afterHeader: 0, illustrationToTitle: 8, titleToDescription: 6, toBoxes: 12, toButton: 12 }
    : { afterHeader: 8, illustrationToTitle: 16, titleToDescription: 8, toBoxes: 20, toButton: 12 };
  // 6 ô chia đều bề rộng, cách nhau `gap`; cao 52 (hoặc nhỏ hơn khi ô hẹp)
  const gap = b.narrow ? 8 : 10;
  const width = Math.floor((b.contentWidth - 5 * gap) / 6);
  const box = {
    width,
    height: Math.min(OTP_BOX_HEIGHT, Math.max(44, Math.round(width * 1.2))),
    gap,
    fontSize: 22,
  };
  const titleLines = estimateLines(
    { chars: 27, fontSize: title.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const descLines = estimateLines({ chars: 74, fontSize: 15 }, b.contentWidth, b.scale);
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterHeader +
    gaps.illustrationToTitle +
    titleLines * title.lineHeight * b.scale +
    gaps.titleToDescription +
    descLines * BODY_LINE_HEIGHT * b.scale +
    linkBlock(touch) +
    gaps.toBoxes +
    Math.max(box.height, box.height * Math.min(b.scale, 1.3)) +
    estimateFieldErrorHeight(options.fieldError, b.contentWidth, b.scale, touch) +
    (options.notice ? 8 + 20 * b.scale : 0) +
    estimateBannerHeight(options.banner, b.contentWidth, b.scale, touch, 12) +
    linkBlock(touch) +
    gaps.toButton +
    buttonBlock(b.scale) +
    12 +
    tipCardHeight(84, b.contentWidth, b.scale);
  const fin = finishLayout(b, fixed, { maxHeight: 140, chrome: 0 });
  return { ...b, ...fin, title, box, gaps };
}

/* ------------------------------------------------------------------ UI-A09 mật khẩu mới */

export interface NewPasswordLayout extends OnboardingLayoutBase {
  title: TitleSize;
  fieldHeight: number;
  gaps: {
    afterHeader: number;
    illustrationToTitle: number;
    titleToDescription: number;
    toFields: number;
    betweenFields: number;
    toRules: number;
    toButton: number;
  };
}

export interface NewPasswordOptions extends AuthLayoutOptions {
  errors?: { password?: FieldErrorSpec; confirm?: FieldErrorSpec; banner?: BannerErrorSpec };
}

export function computeNewPasswordLayout(
  input: OnboardingLayoutInput,
  options: NewPasswordOptions = {},
): NewPasswordLayout {
  const b = layoutBase(input);
  const touch = options.touch ?? 48;
  const errors = options.errors ?? {};
  const title: TitleSize = b.narrow
    ? { fontSize: 20, lineHeight: 26 }
    : { fontSize: 24, lineHeight: 32 };
  const gaps = b.compact
    ? {
        afterHeader: 0,
        illustrationToTitle: 6,
        titleToDescription: 6,
        toFields: 12,
        betweenFields: 10,
        toRules: 10,
        toButton: 12,
      }
    : {
        afterHeader: 8,
        illustrationToTitle: 14,
        titleToDescription: 8,
        toFields: 20,
        betweenFields: 14,
        toRules: 14,
        toButton: 16,
      };
  const titleLines = estimateLines(
    { chars: 18, fontSize: title.fontSize, bold: true },
    b.contentWidth,
    b.scale,
  );
  const descLines = estimateLines({ chars: 80, fontSize: 15 }, b.contentWidth, b.scale);
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterHeader +
    gaps.illustrationToTitle +
    titleLines * title.lineHeight * b.scale +
    gaps.titleToDescription +
    descLines * BODY_LINE_HEIGHT * b.scale +
    gaps.toFields +
    2 * fieldBlock(b.compact, b.scale) +
    gaps.betweenFields +
    estimateFieldErrorHeight(errors.password, b.contentWidth, b.scale, touch) +
    estimateFieldErrorHeight(errors.confirm, b.contentWidth, b.scale, touch) +
    gaps.toRules +
    2 * RULES_CARD_PADDING +
    (20 + BODY_LINE_HEIGHT) * b.scale +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, 12) +
    gaps.toButton +
    buttonBlock(b.scale);
  const fin = finishLayout(b, fixed, { maxHeight: 130, chrome: 0 });
  return { ...b, ...fin, title, fieldHeight: fieldHeightOf(b.compact), gaps };
}
