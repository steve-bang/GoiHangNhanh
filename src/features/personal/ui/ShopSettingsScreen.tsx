import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Avatar, Button, Card, ListItem, Screen, StatusBadge, Text, useTheme } from '@/shared/ui';

import type { ShopSummary } from '../domain/types';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { RegionError, RegionSkeleton } from './RegionParts';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';
import { useReloadOnShopUpdated } from './use-shop-revision-reload';

/**
 * UI-I02 Quản lý cửa hàng (PER-05): thẻ shop đang dùng (tên, vai trò, trạng thái), lối sửa tên (PER-06)
 * và chuyển cửa hàng (PER-07, chỉ khi tài khoản có từ hai cửa hàng trở lên, Q-19f). Quản lý thành viên
 * KHÔNG ở đây (O-03, O-07 chưa chốt). Quyền sửa do cổng trả (`canEdit`): UI chỉ phản ánh, cổng/Rules
 * mới là chốt thật. Tên shop không phải định danh nên đổi tên không đụng tới bằng chứng đã lưu.
 */
export function ShopSettingsScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { account } = usePersonalGateways();
  const session = useSession();
  const shop = useRegion(() => account.getShopSummary(), session.key);
  const shops = useRegion(() => account.listShops(), session.key);
  useReloadOnShopUpdated(shop.reload);
  useReloadOnShopUpdated(shops.reload);

  // Không tải được danh sách thì ẩn lối chuyển shop (không mời làm điều chưa chắc làm được).
  const canSwitch = shops.state.status === 'ready' && shops.state.data.length > 1;
  const refreshing = shop.refreshing || shops.refreshing;
  const refresh = () => {
    void shop.reload();
    void shops.reload();
  };
  const refreshFailed = shop.state.status === 'ready' && shop.state.refreshError !== null;

  return (
    <Screen
      title={t('nav:titles.UI-I02')}
      onBack={navigation.back}
      testID="screen-UI-I02"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {refreshFailed ? (
        <Text
          variant="caption"
          color="textMuted"
          accessibilityRole="alert"
          testID="shop-refresh-failed"
        >
          {t('personal:shop.refreshFailed')}
        </Text>
      ) : null}

      {shop.state.status === 'loading' ? <RegionSkeleton testID="shop-settings-loading" /> : null}
      {shop.state.status === 'error' ? (
        <RegionError region={shop} code={shop.state.code} testID="shop-settings-error" />
      ) : null}
      {shop.state.status === 'ready' && shop.state.data === null ? (
        <Card testID="shop-settings-empty">
          <View style={{ gap: tokens.space.xs }}>
            <Text variant="sectionTitle">{t('personal:shop.noShop')}</Text>
            <Text color="textMuted">{t('personal:shop.noShopHint')}</Text>
          </View>
        </Card>
      ) : null}
      {shop.state.status === 'ready' && shop.state.data ? (
        <ShopDetails
          shop={shop.state.data}
          onEdit={() => navigation.push(ROUTES.shopEdit)}
          canSwitch={canSwitch}
          onSwitch={() => navigation.push(ROUTES.shopSwitch)}
        />
      ) : null}
    </Screen>
  );
}

function ShopDetails({
  shop,
  onEdit,
  canSwitch,
  onSwitch,
}: {
  shop: ShopSummary;
  onEdit: () => void;
  canSwitch: boolean;
  onSwitch: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space.lg }}>
      <Card testID="shop-settings-card">
        <View style={{ alignItems: 'center', gap: tokens.space.sm }}>
          <Avatar name={shop.name} size="xl" testID="shop-settings-avatar" />
          <Text variant="sectionTitle" testID="shop-settings-name">
            {shop.name}
          </Text>
        </View>
        <ListItem
          title={t('personal:shop.roleLabel')}
          subtitle={t(`personal:shop.role.${shop.role}`)}
          showChevron={false}
          testID="shop-settings-role"
        />
        <ListItem
          title={t('personal:shop.statusLabel')}
          trailing={
            <StatusBadge
              label={t(`personal:shop.status.${shop.status}`)}
              tone={shop.status === 'active' ? 'neutral' : 'warning'}
            />
          }
          accessibilityLabel={`${t('personal:shop.statusLabel')}. ${t(`personal:shop.status.${shop.status}`)}`}
          showChevron={false}
          testID="shop-settings-status"
        />
      </Card>
      {shop.canEdit ? (
        <Button
          label={t('personal:shop.editAction')}
          onPress={onEdit}
          testID="shop-settings-edit"
        />
      ) : (
        <Text color="textMuted" testID="shop-settings-no-permission">
          {t('personal:shop.noEditPermission')}
        </Text>
      )}
      {canSwitch ? (
        <Card>
          <ListItem
            leadingIcon="store"
            title={t('personal:shop.switchAction')}
            onPress={onSwitch}
            testID="shop-settings-switch"
          />
        </Card>
      ) : null}
    </View>
  );
}
