import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  Avatar,
  Card,
  ListGroup,
  ListItem,
  Screen,
  StatusBadge,
  Text,
  useTheme,
} from '@/shared/ui';

import type { ShopSummary } from '../domain/types';
import { Notice } from './Notice';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { RegionError, RegionSkeleton } from './RegionParts';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';
import { useReloadOnShopUpdated } from './use-shop-revision-reload';

/**
 * UI-I02 Cài đặt cửa hàng (PER-05): thông tin cửa hàng đang dùng (tên, vai trò, trạng thái), lối sửa tên
 * (PER-06) và chuyển cửa hàng (PER-07, chỉ khi tài khoản có từ hai cửa hàng trở lên, Q-19f). Quản lý
 * thành viên KHÔNG ở đây (O-03, O-07 chưa chốt). Quyền sửa do cổng trả (`canEdit`): UI chỉ phản ánh,
 * cổng/Rules mới là chốt thật. Tên cửa hàng không phải định danh nên đổi tên không đụng tới bằng chứng đã lưu.
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
      contentGap={tokens.space.xl}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text color="textMuted" testID="shop-settings-intro">
        {t('personal:shop.settingsIntro')}
      </Text>
      {refreshFailed ? (
        <Notice alert testID="shop-refresh-failed">
          {t('personal:shop.refreshFailed')}
        </Notice>
      ) : null}

      {shop.state.status === 'loading' ? (
        <RegionSkeleton shape="square" testID="shop-settings-loading" />
      ) : null}
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
  const status = t(`personal:shop.status.${shop.status}`);
  const hasActions = shop.canEdit || canSwitch;
  return (
    <View style={{ gap: tokens.space.xl }}>
      <ListGroup testID="shop-settings-card">
        <ListItem
          leading={
            <Avatar name={shop.name} size="lg" shape="square" testID="shop-settings-avatar" />
          }
          title={shop.name}
          showChevron={false}
          testID="shop-settings-name"
        />
        <InfoRow
          label={t('personal:shop.roleLabel')}
          testID="shop-settings-role"
          accessibilityValue={t(`personal:shop.role.${shop.role}`)}
        >
          <Text>{t(`personal:shop.role.${shop.role}`)}</Text>
        </InfoRow>
        <InfoRow
          label={t('personal:shop.statusLabel')}
          testID="shop-settings-status"
          accessibilityValue={status}
        >
          <StatusBadge label={status} tone={shop.status === 'active' ? 'neutral' : 'warning'} />
        </InfoRow>
      </ListGroup>
      {hasActions ? (
        <ListGroup testID="shop-settings-actions">
          {shop.canEdit ? (
            <ListItem
              leadingIcon="edit"
              title={t('personal:shop.editAction')}
              titleWeight="regular"
              onPress={onEdit}
              testID="shop-settings-edit"
            />
          ) : null}
          {canSwitch ? (
            <ListItem
              leadingIcon="swap"
              title={t('personal:shop.switchAction')}
              titleWeight="regular"
              onPress={onSwitch}
              testID="shop-settings-switch"
            />
          ) : null}
        </ListGroup>
      ) : null}
      {!shop.canEdit ? (
        <Text color="textMuted" testID="shop-settings-no-permission">
          {t('personal:shop.noEditPermission')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Hàng thông tin chỉ đọc: nhãn (caption, mờ) bên trái, giá trị cỡ thường bên phải; xuống dòng khi
 * hẹp hoặc chữ lớn thay vì ép cột chữ. Một phần tử trợ năng đọc "nhãn. giá trị".
 */
function InfoRow({
  label,
  accessibilityValue,
  testID,
  children,
}: {
  label: string;
  accessibilityValue: string;
  testID: string;
  children: ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}. ${accessibilityValue}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.space.sm,
        paddingHorizontal: tokens.space.lg,
        paddingVertical: tokens.space.md,
      }}
    >
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      {children}
    </View>
  );
}
