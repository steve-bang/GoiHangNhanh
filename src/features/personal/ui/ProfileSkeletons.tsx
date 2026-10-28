import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { layout } from '@/core/theme';
import { Card, Skeleton, useTheme } from '@/shared/ui';

/**
 * Khung chờ của màn Cá nhân dựng theo hình thật của từng khối (board 07, khung 1b): mỗi khối là một
 * thẻ giữ chỗ cùng bố cục với thẻ thật. Tĩnh, không số liệu. Khối nào chưa có dữ liệu mới dùng khung chờ.
 */
function useBars() {
  const { tokens } = useTheme();
  return { title: tokens.space.lg, line: tokens.space.md, gap: tokens.space.sm };
}

/**
 * Một thẻ khung chờ = MỘT phần tử "Đang tải" cho trình đọc màn hình; các thanh con bị ẩn (tránh nghe
 * hàng chục lần "Đang tải"). Bọc phần ruột của thẻ, không đổi bố cục.
 */
function LoadingGroup({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('common:loading')} accessibilityState={{ busy: true }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </View>
  );
}

/** Thẻ hồ sơ: vòng tròn + ba thanh. */
export function ProfileCardSkeleton({ testID }: { testID?: string }) {
  const { tokens } = useTheme();
  const bar = useBars();
  const size = layout.component.tile.lg;
  return (
    <Card testID={testID}>
      <LoadingGroup>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
          <Skeleton circle width={size} height={size} />
          <View style={{ flex: 1, gap: bar.gap }}>
            <Skeleton width="55%" height={bar.title} />
            <Skeleton width="80%" height={bar.line} />
            <Skeleton width="35%" height={bar.line} />
          </View>
        </View>
      </LoadingGroup>
    </Card>
  );
}

/** Thẻ cửa hàng: ô vuông + ba thanh + ô mũi tên. */
export function ShopCardSkeleton({ testID }: { testID?: string }) {
  const { tokens } = useTheme();
  const bar = useBars();
  const size = layout.component.tile.lg;
  return (
    <Card testID={testID}>
      <LoadingGroup>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
          <Skeleton width={size} height={size} />
          <View style={{ flex: 1, gap: bar.gap }}>
            <Skeleton width="40%" height={bar.line} />
            <Skeleton width="65%" height={bar.title} />
            <Skeleton width="45%" height={bar.line} />
          </View>
          <Skeleton width={tokens.space.lg} height={tokens.space.lg} />
        </View>
      </LoadingGroup>
    </Card>
  );
}

/** Thẻ gói: ô vuông + ba thanh + viên thuốc ở góc phải. */
export function PlanCardSkeleton({ testID }: { testID?: string }) {
  const { tokens } = useTheme();
  const bar = useBars();
  const size = layout.component.tile.lg;
  return (
    <Card testID={testID}>
      <LoadingGroup>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
          <Skeleton width={size} height={size} />
          <View style={{ flex: 1, gap: bar.gap }}>
            <Skeleton width="35%" height={bar.line} />
            <Skeleton width="60%" height={bar.title} />
            <Skeleton width="70%" height={bar.line} />
          </View>
          <Skeleton width={size} height={bar.title} />
        </View>
      </LoadingGroup>
    </Card>
  );
}

/** Khối "Dữ liệu bằng chứng": thanh tiêu đề, ba ô vuông + nhãn, thanh nút. */
export function EvidenceCardSkeleton({ testID }: { testID?: string }) {
  const { tokens } = useTheme();
  const bar = useBars();
  const size = layout.component.tile.md;
  return (
    <Card testID={testID}>
      <LoadingGroup>
        <View style={{ gap: tokens.space.lg }}>
          <Skeleton width="45%" height={bar.title} />
          <View style={{ flexDirection: 'row', gap: tokens.space.md }}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={{ flex: 1, alignItems: 'center', gap: bar.gap }}>
                <Skeleton width={size} height={size} />
                <Skeleton width="80%" height={bar.line} />
              </View>
            ))}
          </View>
          <Skeleton height={size} />
        </View>
      </LoadingGroup>
    </Card>
  );
}

/** Khối nhóm hàng cuối (Cài đặt...): thanh tiêu đề + chevron. */
export function MenuCardSkeleton({ testID }: { testID?: string }) {
  const { tokens } = useTheme();
  const bar = useBars();
  return (
    <Card testID={testID}>
      <LoadingGroup>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
          <Skeleton width="50%" height={bar.title} />
          <View style={{ flex: 1 }} />
          <Skeleton width={tokens.space.lg} height={tokens.space.lg} />
        </View>
      </LoadingGroup>
    </Card>
  );
}

/**
 * Làm mờ + ẩn khỏi trình đọc màn hình: dùng cho khung chờ đặt cạnh một thẻ lỗi (khung 1c), để người
 * dùng không nghe "đang tải" trong khi thực ra đã lỗi.
 */
export function DimmedPlaceholder({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: tokens.opacity.disabled }}
    >
      {children}
    </View>
  );
}
