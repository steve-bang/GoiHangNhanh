/**
 * Tầng 1 - giá trị gốc của design system (docs/design-token-spec.md mục 4). ĐÂY LÀ NƠI DUY NHẤT
 * viết mã màu và các thang số; tầng ngữ nghĩa (semantic.ts) và thành phần (components.ts) chỉ tham
 * chiếu. Tên theo họ màu + độ đậm, KHÔNG theo vai trò hay màn hình. Giá trị lấy nguyên từ bảng
 * `colors` đang chạy (không có màu mới): đổi giá trị ở đây là đổi giao diện.
 */
export const palette = {
  /**
   * Bright Orange (v3): màu thương hiệu của màn trong app. Họ `jade` bên dưới được GIỮ cho bảng màu cũ
   * đóng băng (`colors.ts`: Splash, đăng nhập, thiết lập đã khách xác nhận); màn trong app không đọc nó.
   * 600 = màu nhận diện (biểu tượng, nút Quét, thanh tiến độ: đồ họa >= 3:1). 700 = nền nút chính và
   * liên kết: là sắc cam SÁNG NHẤT cho chữ trắng đạt 4.5:1 (trắng trên 600 chỉ 3.66:1). 800 = chữ cam
   * trên nền cam nhạt và trạng thái nhấn. 900 = nền thương hiệu đậm.
   */
  orange: {
    50: '#FFF1EC',
    100: '#FCE5DE',
    500: '#FF6A45',
    600: '#EE4D2D',
    700: '#D93B20',
    800: '#B02E17',
    900: '#7C2D12',
  },
  /** Trung tính ấm đi cùng Bright Orange (nền, chữ, đường viền). */
  stone: {
    25: '#FFFAF7',
    50: '#FFF5F0',
    200: '#F0E4DE',
    300: '#D8CBC3',
    400: '#9A938D',
    500: '#746D68',
    900: '#292524',
  },
  /** Màu trạng thái nghiệp vụ (v3): xanh lá, đỏ, xanh dương; vàng cam dùng `amber`. */
  leaf: { 700: '#15803D', 100: '#DCFCE7' },
  ember: { 700: '#B91C1C', 100: '#FEE2E2', 50: '#FEF2F2' },
  sky: { 700: '#0369A1', 100: '#E0F2FE', 50: '#F0F9FF' },
  jade: { 950: '#14382A', 700: '#157852', 100: '#E6F0E9' },
  green: { 700: '#1E7A3C', 100: '#E3F1E7' },
  amber: { 700: '#B45309', 50: '#FDF3E7' },
  red: { 700: '#B3261E', 50: '#FCEBEA' },
  teal: { 50: '#EAF5F4' },
  blue: { 50: '#E8F0FA', 700: '#1F5EA8' },
  neutral: {
    0: '#FFFFFF',
    50: '#FAF8F2',
    100: '#F3F6F5',
    300: '#D9D6CC',
    600: '#5A5F5C',
    900: '#1B1B1B',
  },
  slate: { 900: '#0E2B3F', 500: '#566B7C' },
  mint: { 200: '#D3E3DE' },
  camera: { 900: '#16201A' },
  scan: { 400: '#35E0A1' },
  black: '#000000',
  alpha: {
    black50: 'rgba(0, 0, 0, 0.5)',
    black55: 'rgba(0, 0, 0, 0.55)',
    white75: 'rgba(255, 255, 255, 0.75)',
  },
} as const;

/** Khoảng cách (dp). Gộp 10->8 và 5->4 khi chuyển đổi (chênh <= 2dp, ghi ở báo cáo migration). */
export const space = { 0: 0, 2: 2, 4: 4, 6: 6, 8: 8, 12: 12, 16: 16, 24: 24 } as const;

/** Cỡ biểu tượng (dp). Cỡ ngoài thang chỉ dùng cho hình minh họa. */
export const iconSizeScale = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

export const radiusScale = { 8: 8, 12: 12, 16: 16, full: 9999 } as const;

/** Độ dày viền. `hairline` (mảnh nhất) phụ thuộc mật độ điểm ảnh nên do `@/platform` cấp. */
export const borderWidthScale = { none: 0, thin: 1, strong: 1.5, emphasis: 2, ring: 4 } as const;

export const opacityScale = { pressed: 0.85, busy: 0.8, disabled: 0.45 } as const;

export const fontWeight = { regular: '400', bold: '700' } as const;

/** Đổ bóng cho phần tử nổi (nút Quét). iOS đọc `shadow*`, Android đọc `elevation`. */
export const elevationScale = {
  floating: {
    elevation: 6,
    shadowColor: palette.black,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
} as const;
