import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  Card,
  Icon,
  type IconName,
  IconTile,
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
 * UI-I02 Cài đặt cửa hàng (PER-05; board 07 khung 5, tiêu đề "Cửa hàng"): thẻ thông tin cửa hàng đang dùng
 * (tên, trạng thái), hai hàng chỉ đọc Vai trò/Trạng thái, rồi mỗi hành động một thẻ: sửa tên (PER-06) và
 * chuyển cửa hàng (PER-07, chỉ khi tài khoản có từ hai cửa hàng trở lên, Q-20f). KHÔNG có: "Xóa cửa hàng"
 * (có thể phá bằng chứng, bất biến 9; Q-21d), dòng "ID" (mô hình chưa có mã cửa hàng, Q-20n), quản lý
 * thành viên (O-03, O-07). Quyền sửa do cổng trả (`canEdit`): UI chỉ phản ánh, cổng/Rules mới là chốt
 * thật. Tên cửa hàng không phải định danh nên đổi tên không đụng tới bằng chứng đã lưu.
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
      contentGap={tokens.space.lg}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
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
  const active = shop.status === 'active';
  const hasActions = shop.canEdit || canSwitch;
  return (
    <View style={{ gap: tokens.space.lg }}>
      <Card testID="shop-settings-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.lg }}>
          <IconTile icon="store" size="lg" testID="shop-settings-avatar" />
          <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.sm }}>
            <Text variant="sectionTitle" testID="shop-settings-name">
              {shop.name}
            </Text>
            <StatusBadge label={status} tone={active ? 'info' : 'warning'} />
          </View>
        </View>
      </Card>
      <View>
        <InfoRow
          label={t('personal:shop.roleLabel')}
          icon="user"
          testID="shop-settings-role"
          accessibilityValue={t(`personal:shop.role.${shop.role}`)}
        >
          <Text>{t(`personal:shop.role.${shop.role}`)}</Text>
        </InfoRow>
        <InfoRow
          label={t('personal:shop.statusLabel')}
          icon="info"
          testID="shop-settings-status"
          accessibilityValue={status}
        >
          <Text bold color={active ? 'text' : 'warning'}>
            {status}
          </Text>
        </InfoRow>
      </View>
      {hasActions ? (
        <View testID="shop-settings-actions" style={{ gap: tokens.space.sm }}>
          {shop.canEdit ? (
            <ListGroup>
              <ListItem
                leadingIcon="edit"
                title={t('personal:shop.editAction')}
                titleWeight="regular"
                onPress={onEdit}
                testID="shop-settings-edit"
              />
            </ListGroup>
          ) : null}
          {canSwitch ? (
            <ListGroup>
              <ListItem
                leadingIcon="swap"
                title={t('personal:shop.switchAction')}
                titleWeight="regular"
                onPress={onSwitch}
                testID="shop-settings-switch"
              />
            </ListGroup>
          ) : null}
        </View>
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
 * Hàng thông tin chỉ đọc, KHÔNG có thẻ nền và KHÔNG có mũi tên (board 07 khung 5 vẽ mũi tên nhưng hàng không mở
 * được màn nào: D23): biểu tượng mờ bên trái, nhãn (caption, mờ) ở trên, giá trị ở dưới; xuống dòng được khi
 * chữ lớn. Một phần tử trợ năng đọc "nhãn. giá trị".
 */
function InfoRow({
  label,
  accessibilityValue,
  testID,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
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
        alignItems: 'center',
        gap: tokens.space.md,
        paddingHorizontal: tokens.space.md,
        paddingVertical: tokens.space.md,
      }}
    >
      <Icon name={icon} size={22} color={tokens.color.text.secondary} />
      <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.tight }}>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}
