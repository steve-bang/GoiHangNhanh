import { View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from './theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Hình tròn đường kính `height` (giữ chỗ cho avatar); bỏ qua `width`. */
  circle?: boolean;
}

/** Khối giữ chỗ khi đang tải. Tĩnh (không hiệu ứng lấp lánh): không thêm hiệu ứng trang trí. */
export function Skeleton({ width = '100%', height = 16, circle = false }: SkeletonProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('common:loading')}
      accessibilityState={{ busy: true }}
      style={{
        width: circle ? height : width,
        height,
        borderRadius: circle ? height / 2 : tokens.radius.sm,
        backgroundColor: tokens.color.border.default,
      }}
    />
  );
}

/** Thẻ giữ chỗ cho danh sách đơn/tệp (cùng bố cục thẻ đơn: ô logo bên trái, ba dòng bên phải). */
export function SkeletonCard() {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: tokens.space.md,
        padding: tokens.space.md,
        borderRadius: tokens.radius.md,
        borderWidth: tokens.borderWidth.thin,
        borderColor: tokens.color.border.default,
        backgroundColor: tokens.color.surface.raised,
      }}
    >
      <Skeleton height={tokens.component.tile.md} width={tokens.component.tile.md} />
      <View style={{ flex: 1, gap: tokens.space.sm }}>
        <Skeleton width="45%" height={18} />
        <Skeleton width="80%" />
        <Skeleton width="35%" />
      </View>
    </View>
  );
}
