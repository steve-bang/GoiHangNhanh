import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
  icon?: IconName;
  testID?: string;
}

/**
 * Nhãn trạng thái CHUNG (ví dụ "Sắp có", "Chưa khả dụng", "Đang dùng"). KHÔNG dùng cho trạng thái
 * bằng chứng: đó là việc của `EvidenceStatusBadge` (6 nhãn docs/09 mục 3). Luôn có chữ (màu không là
 * tín hiệu duy nhất); `success` chỉ dành cho việc máy chủ đã xác nhận.
 */
export function StatusBadge({ label, tone = 'neutral', icon, testID }: StatusBadgeProps) {
  const { tokens } = useTheme();
  const { feedback } = tokens.color;
  const scheme = {
    neutral: {
      fg: tokens.color.text.secondary,
      bg: tokens.color.surface.muted,
      border: tokens.color.border.default,
    },
    info: {
      fg: tokens.color.text.primary,
      bg: feedback.info.bg,
      border: tokens.color.border.default,
    },
    success: { fg: feedback.success.fg, bg: feedback.success.bg, border: feedback.success.fg },
    warning: { fg: feedback.warning.fg, bg: feedback.warning.bg, border: feedback.warning.fg },
    danger: { fg: feedback.danger.fg, bg: feedback.danger.bg, border: feedback.danger.fg },
  }[tone];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[
        styles.pill,
        {
          alignSelf: 'flex-start',
          gap: tokens.space.tight,
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
          borderWidth: tokens.borderWidth.thin,
          borderRadius: tokens.radius.lg,
          paddingHorizontal: tokens.space.md,
          paddingVertical: tokens.space.xs,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={scheme.fg} /> : null}
      <Text variant="caption" bold style={{ color: scheme.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center' },
});
