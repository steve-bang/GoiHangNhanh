import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { IconTile } from './IconTile';
import { Text } from './Text';
import { toneColors, type IconTone } from './tone';
import { useTheme } from './theme';

type EmptyStateAction =
  | {
      /** Hành động CỤ THỂ cho bước tiếp theo (docs/09 mục 3: empty state có hành động cụ thể). */
      actionLabel: string;
      onAction: () => void;
    }
  | { actionLabel?: never; onAction?: never };

type EmptyStateProps = EmptyStateAction & {
  title: string;
  message: string;
  icon?: IconName;
  /** Tô biểu tượng theo tông (board 07). Bỏ trống: màu chữ phụ như cũ. */
  iconTone?: IconTone;
  /** Nút hành động chính (nền đặc) thay vì viền. Mặc định `secondary` như cũ. */
  actionVariant?: 'primary' | 'secondary';
  /** Cỡ gọn của nhóm màn form: icon 32, tiêu đề 15sp đậm, mô tả 14sp, nút `slim`. */
  compact?: boolean;
  /** Biểu tượng nằm trong ô tròn nền nhạt theo `iconTone` (mặc định `brand`; mockup tab Đơn hàng ORD-14). */
  iconCircle?: boolean;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'inbox',
  iconTone,
  actionVariant = 'secondary',
  compact = false,
  iconCircle = false,
}: EmptyStateProps) {
  const { tokens } = useTheme();
  const iconColor = iconTone ? toneColors(tokens, iconTone).fg : tokens.color.text.secondary;
  const circle = iconCircle ? (
    <IconTile icon={icon} tone={iconTone ?? 'brand'} size="lg" shape="circle" />
  ) : null;
  if (compact) {
    return (
      <View style={[styles.container, { gap: tokens.space.sm, padding: tokens.space.lg }]}>
        {circle ?? <Icon name={icon} size={32} color={iconColor} />}
        <Text bold style={styles.centered}>
          {title}
        </Text>
        <Text variant="formBody" color="inkMuted" style={styles.centered}>
          {message}
        </Text>
        {actionLabel !== undefined ? (
          <Button label={actionLabel} onPress={onAction} variant={actionVariant} size="slim" />
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.container, { gap: tokens.space.md, padding: tokens.space.xl }]}>
      {circle ?? <Icon name={icon} size={40} color={iconColor} />}
      <Text variant="sectionTitle" style={styles.centered}>
        {title}
      </Text>
      <Text color="textMuted" style={styles.centered}>
        {message}
      </Text>
      {actionLabel !== undefined ? (
        <Button label={actionLabel} onPress={onAction} variant={actionVariant} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  centered: { textAlign: 'center' },
});
