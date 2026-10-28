import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface HeroCardProps {
  /** Dòng nhỏ phía trên (ví dụ "Gói dịch vụ"). */
  eyebrow?: string;
  title: string;
  /** Dòng nhỏ phía dưới tiêu đề. */
  subtitle?: string;
  /** Huy hiệu góc phải trên (ví dụ `StatusBadge`). Tự chịu trách nhiệm trợ năng của nó. */
  badge?: ReactNode;
  /** Chuỗi đọc được của huy hiệu (ví dụ "Sắp có"); nối vào nhãn trợ năng vì thẻ là một phần tử gộp. */
  badgeLabel?: string;
  /** Có `onPress` thì cả thẻ là một nút và có mũi tên phải (trừ khi `showChevron={false}`). */
  onPress?: () => void;
  showChevron?: boolean;
  /** Thay hoàn toàn nhãn mặc định (eyebrow, tiêu đề, phụ đề, `badgeLabel`). */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Thẻ nổi bật nền thương hiệu đậm phẳng (Q-21a: không chuyển sắc, không thư viện). Chữ trắng /
 * trắng mờ (`onBrandMuted`) đều đạt 4.5:1 trên nền. Cao theo nội dung (chỉ `minHeight`) nên chữ lớn
 * không vỡ bố cục.
 */
export function HeroCard({
  eyebrow,
  title,
  subtitle,
  badge,
  badgeLabel,
  onPress,
  showChevron,
  accessibilityLabel,
  testID,
}: HeroCardProps) {
  const { tokens } = useTheme();
  const interactive = onPress !== undefined;
  const chevron = showChevron ?? interactive;
  const spoken =
    accessibilityLabel ?? [eyebrow, title, subtitle, badgeLabel].filter(Boolean).join('. ');

  const content = (
    <>
      <View style={[styles.body, { gap: tokens.space.xs }]}>
        {eyebrow ? (
          <Text variant="caption" style={{ color: tokens.color.text.onBrandMuted }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="sectionTitle" style={{ color: tokens.color.text.onAction }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" style={{ color: tokens.color.text.onBrandMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge || chevron ? (
        <View style={[styles.side, { gap: tokens.space.sm }]}>
          {badge}
          {chevron ? (
            <Icon name="forward" size={20} color={tokens.color.text.onBrandMuted} />
          ) : null}
        </View>
      ) : null}
    </>
  );

  const base = {
    backgroundColor: tokens.color.brand.deep,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  } as const;

  if (!interactive) {
    return (
      <View testID={testID} accessible accessibilityLabel={spoken} style={[styles.row, base]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [
        styles.row,
        base,
        { minHeight: getMinTouchTarget(), opacity: pressed ? tokens.opacity.pressed : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1 },
  side: { alignItems: 'flex-end' },
});
