import { View } from 'react-native';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

type StatTone = 'success' | 'info' | 'brand' | 'danger';

interface StatTileProps {
  value: number;
  /** Nhãn chữ luôn có: màu và biểu tượng chỉ hỗ trợ, không là tín hiệu duy nhất. */
  label: string;
  icon: IconName;
  tone: StatTone;
  onPress?: () => void;
  testID?: string;
}

/** Ô thống kê nhỏ (Trang chủ): số lớn + nhãn trạng thái; chạm để xem chi tiết. */
export function StatTile({ value, label, icon, tone, onPress, testID }: StatTileProps) {
  const { tokens } = useTheme();
  const palette = {
    success: { fg: tokens.color.feedback.success.fg, bg: tokens.color.feedback.success.bg },
    info: { fg: tokens.color.feedback.info.fg, bg: tokens.color.feedback.info.bg },
    brand: { fg: tokens.color.brand.onSoft, bg: tokens.color.brand.soft },
    danger: { fg: tokens.color.feedback.danger.fg, bg: tokens.color.feedback.danger.bg },
  }[tone];
  return (
    <Card
      testID={testID}
      {...(onPress ? { onPress } : {})}
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        borderColor: palette.bg,
        padding: tokens.space.md,
      }}
    >
      <View style={{ gap: tokens.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs }}>
          <Icon name={icon} size={20} color={palette.fg} />
          <Text variant="numeric" style={{ color: palette.fg }}>
            {value}
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>
    </Card>
  );
}
