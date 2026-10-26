import { StyleSheet, View } from 'react-native';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface ActionCardProps {
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
  /** `primary`: hành động chính nổi bật của màn (chỉ một). `secondary`: hành động lớn thứ hai. */
  emphasis?: 'primary' | 'secondary';
  testID?: string;
}

/** Nút lớn dạng thẻ (hai tác vụ chính của Tổng quan). Nhãn chữ rõ, không phụ thuộc icon. */
export function ActionCard({
  title,
  description,
  icon,
  onPress,
  emphasis = 'secondary',
  testID,
}: ActionCardProps) {
  const { colors, spacing } = useTheme();
  const primary = emphasis === 'primary';
  const fg = primary ? colors.onBrand : colors.text;
  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${title}. ${description}`}
      style={[
        { minHeight: 88, justifyContent: 'center' },
        primary ? { backgroundColor: colors.brand, borderColor: colors.brand } : null,
      ]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Icon name={icon} size={32} color={primary ? colors.onBrand : colors.brand} />
        <View style={styles.text}>
          <Text variant="sectionTitle" style={{ color: fg }}>
            {title}
          </Text>
          <Text style={{ color: primary ? colors.onBrand : colors.textMuted }}>{description}</Text>
        </View>
        <Icon name="forward" color={primary ? colors.onBrand : colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
