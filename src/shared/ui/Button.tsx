import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';
import { layout } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';
export type ButtonSize = 'regular' | 'compact' | 'slim';

interface ButtonProps {
  /** Nhãn cụ thể (ví dụ "Giữ video và quay lại"), tránh "OK"/"Tiếp tục" mơ hồ (docs/09 mục 3). */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  /**
   * `regular` (mặc định); `compact`: nút chính của màn form (14sp, nửa đậm); `slim`: nút phụ thấp
   * hơn, viền mảnh, chữ nhỏ hơn (mockup 03). Mọi cỡ vẫn >= vùng chạm tối thiểu.
   */
  size?: ButtonSize;
  /** Chỉ cho `destructive`: nền trắng, viền và chữ đỏ (nút phá hủy thứ yếu, ví dụ trong hộp xác nhận). */
  outlined?: boolean;
  disabled?: boolean;
  /** Đang xử lý: khóa nút (chống bấm đúp), hiện vòng xoay, báo "đang bận" cho trình đọc màn hình. */
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

/** Cao tối thiểu nút chính/compact: lớn hơn vùng chạm tối thiểu để bấm một tay (token `button`). */
const { minHeight: MIN_HEIGHT, borderWidth: BORDER_WIDTH } = layout.component.button;

/**
 * Nút chính / phụ / phá hủy. Chiều cao chỉ có `minHeight` (không cố định) để không vỡ bố cục khi
 * chữ lớn; nhãn tự xuống dòng. Đỏ chỉ dùng cho `destructive`.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'regular',
  outlined = false,
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const slim = size === 'slim';
  const palette = {
    primary: { bg: colors.brand, fg: colors.onBrand, border: colors.brand },
    secondary: slim
      ? { bg: colors.surface, fg: colors.ink, border: colors.fieldBorder }
      : { bg: colors.surface, fg: colors.brand, border: colors.brand },
    destructive: outlined
      ? { bg: colors.surface, fg: colors.danger, border: colors.danger }
      : { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
  }[variant];
  const touch = getMinTouchTarget();
  const minHeight =
    size === 'regular'
      ? Math.max(touch, variant === 'primary' ? MIN_HEIGHT.primary : 0)
      : slim
        ? touch
        : Math.max(touch, MIN_HEIGHT.compact);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.md,
          borderWidth: slim ? BORDER_WIDTH.slim : BORDER_WIDTH.regular,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          opacity: disabled
            ? layout.opacity.disabled
            : loading
              ? layout.opacity.busy
              : pressed
                ? layout.opacity.pressed
                : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : icon ? (
          <Icon name={icon} color={palette.fg} />
        ) : null}
        <Text
          {...(size === 'regular'
            ? { bold: true }
            : { variant: slim ? ('formButtonSmall' as const) : ('formButton' as const) })}
          style={[styles.label, { color: palette.fg }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: BORDER_WIDTH.regular,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.space.sm,
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
