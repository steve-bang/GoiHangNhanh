import { colors, type ColorRole } from './colors';
import { semantic } from './semantic';

/**
 * Bảng màu PHẲNG (khóa như `colors.ts`) cho màn TRONG APP, suy ra từ token ngữ nghĩa Bright Orange.
 * Tồn tại vì `Button`, `Text`, `Icon` dùng chung với màn đã khách xác nhận (đọc `colors` cũ, màu jade):
 * trong `Screen` (`AppThemeScope`) `useTheme().colors` trả bảng này, ngoài `Screen` vẫn là bảng cũ.
 * Khóa không liệt kê ở đây (màu camera, scrim, onCamera…) giữ nguyên giá trị cũ.
 * Không dùng bảng này trong mã mới: đọc `useTheme().tokens`.
 */
const { color } = semantic;

export const appColors: Readonly<Record<ColorRole, string>> = {
  ...colors,
  brand: color.action.primary,
  onBrand: color.text.onAction,
  background: color.surface.screen,
  surface: color.surface.raised,
  text: color.text.primary,
  textMuted: color.text.secondary,
  border: color.border.default,
  success: color.feedback.success.fg,
  onSuccess: color.text.onAction,
  warning: color.feedback.warning.fg,
  danger: color.feedback.danger.fg,
  onDanger: color.text.onAction,
  brandDark: color.brand.deep,
  ink: color.text.strong,
  inkMuted: color.text.subtle,
  fieldBorder: color.border.field,
  brandSoft: color.brand.soft,
  formBackground: color.surface.raised,
  surfaceMuted: color.surface.muted,
  infoSoft: color.feedback.info.bg,
  successSoft: color.feedback.success.bg,
  warningSoft: color.feedback.warning.bg,
  dangerSoft: color.feedback.danger.bg,
};
