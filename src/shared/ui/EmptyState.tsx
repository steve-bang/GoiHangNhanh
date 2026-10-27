import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface EmptyStateProps {
  title: string;
  message: string;
  /** Hành động CỤ THỂ cho bước tiếp theo (docs/09 mục 3: empty state có hành động cụ thể). */
  actionLabel: string;
  onAction: () => void;
  icon?: IconName;
  /** Cỡ gọn của nhóm màn form: icon 32, tiêu đề 15sp đậm, mô tả 14sp, nút `slim`. */
  compact?: boolean;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'inbox',
  compact = false,
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  if (compact) {
    return (
      <View style={[styles.container, { gap: spacing.sm, padding: spacing.lg }]}>
        <Icon name={icon} size={32} color={colors.textMuted} />
        <Text bold style={styles.centered}>
          {title}
        </Text>
        <Text variant="formBody" color="inkMuted" style={styles.centered}>
          {message}
        </Text>
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="slim" />
      </View>
    );
  }
  return (
    <View style={[styles.container, { gap: spacing.md, padding: spacing.xl }]}>
      <Icon name={icon} size={40} color={colors.textMuted} />
      <Text variant="sectionTitle" style={styles.centered}>
        {title}
      </Text>
      <Text color="textMuted" style={styles.centered}>
        {message}
      </Text>
      <Button label={actionLabel} onPress={onAction} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  centered: { textAlign: 'center' },
});
