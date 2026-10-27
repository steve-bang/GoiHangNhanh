import { useEffect, useRef } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES, type RouteDef } from '@/core/navigation';
import { useAppNavigation, useIsOffline } from '@/platform';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  ListItem,
  Screen,
  StatusBadge,
  Text,
  useTheme,
  type IconName,
} from '@/shared/ui';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { useSession } from './SessionProvider';
import { useSignOut } from './use-sign-out';
import { RegionError, RegionSkeleton } from './RegionParts';
import { useRegion } from './use-region';
import { useReloadOnShopUpdated } from './use-shop-revision-reload';

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

/**
 * UI-I01 Hồ sơ tài khoản (PER-01, xem hồ sơ PER-02): hồ sơ, cửa hàng, gói, menu, Đăng xuất. Hồ sơ và
 * cửa hàng tải riêng: lỗi/chậm ở một khu vực không che khu vực kia; kéo xuống để làm mới và vẫn giữ
 * dữ liệu cũ nếu làm mới lỗi. Sửa họ tên và đổi mật khẩu là route con (decisions.md Q-19k).
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const offline = useIsOffline();
  const { account } = usePersonalGateways();
  const session = useSession();
  const signOut = useSignOut();

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

  // Sau khi đổi tên shop ở màn con, tải lại thẻ shop.
  useReloadOnShopUpdated(shop.reload);

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
          onPress={signOut.start}
          showChevron={false}
          testID="sign-out"
        />
      </View>

      {/* PER-21. UI-J15 (còn tệp chưa đồng bộ) chưa có mã/route nên là BottomSheet tại chỗ (Q-19b). */}
      <ConfirmDialog
        visible={signOut.step === 'confirm'}
        destructive
        title={t('personal:signOut.dialogTitle')}
        message={`${t('personal:signOut.dialogMessage')} ${t('personal:signOut.dataNote')}`}
        confirmLabel={t('personal:signOut.confirm')}
        cancelLabel={t('personal:signOut.cancel')}
        onCancel={signOut.dismiss}
        onConfirm={() => void signOut.confirm()}
      />
      <BottomSheet
        visible={signOut.step === 'blocked_recording'}
        onClose={signOut.dismiss}
        title={t('personal:signOut.recordingTitle')}
      >
        <Text testID="sign-out-recording">{t('personal:signOut.recordingMessage')}</Text>
      </BottomSheet>
      <BottomSheet
        visible={signOut.step === 'unsynced'}
        onClose={signOut.dismiss}
        title={t('personal:signOut.unsyncedTitle')}
      >
        <View style={{ gap: tokens.space.md }}>
          <Text testID="sign-out-unsynced">
            {t('personal:signOut.unsyncedMessage', { count: signOut.unsyncedCount })}
          </Text>
          <Button
            label={t('personal:signOut.openSync')}
            onPress={signOut.openSyncCenter}
            testID="sign-out-open-sync"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
