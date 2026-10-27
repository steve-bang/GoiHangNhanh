import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps {
  /** Nhãn cụ thể (ví dụ "Giữ video và quay lại"), tránh "OK"/"Tiếp tục" mơ hồ (docs/09 mục 3). */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  /** Đang xử lý: khóa nút (chống bấm đúp), hiện vòng xoay, báo "đang bận" cho trình đọc màn hình. */
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

/** Cao tối thiểu của nút chính: lớn hơn vùng chạm tối thiểu để bấm một tay. */
const PRIMARY_MIN_HEIGHT = 56;

/**
 * Nút chính / phụ / phá hủy. Chiều cao chỉ có `minHeight` (không cố định) để không vỡ bố cục khi
 * chữ lớn; nhãn tự xuống dòng. Đỏ chỉ dùng cho `destructive`.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const palette = {
    primary: { bg: colors.brand, fg: colors.onBrand, border: colors.brand },
    secondary: { bg: colors.surface, fg: colors.brand, border: colors.brand },
    destructive: { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
  }[variant];
  const minHeight = Math.max(getMinTouchTarget(), variant === 'primary' ? PRIMARY_MIN_HEIGHT : 0);

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
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          opacity: disabled ? 0.45 : loading ? 0.8 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : icon ? (
          <Icon name={icon} color={palette.fg} />
        ) : null}
        <Text bold style={[styles.label, { color: palette.fg }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { textAlign: 'center', flexShrink: 1 },
});
