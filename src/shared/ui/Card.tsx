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
  /** Padding nhỏ (`tokens.space.md`) cho khối thông tin dày của nhóm màn form. */
  compact?: boolean;
  /**
   * Không padding: dành cho thẻ chứa các hàng tự lo lề (`ListItem`, `ListGroup`). Tránh lề đôi
   * (padding thẻ + padding hàng). Bo góc cắt nội dung con để hàng chạm không tràn khỏi viền thẻ.
   */
  flush?: boolean;
}

/** Thẻ: nền sáng, viền mảnh, bo vừa phải, không đổ bóng (docs/09 mục 3). */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  tone = 'default',
  style,
  testID,
  compact = false,
  flush = false,
}: CardProps) {
  const { tokens } = useTheme();
  const background = {
    default: tokens.color.surface.raised,
    brand: tokens.color.brand.soft,
    warning: tokens.color.feedback.warning.bg,
    danger: tokens.color.feedback.danger.bg,
  }[tone];
  const base = {
    backgroundColor: background,
    borderColor: tokens.color.border.default,
    borderWidth: tokens.borderWidth.thin,
    borderRadius: tokens.radius.md,
    padding: flush ? 0 : compact ? tokens.space.md : tokens.space.lg,
    ...(flush ? { overflow: 'hidden' as const } : null),
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
        { minHeight: getMinTouchTarget(), opacity: pressed ? tokens.opacity.pressed : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
