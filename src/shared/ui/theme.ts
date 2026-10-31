import { createContext, createElement, useContext, type ReactNode } from 'react';

import {
  appColors,
  colors,
  components,
  radius,
  semantic,
  spacing,
  typography,
  type ColorRole,
} from '@/core/theme';

/**
 * Điểm truy cập token cho component. Hiện chỉ có chế độ sáng; chế độ tối là câu hỏi mở O-17.
 * Component luôn lấy token qua `useTheme()` để khi O-17 được chốt chỉ cần đổi hook này theo
 * `useColorScheme`, không sửa từng component.
 *
 * - `tokens`: tầng ngữ nghĩa + thành phần (`docs/design-token-spec.md`). DÙNG CHO MÀN TRONG APP.
 * - `colors, spacing, radius, typography`: bảng cũ, giữ nguyên cho các màn đã được khách hàng xác
 *   nhận (Splash, đăng nhập/đăng ký, khôi phục mật khẩu, thiết lập). Không dùng cho mã mới trong app.
 * - `colors` đổi theo phạm vi: trong `AppThemeScope` (mọi màn dùng `Screen`) là bảng Bright Orange suy từ
 *   `tokens`; ngoài đó là bảng cũ đóng băng. Nhờ vậy `Button`/`Text`/`Icon` dùng chung với màn đã
 *   xác nhận không đổi hiển thị ở đó.
 */
type ThemeScope = 'legacy' | 'app';

const ThemeScopeContext = createContext<ThemeScope>('legacy');

/** Bọc các màn trong app: `useTheme().colors` trả bảng màu Bright Orange. `Screen` đã bọc sẵn. */
export function AppThemeScope({ children }: { children: ReactNode }) {
  return createElement(ThemeScopeContext.Provider, { value: 'app' }, children);
}

const legacyTable: Readonly<Record<ColorRole, string>> = colors;

const tokens = { ...semantic, component: components } as const;
const base = { spacing, radius, typography, tokens } as const;
const legacyTheme = { ...base, colors: legacyTable, scope: 'legacy' as ThemeScope } as const;
const appTheme = { ...base, colors: appColors, scope: 'app' as ThemeScope } as const;

export type Theme = typeof legacyTheme;

export function useTheme(): Theme {
  return useContext(ThemeScopeContext) === 'app' ? appTheme : legacyTheme;
}
