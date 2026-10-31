import { layout, typography } from '@/core/theme';

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
 *
 * Cỡ chữ KHÔNG còn tính ở đây: màn hình dùng biến thể `Text` (`AUTH_TITLE_VARIANT`, `body`,
 * `TIP_BODY_VARIANT`), ước tính đọc cùng thang `typography` để không lệch. Khoảng cách theo
 * `layout.space` (thang token); phần còn lại là phép tính theo kích thước màn hình.
 */

export interface AuthLayoutOptions {
  touch?: number;
}

/** Biến thể chữ tiêu đề của bốn màn (và màn Kiểm tra hộp thư). */
export const AUTH_TITLE_VARIANT = 'screenTitle' as const;
/** Biến thể chữ nội dung thẻ "Mẹo". */
export const TIP_BODY_VARIANT = 'formBody' as const;

const TITLE = typography[AUTH_TITLE_VARIANT];
const BODY = typography.body;
const TIP_BODY = typography[TIP_BODY_VARIANT];

/** Đệm thẻ "Mẹo" và khối "Mật khẩu nên có" (component dùng chính giá trị này). */
export const TIP_CARD_PADDING = layout.space.md;
export const RULES_CARD_PADDING = layout.space.md;
/** Ô số của màn Nhập mã: cao như ô nhập chuẩn, thấp hơn khi ô hẹp nhưng không dưới vùng chạm. */
export const OTP_BOX_HEIGHT = layout.component.field.minHeight;
export const FIELD_HINT_MARGIN = layout.space.tight;
/** Biểu tượng thẻ "Mẹo" + khoảng cách tới chữ. */
const TIP_ICON_AND_GAP = layout.icon.lg + layout.space.md;

/** Chiều cao tối đa của hình minh họa từng màn (dp, hình co lại trước khi ẩn). */
export const SIGN_IN_ILLUSTRATION_MAX_HEIGHT = 130;
export const FORGOT_ILLUSTRATION_MAX_HEIGHT = 150;
export const OTP_ILLUSTRATION_MAX_HEIGHT = 140;
export const NEW_PASSWORD_ILLUSTRATION_MAX_HEIGHT = 130;

/** Chiều cao thẻ "Mẹo" (đệm + tiêu đề + nội dung); nở theo số dòng và cỡ chữ. */
function tipCardHeight(chars: number, contentWidth: number, scale: number): number {
  const lines = estimateLines(
    { chars, fontSize: TIP_BODY.fontSize },
    contentWidth - 2 * TIP_CARD_PADDING - TIP_ICON_AND_GAP,
    scale,
  );
  return (
    2 * TIP_CARD_PADDING +
    BODY.lineHeight * scale +
    layout.space.xxs +
    lines * TIP_BODY.lineHeight * scale
  );
}

const titleLinesOf = (chars: number, contentWidth: number, scale: number) =>
  estimateLines({ chars, fontSize: TITLE.fontSize, bold: true }, contentWidth, scale);
const bodyLinesOf = (chars: number, contentWidth: number, scale: number) =>
  estimateLines({ chars, fontSize: BODY.fontSize }, contentWidth, scale);

const fieldHeightOf = (compact: boolean) => (compact ? 58 : 64);
const fieldBlock = (compact: boolean, scale: number) =>
  growHeight(fieldHeightOf(compact), CAPTION_LINE_HEIGHT + BODY_LINE_HEIGHT, 16, scale);
const buttonBlock = (scale: number) => growHeight(BUTTON_HEIGHT, BODY_LINE_HEIGHT, 20, scale);
const linkBlock = (touch: number) => Math.max(LINK_ROW_HEIGHT, touch);

const { space } = layout;

/* ------------------------------------------------------------------ UI-A03 đăng nhập */

