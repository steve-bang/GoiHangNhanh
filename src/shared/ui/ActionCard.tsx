import { StyleSheet, View } from 'react-native';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { layout } from '@/core/theme';

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
  const { tokens } = useTheme();
  const primary = emphasis === 'primary';
  const fg = primary ? tokens.color.text.onAction : tokens.color.text.primary;
  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${title}. ${description}`}
      style={[
        { minHeight: layout.component.actionCard.minHeight, justifyContent: 'center' },
        primary
          ? {
              backgroundColor: tokens.color.action.primary,
              borderColor: tokens.color.action.primary,
            }
          : null,
      ]}
    >
      <View style={[styles.row, { gap: tokens.space.md }]}>
        <Icon
          name={icon}
          size={32}
          color={primary ? tokens.color.text.onAction : tokens.color.brand.primary}
        />
        <View style={styles.text}>
          <Text variant="sectionTitle" style={{ color: fg }}>
            {title}
          </Text>
          <Text
            style={{ color: primary ? tokens.color.text.onAction : tokens.color.text.secondary }}
          >
            {description}
          </Text>
        </View>
        <Icon
          name="forward"
          color={primary ? tokens.color.text.onAction : tokens.color.text.secondary}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: layout.space.xxs },
});
