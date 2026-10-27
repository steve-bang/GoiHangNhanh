import { useEffect, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveErrorMessage } from '@/core/i18n/error-message';
import { ROUTES, type RouteDef } from '@/core/navigation';
import { useAppNavigation, useIsOffline } from '@/platform';
import {
  Card,
  ConfirmDialog,
  ErrorState,
  ListItem,
  Screen,
  Skeleton,
  StatusBadge,
  Text,
  useTheme,
  useToast,
  type IconName,
} from '@/shared/ui';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { useSession } from './SessionProvider';
import { useRegion, type Region } from './use-region';

interface MenuItem {
  route: RouteDef;
  labelKey: `nav:account.${string}`;
  icon: IconName;
}

/**
 * Các mục của tab Cá nhân (mẫu thiết kế, D-16). Gói dịch vụ có thẻ riêng phía trên; tranh chấp không
 * ở đây (vào từ hồ sơ đơn/hàng hoàn, O-14).
 */
const MENU_ITEMS: readonly MenuItem[] = [
  { route: ROUTES.shopSettings, labelKey: 'nav:account.shopSettings', icon: 'store' },
  { route: ROUTES.members, labelKey: 'nav:account.members', icon: 'user' },
  { route: ROUTES.notifications, labelKey: 'nav:account.notifications', icon: 'notifications' },
  { route: ROUTES.security, labelKey: 'nav:account.security', icon: 'lock' },
  { route: ROUTES.help, labelKey: 'nav:account.help', icon: 'help' },
];

/** Khung chữ + nút thử lại cho một khu vực lỗi (câu chữ lấy theo mã lỗi, docs/09 mục 5.1). */
function RegionError({
  region,
  code,
  testID,
}: {
  region: Region<unknown>;
  code: Parameters<typeof resolveErrorMessage>[1];
  testID: string;
}) {
  const { t } = useTranslation();
  const message = resolveErrorMessage(t, code);
  return (
    <Card>
      <ErrorState
        testID={testID}
        title={message.title}
        {...(message.hint ? { message: message.hint } : {})}
        onRetry={() => void region.reload()}
        retrying={region.refreshing}
      />
    </Card>
  );
}

