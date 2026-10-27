import { useEffect, useRef } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { getAppVersion, useAppNavigation, useIsOffline } from '@/platform';
import {
  Avatar,
  BottomSheet,
  Button,
  ConfirmDialog,
  ListGroup,
  ListItem,
  Screen,
  Text,
  useTheme,
} from '@/shared/ui';

import { visibleMenuItems } from './account-menu';
import { MenuRow } from './MenuRow';
import { Notice } from './Notice';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { useSession } from './SessionProvider';
import { useSignOut } from './use-sign-out';
import { RegionError, RegionSkeleton } from './RegionParts';
import { useRegion } from './use-region';
import { useReloadOnShopUpdated } from './use-shop-revision-reload';

/**
 * UI-I01 Cá nhân (PER-01, xem hồ sơ PER-02), gom thành nhóm kiểu iOS: Tài khoản (hồ sơ, Đổi mật khẩu),
 * Cửa hàng và gói, Cài đặt, Hỗ trợ, rồi Đăng xuất riêng. Hồ sơ và cửa hàng tải riêng: lỗi/chậm ở một
 * khu vực không che khu vực kia; kéo xuống để làm mới và vẫn giữ dữ liệu cũ nếu làm mới lỗi. Sửa họ tên
 * và đổi mật khẩu là route con (decisions.md Q-20k). Mục chưa làm: cấu hình ở `account-menu.ts`.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const offline = useIsOffline();
  const { account } = usePersonalGateways();
  const session = useSession();
  const signOut = useSignOut();
  const version = getAppVersion();

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
      contentGap={tokens.space.xl}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {offline && hasStaleData ? (
        <Notice testID="profile-cached-notice">{t('personal:profile.cachedNotice')}</Notice>
      ) : null}
      {!offline && refreshFailed ? (
        <Notice alert testID="profile-refresh-failed">
          {t('personal:profile.refreshFailed')}
        </Notice>
      ) : null}

      <ListGroup title={t('personal:groups.account')} testID="group-account">
        {profile.state.status === 'loading' ? (
          <RegionSkeleton inline testID="profile-loading" />
        ) : null}
        {profile.state.status === 'error' ? (
          <RegionError inline region={profile} code={profile.state.code} testID="profile-error" />
        ) : null}
        {profile.state.status === 'ready' ? (
          <ProfileSummaryCard profile={profile.state.data} />
        ) : null}
        {/* PER-04 chỉ có nghĩa với tài khoản đăng nhập bằng mật khẩu (D-13, Q-20c). */}
        {profile.state.status === 'ready' && profile.state.data.signInMethod === 'password' ? (
          <ListItem
            leadingIcon="lock"
            title={t('personal:profile.changePasswordEntry')}
            titleWeight="regular"
            onPress={() => navigation.push(ROUTES.changePassword)}
            testID="change-password-entry"
          />
        ) : null}
      </ListGroup>

      <ListGroup title={t('personal:groups.shopAndPlan')} testID="group-shop">
        {shop.state.status === 'loading' ? (
          <RegionSkeleton inline shape="square" testID="shop-loading" />
        ) : null}
        {shop.state.status === 'error' ? (
          <RegionError inline region={shop} code={shop.state.code} testID="shop-error" />
        ) : null}
        {shop.state.status === 'ready' ? (
          <ListItem
            leading={<Avatar name={shop.state.data?.name ?? null} size="lg" shape="square" />}
            title={shop.state.data?.name ?? t('personal:profile.noShop')}
            {...(shop.state.data
              ? { subtitle: t(`personal:shop.role.${shop.state.data.role}`) }
              : {})}
            onPress={() => navigation.push(ROUTES.shopSettings)}
            testID="shop-card"
          />
        ) : null}
        {visibleMenuItems('shopAndPlan').map((item) => (
          <MenuRow key={item.id} item={item} />
        ))}
      </ListGroup>

      <ListGroup title={t('personal:groups.settings')} testID="group-settings">
        {visibleMenuItems('settings').map((item) => (
          <MenuRow key={item.id} item={item} />
        ))}
      </ListGroup>

      <ListGroup title={t('personal:groups.support')} testID="group-support">
        {visibleMenuItems('support').map((item) => (
          <MenuRow key={item.id} item={item} />
        ))}
      </ListGroup>

      <View style={{ gap: tokens.space.md }}>
        <ListGroup testID="group-sign-out">
          <ListItem
            destructive
            leadingIcon="sign-out"
            title={t('personal:signOut.action')}
            titleWeight="regular"
            onPress={signOut.start}
            showChevron={false}
            testID="sign-out"
          />
        </ListGroup>
        {version ? (
          <Text
            variant="caption"
            color="textMuted"
            style={{ textAlign: 'center' }}
            testID="app-version"
          >
            {t('personal:profile.version', { version })}
          </Text>
        ) : null}
      </View>

      {/* PER-21. UI-J15 (còn tệp chưa đồng bộ) chưa có mã/route nên là BottomSheet tại chỗ (Q-20b). */}
      <ConfirmDialog
        visible={signOut.step === 'confirm'}
        destructive
        confirmOutlined
        title={t('personal:signOut.dialogTitle')}
        message={t('personal:signOut.dialogMessage')}
        detail={t('personal:signOut.dataNote')}
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
