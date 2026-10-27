import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
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
} from '@/shared/ui';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { RegionError, RegionSkeleton } from './RegionParts';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';
import { useSwitchShop } from './use-switch-shop';

/**
 * Chuyển cửa hàng (PER-07), route con của UI-I02. Chỉ liệt kê cửa hàng tài khoản có quyền; cửa hàng
 * đang dùng có nhãn "Đang dùng", cửa hàng tạm khóa không chọn được. Điều kiện bảo vệ dữ liệu ở
 * `useSwitchShop`.
 */
export function ShopSwitchScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { account } = usePersonalGateways();
  const session = useSession();
  const shops = useRegion(() => account.listShops(), session.key);
  const flow = useSwitchShop();
  const currentId = session.state.shopId;

  return (
    <Screen
      title={t('nav:subTitles.shopSwitch')}
      onBack={navigation.back}
      testID="screen-UI-I02-switch"
    >
      <Text color="textMuted">{t('personal:switchShop.intro')}</Text>
      {shops.state.status === 'loading' ? <RegionSkeleton testID="switch-shop-loading" /> : null}
      {shops.state.status === 'error' ? (
        <RegionError region={shops} code={shops.state.code} testID="switch-shop-error" />
      ) : null}
      {shops.state.status === 'ready' ? (
        <Card testID="switch-shop-list">
          {shops.state.data.map((shop) => {
            const isCurrent = shop.id === currentId;
            const suspended = shop.status !== 'active';
            const status = isCurrent
              ? t('personal:shop.current')
              : suspended
                ? t('personal:shop.status.suspended')
                : null;
            return (
              <ListItem
                key={shop.id}
                leadingIcon="store"
                title={shop.name}
                subtitle={t(`personal:shop.role.${shop.role}`)}
                trailing={
                  status ? (
                    <StatusBadge label={status} tone={suspended ? 'warning' : 'neutral'} />
                  ) : undefined
                }
                accessibilityLabel={[
                  shop.name,
                  t(`personal:shop.role.${shop.role}`),
                  status,
                  suspended ? t('personal:switchShop.suspendedHint') : null,
                ]
                  .filter(Boolean)
                  .join('. ')}
                disabled={isCurrent || suspended || flow.busy}
                {...(isCurrent || suspended ? { showChevron: false } : {})}
                onPress={() => void flow.select(shop)}
                testID={`switch-shop-item-${shop.id}`}
              />
            );
          })}
        </Card>
      ) : null}

      <ConfirmDialog
        visible={flow.step === 'confirm'}
        title={t('personal:switchShop.dialogTitle')}
        message={t('personal:switchShop.dialogMessage', { name: flow.target?.name ?? '' })}
        confirmLabel={t('personal:switchShop.confirm')}
        cancelLabel={t('personal:switchShop.cancel')}
        onCancel={flow.dismiss}
        onConfirm={() => void flow.confirm()}
      />
      <BottomSheet
        visible={flow.step === 'blocked_recording'}
        onClose={flow.dismiss}
        title={t('personal:switchShop.recordingTitle')}
      >
        <Text testID="switch-shop-recording">{t('personal:switchShop.recordingMessage')}</Text>
      </BottomSheet>
      <BottomSheet
        visible={flow.step === 'unsynced'}
        onClose={flow.dismiss}
        title={t('personal:switchShop.unsyncedTitle')}
      >
        <View style={{ gap: tokens.space.md }}>
          <Text testID="switch-shop-unsynced">
            {t('personal:switchShop.unsyncedMessage', { count: flow.unsyncedCount })}
          </Text>
          <Button
            label={t('personal:switchShop.openSync')}
            onPress={flow.openSyncCenter}
            testID="switch-shop-open-sync"
          />
          <Button
            label={t('personal:switchShop.unsyncedContinue')}
            variant="secondary"
            onPress={() => void flow.confirm()}
            loading={flow.busy}
            testID="switch-shop-continue"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
