import { View } from 'react-native';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

type StatTone = 'success' | 'brand' | 'danger';

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
  const { colors, spacing } = useTheme();
  const palette = {
    success: { fg: colors.success, bg: colors.successSoft },
    brand: { fg: colors.brand, bg: colors.brandSoft },
    danger: { fg: colors.danger, bg: colors.dangerSoft },
  }[tone];
  return (
    <Card
      testID={testID}
      {...(onPress ? { onPress } : {})}
      accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1, backgroundColor: palette.bg, borderColor: palette.bg, padding: spacing.md }}
    >
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name={icon} size={20} color={palette.fg} />
          <Text variant="screenTitle" style={{ color: palette.fg }}>
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
