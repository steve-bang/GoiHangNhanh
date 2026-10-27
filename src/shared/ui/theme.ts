import { colors, components, radius, semantic, spacing, typography } from '@/core/theme';

/**
 * Điểm truy cập token cho component. Hiện chỉ có chế độ sáng; chế độ tối là câu hỏi mở O-17.
 * Component luôn lấy token qua `useTheme()` để khi O-17 được chốt chỉ cần đổi hook này theo
 * `useColorScheme`, không sửa từng component.
 *
 * - `tokens`: tầng ngữ nghĩa + thành phần (`docs/design-token-spec.md`). DÙNG CHO MÀN TRONG APP.
 * - `colors, spacing, radius, typography`: bảng cũ, giữ nguyên cho các màn đã được khách hàng xác
 *   nhận (Splash, đăng nhập/đăng ký, khôi phục mật khẩu, thiết lập). Không dùng cho mã mới trong app.
 */
const lightTheme = {
  colors,
  spacing,
  radius,
  typography,
  tokens: { ...semantic, component: components },
} as const;

export type Theme = typeof lightTheme;

export function useTheme(): Theme {
  return lightTheme;
}
