import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCurrentShopId } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  ListGroup,
  Screen,
  SearchField,
  Text,
  useTheme,
} from '@/shared/ui';

import { filterShopsByName, SHOP_SEARCH_MIN_SHOPS } from '../domain/shop-list';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { RegionError, RegionSkeleton } from './RegionParts';
import { useSession } from './SessionProvider';
import { ShopSwitchRow } from './ShopSwitchRow';
import { useRegion } from './use-region';
import { useSwitchShop } from './use-switch-shop';

/**
 * Chuyển cửa hàng (PER-07; board 07 khung 7a-7c), route con của UI-I02. Chọn một cửa hàng rồi bấm "Xác nhận":
 * lúc đó mới kiểm tra điều kiện bảo vệ dữ liệu (`useSwitchShop`) và hiện hộp thoại 7b (xác nhận), 7c (đang quay:
 * chặn, nút "Chuyển cửa hàng" vô hiệu) hoặc cảnh báo còn tệp chưa đồng bộ (Q-20o). Chỉ liệt kê cửa hàng tài
 * khoản có quyền; cửa hàng đang dùng có nhãn "Đang dùng", cửa hàng bị khóa không chọn được. Ô tìm chỉ hiện khi
 * có từ `SHOP_SEARCH_MIN_SHOPS` cửa hàng.
 */
export function ShopSwitchScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { account } = usePersonalGateways();
  const session = useSession();
  const shops = useRegion(() => account.listShops(), session.key);
  const flow = useSwitchShop();
  // Shop hiệu lực (phiên chưa biết shop thì orders dùng LOCAL_SHOP_ID), cùng nguồn với kho đơn.
  const currentId = useCurrentShopId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const list = shops.state.status === 'ready' ? shops.state.data : null;
  const showSearch = list !== null && list.length >= SHOP_SEARCH_MIN_SHOPS;
  const visible = list ? (showSearch ? filterShopsByName(list, query) : list) : [];
  // Lựa chọn chỉ có giá trị khi cửa hàng đó còn chọn được ở danh sách hiện tại (danh sách có thể đổi sau khi tải lại).
  const selected =
    list?.find(
      (shop) => shop.id === selectedId && shop.id !== currentId && shop.status === 'active',
    ) ?? null;

  return (
    <Screen
      title={t('nav:subTitles.shopSwitch')}
      onBack={navigation.back}
      testID="screen-UI-I02-switch"
      footer={
        list && list.length > 0 ? (
          <Button
            label={t('personal:switchShop.submit')}
            onPress={() => selected && void flow.select(selected)}
            disabled={selected === null || flow.busy}
            loading={flow.busy}
            testID="switch-shop-submit"
          />
        ) : undefined
      }
    >
      {shops.state.status === 'loading' ? <RegionSkeleton testID="switch-shop-loading" /> : null}
      {shops.state.status === 'error' ? (
        <RegionError region={shops} code={shops.state.code} testID="switch-shop-error" />
      ) : null}
      {list && list.length === 0 ? (
        <Card testID="switch-shop-empty">
          <Text color="textMuted">{t('personal:shop.noShop')}</Text>
        </Card>
      ) : null}
      {showSearch ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('personal:switchShop.search')}
          testID="switch-shop-search"
        />
      ) : null}
      {list && list.length > 0 ? (
        visible.length > 0 ? (
          <ListGroup
            testID="switch-shop-list"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('personal:switchShop.listLabel')}
          >
            {visible.map((shop) => (
              <ShopSwitchRow
                key={shop.id}
                shop={shop}
                isCurrent={shop.id === currentId}
                isSelected={selected?.id === shop.id}
                busy={flow.busy}
                onSelect={() => setSelectedId(shop.id)}
                testID={`switch-shop-item-${shop.id}`}
              />
            ))}
          </ListGroup>
        ) : (
          <Text color="textMuted" testID="switch-shop-no-match">
            {t('personal:switchShop.noMatch')}
          </Text>
        )
      ) : null}

      {/* 7b: xác nhận chuyển (hai nút cạnh nhau). */}
      <ConfirmDialog
        visible={flow.step === 'confirm'}
        icon="swap"
        title={t('personal:switchShop.dialogTitle')}
        message={t('personal:switchShop.dialogMessage', { name: flow.target?.name ?? '' })}
        detail={t('personal:switchShop.dialogDetail')}
        confirmLabel={t('personal:switchShop.confirm')}
        cancelLabel={t('personal:switchShop.cancel')}
        actionsLayout="row"
        onCancel={flow.dismiss}
        onConfirm={() => void flow.confirm()}
        messageTestID="switch-shop-dialog-message"
        confirmTestID="switch-shop-dialog-confirm"
      />
      {/* 7c: đang quay, chặn. Nút "Chuyển cửa hàng" hiện nhưng vô hiệu để người dùng thấy việc nào bị chặn. */}
      <ConfirmDialog
        visible={flow.step === 'blocked_recording'}
        icon="camera"
        title={t('personal:switchShop.recordingTitle')}
        message={t('personal:switchShop.recordingMessage')}
        confirmLabel={t('personal:switchShop.recordingSwitch')}
        cancelLabel={t('personal:switchShop.recordingStay')}
        actionsLayout="row"
        primary="cancel"
        confirmDisabled
        onCancel={flow.dismiss}
        onConfirm={flow.dismiss}
        messageTestID="switch-shop-recording"
        confirmTestID="switch-shop-recording-switch"
      />
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
