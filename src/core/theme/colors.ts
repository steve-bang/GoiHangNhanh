/**
 * Màu theo vai trò (docs/09 mục 3). Giá trị hex là TẠM THỜI: docs/09 chỉ mô tả bằng lời
 * ("xanh rừng", "trắng ngà"...) và yêu cầu kiểm tra tương phản trước khi chốt; chưa có Figma.
 * Thay giá trị tại đây khi thiết kế chốt; test tương phản (colors.test.ts) sẽ cảnh báo nếu tụt chuẩn.
 *
 * Quy tắc: màu không bao giờ là tín hiệu duy nhất - luôn đi kèm chữ + biểu tượng.
 * Đỏ chỉ dùng cho lỗi, hành động phá hủy, nguy cơ mất dữ liệu.
 */
export const colors = {
  brand: '#1F5F3F', // xanh rừng
  onBrand: '#FFFFFF',
  background: '#FAF8F2', // trắng ngà
  surface: '#FFFFFF',
  text: '#1B1B1B',
  textMuted: '#5A5F5C',
  border: '#D9D6CC',
  success: '#1E7A3C', // xanh thành công
  onSuccess: '#FFFFFF',
  warning: '#B45309', // cam cảnh báo / đang chờ (đủ tương phản làm chữ trên nền sáng)
  danger: '#B3261E', // đỏ - chỉ cho lỗi / phá hủy / nguy cơ mất dữ liệu
  onDanger: '#FFFFFF',
  // Nền nhạt cho thẻ/khối thông tin; luôn đi kèm chữ + biểu tượng (màu không là tín hiệu duy nhất).
  brandSoft: '#E6F0E9',
  successSoft: '#E3F1E7',
  warningSoft: '#FDF3E7',
  dangerSoft: '#FCEBEA',
  // Lớp phủ hộp thoại/bottom sheet và nền khung camera (không phải giao diện sáng/tối chung).
  scrim: 'rgba(0, 0, 0, 0.5)',
  cameraBackground: '#16201A',
  onCamera: '#FFFFFF',
} as const;

export type ColorRole = keyof typeof colors;
