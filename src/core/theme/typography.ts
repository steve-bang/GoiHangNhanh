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
} as const;

export const MIN_TOUCH_TARGET = {
  ios: 44,
  android: 48,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
