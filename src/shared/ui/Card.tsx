import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { useTheme } from './theme';

interface CardProps {
  children: ReactNode;
  /** Có `onPress` thì cả thẻ là một vùng chạm (đọc thành một nút). */
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: 'default' | 'brand' | 'warning' | 'danger';
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

/** Thẻ: nền sáng, viền mảnh, bo vừa phải, không đổ bóng (docs/09 mục 3). */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  tone = 'default',
  style,
  testID,
}: CardProps) {
  const { colors, spacing, radius } = useTheme();
  const background = {
    default: colors.surface,
    brand: colors.brandSoft,
    warning: colors.warningSoft,
    danger: colors.dangerSoft,
  }[tone];
  const base = {
    backgroundColor: background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  } as const;

  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      style={({ pressed }) => [
        base,
        { minHeight: getMinTouchTarget(), opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
