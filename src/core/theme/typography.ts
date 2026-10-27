import { radiusScale, space } from './primitives';

/**
 * Cỡ chữ và vùng chạm theo docs/09 mục 3. Đơn vị: pt (iOS) / dp (Android) - React Native dùng
 * chung số. Giá trị lấy cận dưới của khoảng nêu trong tài liệu; điều chỉnh khi có thiết kế.
 * Luôn tôn trọng Dynamic Type/font scale của hệ điều hành (không khóa allowFontScaling=false).
 */
export const typography = {
  screenTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  /** Chú thích: không dùng cho thông tin quan trọng. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  /**
   * Nhóm màn "form/quy trình" (Tạo đơn nhanh, Xác nhận đơn; mockup 03): nhỏ và mảnh hơn nhóm trên,
   * dùng qua `Screen form`. Vẫn co giãn theo cỡ chữ hệ thống. NGOẠI LỆ đã ghi ở docs/09 mục 3 (13/14sp
   * dưới mức nội dung 15sp, theo mockup; chờ BA xác nhận): đổi số ở đây phải đổi docs/09 và
   * theme.test.ts cùng lúc. Không dùng cho thông tin cảnh báo quan trọng ở cỡ nhỏ hơn caption.
   */
  formTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  formLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  formBody: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  formButton: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  formButtonSmall: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  /**
   * Chữ trên lớp phủ camera (huy hiệu, khối mã đơn/kiện); không dùng ngoài màn quay. Tối thiểu 12sp
   * như chú thích và KHÔNG co nhỏ hơn bằng `adjustsFontSizeToFit` (mã đơn là thông tin chính).
   */
  overlay: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const;

export const MIN_TOUCH_TARGET = {
  ios: 44,
  android: 48,
} as const;

/** Khoảng cách/bo góc có tên. Giá trị lấy từ `primitives` (khóa cũ giữ nguyên giá trị cho màn đã verify). */
export const spacing = {
  xxs: space[2],
  xs: space[4],
  tight: space[6],
  sm: space[8],
  md: space[12],
  lg: space[16],
  xl: space[24],
} as const;
export const radius = {
  sm: radiusScale[8],
  md: radiusScale[12],
  lg: radiusScale[16],
  full: radiusScale.full,
} as const;
