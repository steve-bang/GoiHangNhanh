import { View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from './theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
}

/** Khối giữ chỗ khi đang tải. Tĩnh (không hiệu ứng lấp lánh): không thêm hiệu ứng trang trí. */
export function Skeleton({ width = '100%', height = 16 }: SkeletonProps) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('common:loading')}
      accessibilityState={{ busy: true }}
      style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.border }}
    />
  );
}

/** Thẻ giữ chỗ cho danh sách đơn/tệp (cỡ gọn, cùng nhịp với thẻ đơn). */
export function SkeletonCard() {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Skeleton width="45%" height={18} />
      <Skeleton width="80%" />
      <Skeleton width="35%" />
    </View>
  );
}
