/**
 * Màu theo vai trò (docs/09 mục 3). Giá trị hex là TẠM THỜI: docs/09 chỉ mô tả bằng lời
 * ("xanh rừng", "trắng ngà"...) và yêu cầu kiểm tra tương phản trước khi chốt; chưa có Figma.
 * Thay giá trị tại đây khi thiết kế chốt; test tương phản (colors.test.ts) sẽ cảnh báo nếu tụt chuẩn.
 *
 * Quy tắc: màu không bao giờ là tín hiệu duy nhất - luôn đi kèm chữ + biểu tượng.
 * Đỏ chỉ dùng cho lỗi, hành động phá hủy, nguy cơ mất dữ liệu.
 */
export const colors = {
  brand: '#157852', // xanh rừng (khớp màu nút chính trong mockup docs/assets/ui/01-onboarding.png)
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
  // Màn Chào mừng (docs/09 mục 5.1): nền xanh nhạt, mảng loang góc, chữ tiêu đề xanh rừng đậm.
  brandDark: '#14382A',
  welcomeBackground: '#F2F9F4',
  welcomeBlob: '#E1F1E6',
  borderSubtle: '#E2E7E4',
  // Màn thiết lập tài khoản/shop (UI-A03, A04, A06; mockup 01-onboarding): nền gần trắng pha xanh,
  // chữ tiêu đề xanh đen, chữ phụ xám xanh, viền ô nhập xanh nhạt.
  ink: '#0E2B3F',
  inkMuted: '#566B7C',
  onboardingBackground: '#F8FCF9',
  fieldBorder: '#D3E3DE',
  // Nền nhạt cho thẻ/khối thông tin; luôn đi kèm chữ + biểu tượng (màu không là tín hiệu duy nhất).
  brandSoft: '#E6F0E9',
  successSoft: '#E3F1E7',
  warningSoft: '#FDF3E7',
  dangerSoft: '#FCEBEA',
  // Màn Splash (UI-A01; ảnh thiết kế docs/assets/ui/06-splash-design.png, màu đo từ ảnh). Cũng là
  // màu nền của splash hệ điều hành (app.json, plugin expo-splash-screen): đổi thì đổi cả hai nơi.
  splashBackground: '#F7FAF8',
  splashBlob: '#EAF6EE', // hình loang nền
  splashWave: '#14705B', // sóng đáy, đầu trên
  splashWaveDeep: '#0C6753', // sóng đáy, đầu dưới
  splashWaveLight: '#B8D8C3', // dải sóng sáng phía trên sóng đậm
  onSplashWave: '#FFFFFF', // chữ viết tay trên sóng
  splashLogo: '#026D50', // khiên (nửa sáng)
  splashLogoDark: '#014B37', // khiên (nửa tối, nếp gấp)
  splashWordmark: '#055E47',
  splashTagline: '#0A6550',
  splashFeatureLabel: '#0B4A3B',
  splashFeatureIcon: '#0A6B52',
  splashFeatureDisc: '#E3F6EC',
  splashDivider: '#DCE8E1',
  // Lớp phủ hộp thoại/bottom sheet và nền khung camera (không phải giao diện sáng/tối chung).
  scrim: 'rgba(0, 0, 0, 0.5)',
  cameraBackground: '#16201A',
  onCamera: '#FFFFFF',
  // Màn quét (UI-B02; mockup 02): khung ngắm xanh sáng, nút phụ mờ trên nền camera.
  scanAccent: '#35E0A1',
  onCameraMuted: 'rgba(255, 255, 255, 0.75)',
  cameraControl: 'rgba(0, 0, 0, 0.55)',
} as const;

export type ColorRole = keyof typeof colors;
