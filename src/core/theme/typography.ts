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
   * dùng qua `Screen form`. Vẫn co giãn theo cỡ chữ hệ thống. Không dùng cho thông tin cảnh báo quan
   * trọng ở cỡ nhỏ hơn caption (decisions.md Q-17).
   */
  formTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  formLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  formBody: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  formButton: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  formButtonSmall: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  /** Chữ nhỏ trên lớp phủ camera (khối mã đơn/kiện); không dùng ngoài màn quay. */
  overlay: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
} as const;

export const MIN_TOUCH_TARGET = {
  ios: 44,
  android: 48,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
