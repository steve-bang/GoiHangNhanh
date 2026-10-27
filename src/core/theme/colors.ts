import { palette } from './primitives';

/**
 * Bảng màu PHẲNG (cũ). Còn tồn tại vì các màn đã được khách hàng xác nhận (Splash, Đăng nhập, Đăng
 * ký, Quên mật khẩu, OTP, Mật khẩu mới và các màn thiết lập) đọc bảng này: tên khóa và giá trị bị
 * KHÓA bằng `colors.golden.json` (test `colors.test.ts`). Màn trong app dùng `semantic` qua
 * `useTheme().tokens`, không đọc bảng này (ESLint chặn, xem docs/design-token-spec.md mục 7).
 *
 * Mọi khóa dùng chung đều lấy từ `primitives` (một nguồn hex). Khối `@frozen` ở cuối chỉ phục vụ màn
 * đã verify nên giữ hex tại chỗ; không dùng trong màn mới.
 *
 * Quy tắc: màu không bao giờ là tín hiệu duy nhất - luôn đi kèm chữ + biểu tượng.
 * Đỏ chỉ dùng cho lỗi, hành động phá hủy, nguy cơ mất dữ liệu.
 */
export const colors = {
  brand: palette.jade[700],
  onBrand: palette.neutral[0],
  background: palette.neutral[50],
  surface: palette.neutral[0],
  text: palette.neutral[900],
  textMuted: palette.neutral[600],
  border: palette.neutral[300],
  success: palette.green[700],
  onSuccess: palette.neutral[0],
  warning: palette.amber[700],
  danger: palette.red[700],
  onDanger: palette.neutral[0],
  brandDark: palette.jade[950],
  ink: palette.slate[900],
  inkMuted: palette.slate[500],
  fieldBorder: palette.mint[200],
  brandSoft: palette.jade[100],
  formBackground: palette.neutral[0],
  surfaceMuted: palette.neutral[100],
  infoSoft: palette.teal[50],
  successSoft: palette.green[100],
  warningSoft: palette.amber[50],
  dangerSoft: palette.red[50],
  scrim: palette.alpha.black50,
  cameraBackground: palette.camera[900],
  onCamera: palette.neutral[0],
  scanAccent: palette.scan[400],
  onCameraMuted: palette.alpha.white75,
  cameraControl: palette.alpha.black55,

  // @frozen: chỉ màn thiết lập/Splash đã verify dùng; KHÔNG dùng trong màn mới.
  welcomeBackground: '#F2F9F4',
  welcomeBlob: '#E1F1E6',
  borderSubtle: '#E2E7E4',
  onboardingBackground: '#F8FCF9',
  // Splash (UI-A01): cũng là màu nền splash hệ điều hành (app.json): đổi thì đổi cả hai nơi.
  splashBackground: '#F7FAF8',
  splashBlob: '#EAF6EE',
  splashWave: '#14705B',
  splashWaveDeep: '#0C6753',
  splashWaveLight: '#B8D8C3',
  onSplashWave: '#FFFFFF',
  splashLogo: '#026D50',
  splashLogoDark: '#014B37',
  splashWordmark: '#055E47',
  splashTagline: '#0A6550',
  splashFeatureLabel: '#0B4A3B',
  splashFeatureIcon: '#0A6B52',
  splashFeatureDisc: '#E3F6EC',
  splashDivider: '#DCE8E1',
} as const;

export type ColorRole = keyof typeof colors;
