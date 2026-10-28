/**
 * Tầng 1 - giá trị gốc của design system (docs/design-token-spec.md mục 4). ĐÂY LÀ NƠI DUY NHẤT
 * viết mã màu và các thang số; tầng ngữ nghĩa (semantic.ts) và thành phần (components.ts) chỉ tham
 * chiếu. Tên theo họ màu + độ đậm, KHÔNG theo vai trò hay màn hình. Giá trị lấy nguyên từ bảng
 * `colors` đang chạy (không có màu mới): đổi giá trị ở đây là đổi giao diện.
 */
export const palette = {
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