export interface SignInLayout extends OnboardingLayoutBase {
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
  const gaps = b.compact
    ? {
        top: space.md,
        logoToTitle: space.md,
        titleToSubtitle: space.xs,
        toFields: space.md,
        betweenFields: space.sm,
      }
    : {
        top: space.xl,
        logoToTitle: space.lg,
        titleToSubtitle: space.tight,
        toFields: space.lg,
        betweenFields: space.md,
      };
  const success = options.successChars
    ? estimateBannerHeight({ chars: options.successChars }, b.contentWidth, b.scale, touch, 0) +
      space.md
    : 0;
  const fixed =
    gaps.top +
    (b.compact ? SIGN_IN_COMPACT_LOGO_HEIGHT : SIGN_IN_LOGO_HEIGHT) +
    gaps.logoToTitle +
    titleLinesOf(22, b.contentWidth, b.scale) * TITLE.lineHeight * b.scale +
    gaps.titleToSubtitle +
    bodyLinesOf(48, b.contentWidth, b.scale) * BODY.lineHeight * b.scale +
    gaps.toFields +
    success +
    2 * fieldBlock(b.compact, b.scale) +
    gaps.betweenFields +
    estimateFieldErrorHeight(errors.email, b.contentWidth, b.scale, touch) +
    estimateFieldErrorHeight(errors.password, b.contentWidth, b.scale, touch) +
    linkBlock(touch) +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, space.md) +
    buttonBlock(b.scale) +
    (options.showSocial
      ? space.lg + CAPTION_LINE_HEIGHT * b.scale + space.md + SOCIAL_BUTTON_HEIGHT
      : 0) +
    space.sm +
    growHeight(
      LINK_ROW_HEIGHT,
      bodyLinesOf(34, b.contentWidth, b.scale) * BODY.lineHeight,
      space.sm,
      b.scale,
    );
  const fin = finishLayout(b, fixed, {
    maxHeight: SIGN_IN_ILLUSTRATION_MAX_HEIGHT,
    chrome: space.sm,
  });
  return { ...b, ...fin, fieldHeight: fieldHeightOf(b.compact), gaps };
}

/* ------------------------------------------------------------------ UI-A07 quên mật khẩu */

export interface ForgotLayout extends OnboardingLayoutBase {
  fieldHeight: number;
  gaps: {
    afterHeader: number;
    illustrationToTitle: number;
    titleToDescription: number;
    toField: number;
    toButton: number;
  };
}

/** Số ký tự mô tả mặc định của UI-A07 (câu "gửi mã xác minh" của chế độ `otp`). */
export const FORGOT_DESCRIPTION_CHARS = 62;

export interface ForgotOptions extends AuthLayoutOptions {
  errors?: { email?: FieldErrorSpec; banner?: BannerErrorSpec };
  /**
   * Độ dài câu mô tả đang hiện (khác theo `PASSWORD_RECOVERY_MODE`, V1-03); mặc định
   * `FORGOT_DESCRIPTION_CHARS`. Câu dài hơn thì hình nhường chỗ trước.
   */
  descriptionChars?: number;
}

export function computeForgotLayout(
  input: OnboardingLayoutInput,
  options: ForgotOptions = {},
): ForgotLayout {
  const b = layoutBase(input);
  const touch = options.touch ?? 48;
  const errors = options.errors ?? {};
  const gaps = b.compact
    ? {
        afterHeader: 0,
        illustrationToTitle: space.sm,
        titleToDescription: space.tight,
        toField: space.md,
        toButton: space.md,
      }
    : {
        afterHeader: space.sm,
        illustrationToTitle: space.lg,
        titleToDescription: space.sm,
        toField: space.xl,
        toButton: space.lg,
      };
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterHeader +
    gaps.illustrationToTitle +
    titleLinesOf(33, b.contentWidth, b.scale) * TITLE.lineHeight * b.scale +
    gaps.titleToDescription +
    bodyLinesOf(options.descriptionChars ?? FORGOT_DESCRIPTION_CHARS, b.contentWidth, b.scale) *
      BODY.lineHeight *
      b.scale +
    gaps.toField +
    fieldBlock(b.compact, b.scale) +
    (errors.email
      ? estimateFieldErrorHeight(errors.email, b.contentWidth, b.scale, touch)
      : FIELD_HINT_MARGIN + CAPTION_LINE_HEIGHT * b.scale) +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, space.md) +
    gaps.toButton +
    buttonBlock(b.scale) +
    linkBlock(touch) +
    space.md +
    tipCardHeight(58, b.contentWidth, b.scale);
  const fin = finishLayout(b, fixed, { maxHeight: FORGOT_ILLUSTRATION_MAX_HEIGHT, chrome: 0 });
  return { ...b, ...fin, fieldHeight: fieldHeightOf(b.compact), gaps };
}

/* ------------------------------------------------------------------ UI-A08 nhập mã */

