import { useEffect, useRef } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { getAppVersion, useAppNavigation, useIsOffline } from '@/platform';
import {
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
import {
  EvidenceOverviewCard,
  PlanHeroCard,
  ProfileNoName,
  ProfileOffline,
  ShopCard,
} from './ProfileCards';
import {
  DimmedPlaceholder,
  EvidenceCardSkeleton,
  MenuCardSkeleton,
  PlanCardSkeleton,
  ProfileCardSkeleton,
  ShopCardSkeleton,
} from './ProfileSkeletons';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { useSession } from './SessionProvider';
import { useSignOut } from './use-sign-out';
import { RegionError } from './RegionParts';
import { useRegion } from './use-region';
import { useReloadOnShopUpdated } from './use-shop-revision-reload';

/**
 * UI-I01 Cá nhân (PER-01, xem hồ sơ PER-02), dựng theo board 07 khung 1a-1e (personal-tab-redesign-plan.md):
 * thẻ hồ sơ, thẻ cửa hàng, thẻ gói (chưa có dữ liệu: "Chưa có thông tin"), khối "Dữ liệu bằng chứng" +
 * nút mở Trung tâm đồng bộ, rồi các nhóm Tài khoản/Cài đặt/Hỗ trợ và Đăng xuất riêng. Hồ sơ và cửa
 * hàng tải riêng: lỗi/chậm ở một khu vực không che khu vực kia; kéo xuống để làm mới và vẫn giữ dữ liệu
 * cũ nếu làm mới lỗi. Trạng thái: 1b đang tải (cả hai khu vực chưa xong thì khung chờ cho mọi khối),
 * 1c lỗi (thẻ lỗi), 1d ngoại tuyến + lỗi mạng khi chưa có dữ liệu hồ sơ nào để hiện (có dữ liệu cũ thì giữ dữ
 * liệu kèm thẻ cảnh báo), 1e chưa có họ tên (thay thẻ hồ sơ, Q-21e). Sửa họ tên và đổi mật khẩu là
 * route con (decisions.md Q-20k). Mục chưa làm: cấu hình ở `account-menu.ts`.
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
  const initialLoading = profile.state.status === 'loading' && shop.state.status === 'loading';
  const refreshFailed =
    (profile.state.status === 'ready' && profile.state.refreshError !== null) ||
    (shop.state.status === 'ready' && shop.state.refreshError !== null);

  // Khung 1d chỉ khi đang ngoại tuyến VÀ lỗi đúng là lỗi mạng; lỗi khác (dịch vụ...) đi khung 1c.
  const networkDown =
    offline && profile.state.status === 'error' && profile.state.code === 'AUTH_NETWORK_ERROR';

  const planId = 'plan';
  const shopExtras = visibleMenuItems('shopAndPlan').filter((item) => item.id !== planId);
  const profileState = profile.state;
  const showPasswordRow =
    profileState.status === 'ready' && profileState.data.signInMethod === 'password';

  return (
    <Screen
      title={t('nav:titles.UI-I01')}
      inTabs
      testID="screen-UI-I01"
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

      {profileState.status === 'loading' ? <ProfileCardSkeleton testID="profile-loading" /> : null}
      {profileState.status === 'error' && networkDown ? (
        <ProfileOffline onRetry={() => void profile.reload()} />
      ) : null}
      {profileState.status === 'error' && !networkDown ? (
        <View style={{ gap: tokens.space.md }}>
          <DimmedPlaceholder>
            <ProfileCardSkeleton />
          </DimmedPlaceholder>
          <RegionError card region={profile} code={profileState.code} testID="profile-error" />
        </View>
      ) : null}
      {profileState.status === 'ready' && profileState.data.displayName === null ? (
        <ProfileNoName />
      ) : null}
      {profileState.status === 'ready' && profileState.data.displayName !== null ? (
        <ProfileSummaryCard
          profile={{ ...profileState.data, displayName: profileState.data.displayName }}
        />
      ) : null}

      {shop.state.status === 'loading' ? <ShopCardSkeleton testID="shop-loading" /> : null}
      {shop.state.status === 'error' ? (
        <RegionError card region={shop} code={shop.state.code} testID="shop-error" />
      ) : null}
      {shop.state.status === 'ready' ? <ShopCard shop={shop.state.data} /> : null}
      {shopExtras.length > 0 ? (
        <ListGroup title={t('personal:groups.shopAndPlan')} testID="group-shop">
          {shopExtras.map((item) => (
            <MenuRow key={item.id} item={item} />
          ))}
        </ListGroup>
      ) : null}

      {initialLoading ? <PlanCardSkeleton testID="plan-loading" /> : <PlanHeroCard />}
      {initialLoading ? (
        <EvidenceCardSkeleton testID="evidence-loading" />
      ) : (
        <EvidenceOverviewCard />
      )}

      {initialLoading ? (
        <MenuCardSkeleton testID="menu-loading" />
      ) : (
        <>
          {/* PER-04 chỉ có nghĩa với tài khoản đăng nhập bằng mật khẩu (D-13, Q-20c). */}
          {showPasswordRow ? (
            <ListGroup title={t('personal:groups.account')} testID="group-account">
              <ListItem
                leadingIcon="lock"
                title={t('personal:profile.changePasswordEntry')}
                titleWeight="regular"
                onPress={() => navigation.push(ROUTES.changePassword)}
                testID="change-password-entry"
              />
            </ListGroup>
          ) : null}

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
        </>
      )}

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
