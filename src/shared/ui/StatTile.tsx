import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Skeleton } from './Skeleton';
import { Text } from './Text';
import { useTheme } from './theme';

type StatTone = 'success' | 'info' | 'brand' | 'danger';

interface StatTileProps {
  /** Số đếm; chuỗi (ví dụ "–") khi chưa có số: đang đọc hoặc đọc lỗi, không hiện 0 giả. */
  value: number | string;
  /** Nhãn chữ luôn có: màu và biểu tượng chỉ hỗ trợ, không là tín hiệu duy nhất. */
  label: string;
  icon: IconName;
  tone: StatTone;
  /** Đang đọc số: hiện khối giữ chỗ thay cho số, đọc là "Đang tải" (không hiện 0 giả). */
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
}

/** Ô thống kê nhỏ (Trang chủ): số lớn + nhãn trạng thái; chạm để xem chi tiết. */
export function StatTile({
  value,
  label,
  icon,
  tone,
  loading = false,
  onPress,
  testID,
}: StatTileProps) {
  const { t } = useTranslation();
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
      accessibilityLabel={`${label}: ${loading ? t('common:loading') : value}`}
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        borderColor: palette.bg,
        padding: tokens.space.md,
      }}
    >
      <View style={{ gap: tokens.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs }}>
          <Icon name={icon} size={tokens.icon.md} color={palette.fg} />
          {loading ? (
            <Skeleton width={tokens.space.xl * 2} height={tokens.space.xl} />
          ) : (
            <Text variant="numeric" style={{ color: palette.fg }}>
              {value}
            </Text>
          )}
        </View>
        <Text variant="caption" color="text">
          {label}
        </Text>
      </View>
    </Card>
  );
}