export interface OtpLayout extends OnboardingLayoutBase {
  /** Cỡ ô số: rộng x cao và khoảng cách giữa các ô (chữ số dùng biến thể `numeric`). */
  box: { width: number; height: number; gap: number };
  gaps: {
    afterHeader: number;
    illustrationToTitle: number;
    titleToDescription: number;
    /** Từ hàng "Không phải email của bạn?" tới hàng ô số. */
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
  const gaps = b.compact
    ? {
        afterHeader: 0,
        illustrationToTitle: space.sm,
        titleToDescription: space.tight,
        toBoxes: space.xs,
        toButton: space.md,
      }
    : {
        afterHeader: space.sm,
        illustrationToTitle: space.lg,
        titleToDescription: space.sm,
        toBoxes: space.md,
        toButton: space.md,
      };
  // 6 ô chia đều bề rộng, cách nhau `gap`; cao bằng ô nhập chuẩn (thấp hơn khi ô hẹp, không dưới vùng chạm)
  const gap = b.narrow ? space.sm : space.md;
  const width = Math.floor((b.contentWidth - 5 * gap) / 6);
  const box = {
    width,
    height: Math.min(OTP_BOX_HEIGHT, Math.max(touch, Math.round(width * 1.2))),
    gap,
  };
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterHeader +
    gaps.illustrationToTitle +
    titleLinesOf(27, b.contentWidth, b.scale) * TITLE.lineHeight * b.scale +
    gaps.titleToDescription +
    bodyLinesOf(74, b.contentWidth, b.scale) * BODY.lineHeight * b.scale +
    linkBlock(touch) +
    gaps.toBoxes +
    Math.max(box.height, box.height * Math.min(b.scale, 1.3)) +
    estimateFieldErrorHeight(options.fieldError, b.contentWidth, b.scale, touch) +
    (options.notice ? space.sm + 2 * space.md + BODY.lineHeight * b.scale : 0) +
    estimateBannerHeight(options.banner, b.contentWidth, b.scale, touch, space.md) +
    space.sm +
    linkBlock(touch) +
    gaps.toButton +
    buttonBlock(b.scale) +
    space.md +
    tipCardHeight(84, b.contentWidth, b.scale);
  const fin = finishLayout(b, fixed, { maxHeight: OTP_ILLUSTRATION_MAX_HEIGHT, chrome: 0 });
  return { ...b, ...fin, box, gaps };
}

/* ------------------------------------------------------------------ UI-A09 mật khẩu mới */

export interface NewPasswordLayout extends OnboardingLayoutBase {
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
  const gaps = b.compact
    ? {
        afterHeader: 0,
        illustrationToTitle: space.tight,
        titleToDescription: space.tight,
        toFields: space.md,
        betweenFields: space.sm,
        toRules: space.sm,
        toButton: space.md,
      }
    : {
        afterHeader: space.sm,
        illustrationToTitle: space.lg,
        titleToDescription: space.sm,
        toFields: space.xl,
        betweenFields: space.lg,
        toRules: space.lg,
        toButton: space.lg,
      };
  const fixed =
    BACK_ROW_HEIGHT +
    gaps.afterHeader +
    gaps.illustrationToTitle +
    titleLinesOf(18, b.contentWidth, b.scale) * TITLE.lineHeight * b.scale +
    gaps.titleToDescription +
    bodyLinesOf(80, b.contentWidth, b.scale) * BODY.lineHeight * b.scale +
    gaps.toFields +
    2 * fieldBlock(b.compact, b.scale) +
    gaps.betweenFields +
    estimateFieldErrorHeight(errors.password, b.contentWidth, b.scale, touch) +
    estimateFieldErrorHeight(errors.confirm, b.contentWidth, b.scale, touch) +
    gaps.toRules +
    2 * RULES_CARD_PADDING +
    (CAPTION_LINE_HEIGHT + BODY.lineHeight) * b.scale +
    space.tight +
    estimateBannerHeight(errors.banner, b.contentWidth, b.scale, touch, space.md) +
    gaps.toButton +
    buttonBlock(b.scale);
  const fin = finishLayout(b, fixed, {
    maxHeight: NEW_PASSWORD_ILLUSTRATION_MAX_HEIGHT,
    chrome: 0,
  });
  return { ...b, ...fin, fieldHeight: fieldHeightOf(b.compact), gaps };
}
