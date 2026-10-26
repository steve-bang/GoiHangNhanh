import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import type { ColorRole } from '@/core/theme';

import { useTheme } from './theme';

export type TextVariant = 'screenTitle' | 'sectionTitle' | 'body' | 'caption';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorRole;
  bold?: boolean;
}

/**
 * Chữ theo typography của design system. Không khóa `allowFontScaling`: tôn trọng Dynamic Type /
 * font scale (docs/09 mục 3); bố cục phải co giãn theo, không cắt chữ.
 */
export function Text({ variant = 'body', color = 'text', bold, style, ...rest }: TextProps) {
  const { typography, colors } = useTheme();
  return (
    <RNText
      {...rest}
      accessibilityRole={
        rest.accessibilityRole ?? (variant === 'screenTitle' ? 'header' : undefined)
      }
      style={[
        typography[variant],
        { color: colors[color] },
        bold ? { fontWeight: '700' } : null,
        style,
      ]}
    />
  );
}
