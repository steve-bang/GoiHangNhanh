import { colors, radius, spacing, typography } from '@/core/theme';

/**
 * Điểm truy cập token cho component. Hiện chỉ có chế độ sáng; chế độ tối là câu hỏi mở O-17.
 * Component luôn lấy màu qua `useTheme()` (không import `colors` trực tiếp) để khi O-17 được chốt
 * chỉ cần đổi hook này theo `useColorScheme`, không sửa từng component.
 */
const lightTheme = { colors, spacing, radius, typography } as const;

export type Theme = typeof lightTheme;

export function useTheme(): Theme {
  return lightTheme;
}
