import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { useEvidenceTotals } from '@/features/upload';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  HeroCard,
  Icon,
  IconTile,
  MetricTile,
  StatusBadge,
  Text,
  useTheme,
} from '@/shared/ui';

import type { ShopSummary } from '../domain/types';
import { planMenuItem } from './account-menu';

/**
 * Thẻ cửa hàng của UI-I01 (board 1a): ô icon xanh dương, "Cửa hàng của bạn" / tên / "Quản lý cửa hàng",
 * mở Cài đặt cửa hàng. Chưa có cửa hàng thì nói rõ, không bịa tên.
 */
export function ShopCard({ shop }: { shop: ShopSummary | null }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const name = shop?.name ?? t('personal:profile.noShop');
  const eyebrow = t('personal:profile.shopEyebrow');
  const manage = t('personal:profile.shopManage');
  return (
    <Card
      onPress={() => navigation.push(ROUTES.shopSettings)}
      accessibilityLabel={[eyebrow, name, manage].join('. ')}
      testID="shop-card"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
        <IconTile icon="store" tone="blue" size="lg" />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textMuted">
            {eyebrow}
          </Text>
          <Text bold>{name}</Text>
          <Text variant="caption" color="textMuted">
            {manage}
          </Text>
        </View>
        <Icon name="forward" size={18} color={tokens.color.text.secondary} />
      </View>
    </Card>
  );
}

/**
 * Thẻ gói của UI-I01 (board 1a). Gói/thời hạn chưa có nguồn dữ liệu (O-06, O-16; Q-21c) nên mọi giá
 * trị là "Chưa có thông tin", huy hiệu "Sắp có" (luôn hiện, kể cả khi mở được); KHÔNG bịa tên gói hay
 * "Đang hoạt động". HÔM NAY ĐANG ẨN (mục `plan` ở `account-menu.ts` là `hidden`, Q-21ag): `ProfileScreen` không
 * dựng thẻ này. Khi bật lại mục thì mở UI-H01; mục `coming_soon` thì khóa (không mũi tên, không điều hướng).
 */
export function PlanHeroCard() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const item = planMenuItem();
  const open = item.availability === 'available';
  const soonLabel = t('personal:status.comingSoon');
  return (
    <HeroCard
      eyebrow={t('personal:plan.eyebrow')}
      title={t('personal:plan.title')}
      subtitle={t('personal:plan.retention')}
      badge={<StatusBadge label={soonLabel} />}
      badgeLabel={soonLabel}
      {...(open ? { onPress: () => navigation.push(item.route) } : {})}
      testID="plan-card"
    />
  );
}

/**
 * Khối "Dữ liệu bằng chứng" (board 1a): ba ô đếm THẬT tệp của cửa hàng đang dùng trên máy này (V1-10,
 * định nghĩa ở `upload/domain/evidence-stats.ts`): trên máy / đang chờ đồng bộ / trên đám mây (chỉ tệp
 * máy chủ đã kiểm tra khớp). Đang đọc hoặc đọc lỗi: "–", không số giả. Kèm nút mở Trung tâm đồng bộ.
 * Tiêu đề (có "›") mở Dữ liệu bằng chứng (khung 11, PER-11).
 */
export function EvidenceOverviewCard() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { state } = useEvidenceTotals();
  const value = (key: 'onDevice' | 'pending' | 'cloud') =>
    state.kind === 'ready' ? state.data[key] : t('personal:evidenceOverview.unknown');
  const openDetail = () => navigation.push(ROUTES.evidenceData);
  return (
    <Card testID="evidence-overview">
      <View style={{ gap: tokens.space.md }}>
        {/* Đề mục (header) và nút mở là hai phần tử trợ năng riêng; vùng bấm ngoài chỉ phục vụ cảm ứng. */}
        <Pressable
          onPress={openDetail}
          accessible={false}
          testID="evidence-overview-row"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.space.sm,
            minHeight: getMinTouchTarget(),
          }}
        >
          <Text
            variant="sectionTitle"
            accessibilityRole="header"
            style={{ flex: 1, flexShrink: 1 }}
            testID="evidence-overview-heading"
          >
            {t('personal:evidenceOverview.title')}
          </Text>
          <Pressable
            onPress={openDetail}
            accessibilityRole="button"
            accessibilityLabel={t('personal:evidenceOverview.title')}
            accessibilityHint={t('personal:evidenceOverview.openDetail')}
            testID="evidence-overview-title"
            style={({ pressed }) => ({
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: getMinTouchTarget(),
              minHeight: getMinTouchTarget(),
              opacity: pressed ? tokens.opacity.pressed : 1,
            })}
          >
            <Icon name="forward" size={18} color={tokens.color.text.secondary} />
          </Pressable>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <MetricTile
            label={t('personal:evidenceOverview.onDevice')}
            value={value('onDevice')}
            icon="device-saved"
            tone="neutral"
            testID="metric-on-device"
          />
          <MetricTile
            label={t('personal:evidenceOverview.pendingSync')}
            value={value('pending')}
            icon="sync"
            tone="warning"
            testID="metric-pending-sync"
          />
          <MetricTile
            label={t('personal:evidenceOverview.cloud')}
            value={value('cloud')}
            icon="cloud"
            tone="blue"
            testID="metric-cloud"
          />
        </View>
        <Button
          variant="secondary"
          label={t('personal:evidenceOverview.openSync')}
          onPress={() => navigation.push(ROUTES.sync)}
          testID="open-sync-center"
        />
      </View>
    </Card>
  );
}

/** Khung 1e: chưa có họ tên. Thay thẻ hồ sơ (Q-21e); mở Sửa họ tên. */
export function ProfileNoName() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <View testID="profile-no-name">
      <EmptyState
        icon="user"
        iconTone="brand"
        title={t('personal:profile.noNameTitle')}
        message={t('personal:profile.noNameMessage')}
        actionLabel={t('personal:profile.noNameAction')}
        compact
        onAction={() => navigation.push(ROUTES.editProfile)}
      />
    </View>
  );
}

/** Khung 1d: ngoại tuyến và chưa có dữ liệu hồ sơ nào để hiện. */
export function ProfileOffline({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View testID="profile-offline">
      <EmptyState
        icon="disconnect"
        iconTone="brand"
        title={t('personal:profile.offlineTitle')}
        message={t('personal:profile.offlineMessage')}
        actionLabel={t('common:actions.retry')}
        actionVariant="primary"
        onAction={onRetry}
      />
    </View>
  );
}