function RegionSkeleton({ testID }: { testID: string }) {
  const { tokens } = useTheme();
  return (
    <Card testID={testID}>
      <View style={{ gap: tokens.space.sm }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="80%" />
      </View>
    </Card>
  );
}

/**
 * UI-I01 Hồ sơ tài khoản (PER-01, xem hồ sơ PER-02): hồ sơ, cửa hàng, gói, menu, Đăng xuất. Hồ sơ và
 * cửa hàng tải riêng: lỗi/chậm ở một khu vực không che khu vực kia; kéo xuống để làm mới và vẫn giữ
 * dữ liệu cũ nếu làm mới lỗi. Sửa họ tên và đổi mật khẩu là route con (decisions.md Q-19k).
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const offline = useIsOffline();
  const { account } = usePersonalGateways();
  const session = useSession();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const profile = useRegion(() => account.getProfile(), session.key);
  const shop = useRegion(() => account.getShopSummary(), session.key);

  // Sau khi sửa họ tên ở màn con, tải lại hồ sơ (giữ dữ liệu cũ trong lúc tải, không nháy khung chờ).
  const lastRevision = useRef(session.state.profileRevision);
  const reloadProfile = profile.reload;
  useEffect(() => {
    if (lastRevision.current === session.state.profileRevision) return;
    lastRevision.current = session.state.profileRevision;
    void reloadProfile();
  }, [session.state.profileRevision, reloadProfile]);

  const refreshing = profile.refreshing || shop.refreshing;
  const refresh = () => {
    void profile.reload();
    void shop.reload();
  };
  const hasStaleData =
    profile.state.status === 'ready' && (offline || profile.state.refreshError !== null);
  const refreshFailed =
    (profile.state.status === 'ready' && profile.state.refreshError !== null) ||
    (shop.state.status === 'ready' && shop.state.refreshError !== null);

  return (
    <Screen
      title={t('nav:titles.UI-I01')}
      inTabs
      testID="screen-UI-I01"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {offline && hasStaleData ? (
        <Text variant="caption" color="textMuted" testID="profile-cached-notice">
          {t('personal:profile.cachedNotice')}
        </Text>
      ) : null}
      {!offline && refreshFailed ? (
        <Text
          variant="caption"
          color="textMuted"
          accessibilityRole="alert"
          testID="profile-refresh-failed"
        >
          {t('personal:profile.refreshFailed')}
        </Text>
      ) : null}

      {profile.state.status === 'loading' ? <RegionSkeleton testID="profile-loading" /> : null}
      {profile.state.status === 'error' ? (
        <RegionError region={profile} code={profile.state.code} testID="profile-error" />
      ) : null}
      {profile.state.status === 'ready' ? (
        <>
          <ProfileSummaryCard profile={profile.state.data} />
          <Card testID="profile-actions">
            <ListItem
              leadingIcon="user"
              title={t('personal:profile.editEntry')}
              onPress={() => navigation.push(ROUTES.editProfile)}
              testID="edit-profile-entry"
            />
            {/* PER-04 chỉ có nghĩa với tài khoản đăng nhập bằng mật khẩu (D-13, Q-19c). */}
            {profile.state.data.signInMethod === 'password' ? (
              <ListItem
                leadingIcon="lock"
                title={t('personal:profile.changePasswordEntry')}
                onPress={() => navigation.push(ROUTES.changePassword)}
                testID="change-password-entry"
              />
            ) : null}
          </Card>
        </>
      ) : null}

      {shop.state.status === 'loading' ? <RegionSkeleton testID="shop-loading" /> : null}
      {shop.state.status === 'error' ? (
        <RegionError region={shop} code={shop.state.code} testID="shop-error" />
      ) : null}
      {shop.state.status === 'ready' ? (
        <Card testID="shop-card">
          <ListItem
            leadingIcon="store"
            title={shop.state.data?.name ?? t('personal:profile.noShop')}
            subtitle={t('personal:profile.shopLabel')}
            onPress={() => navigation.push(ROUTES.shopSettings)}
            testID="shop-card-item"
          />
        </Card>
      ) : null}

      <Card testID="plan-card">
        <ListItem
          title={t('personal:profile.planLabel')}
          subtitle={t('personal:profile.planUnknown')}
          trailing={<StatusBadge label={t('personal:status.unknown')} />}
          accessibilityLabel={`${t('personal:profile.planLabel')}. ${t('personal:status.unknown')}`}
          onPress={() => navigation.push(ROUTES.plan)}
          testID="plan-card-item"
        />
      </Card>

      <View style={{ gap: tokens.space.xs }}>
        {MENU_ITEMS.map((item) => (
          <ListItem
            key={item.route.path}
            leadingIcon={item.icon}
            title={t(item.labelKey)}
            onPress={() => navigation.push(item.route)}
            testID={`menu-${item.route.code}`}
          />
        ))}
        <ListItem
          destructive
          title={t('personal:signOut.action')}
          onPress={() => setConfirmSignOut(true)}
          showChevron={false}
          testID="sign-out"
        />
      </View>

      {/* PR2: chỉ mở hộp thoại. Đăng xuất an toàn (đếm tệp chưa đồng bộ, xả state) là PR3. */}
      <ConfirmDialog
        visible={confirmSignOut}
        destructive
        title={t('personal:signOut.dialogTitle')}
        message={t('personal:signOut.dialogMessage')}
        confirmLabel={t('personal:signOut.confirm')}
        cancelLabel={t('personal:signOut.cancel')}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          toast.show(t('personal:signOut.notReady'));
        }}
      />
    </Screen>
  );
}
