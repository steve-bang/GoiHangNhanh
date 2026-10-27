import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { useAppNavigation, useConfirmBeforeLeave, useIsScreenActive } from '@/platform';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  FormField,
  Screen,
  Skeleton,
  Text,
  useTheme,
  useToast,
  type TextFieldInput,
} from '@/shared/ui';

import { normalizeShopName, validateShopName } from '../domain/validation';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';

/**
 * Sửa thông tin cửa hàng (PER-06), route con của UI-I02. Chỉ sửa TÊN: logo và mô tả chưa có nơi lưu
 * (chưa có backend), nên không dựng ô giả. Thành công chỉ được báo SAU KHI cổng xác nhận; lỗi (kể cả
 * thiếu quyền) hiện tại màn và giữ nguyên điều người dùng đã gõ. Gửi lặp bị chặn bằng `busyRef`.
 */
export function ShopEditScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const isActive = useIsScreenActive();
  const { account } = usePersonalGateways();
  const session = useSession();
  const shop = useRegion(() => account.getShopSummary(), session.key);

  // `null` = chưa gõ gì: ô hiện tên đang lưu.
  const [draft, setDraft] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ErrorCode | null>(null);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const busyRef = useRef(false);
  const nameRef = useRef<TextFieldInput>(null);

  const loaded = shop.state.status === 'ready' ? shop.state.data : null;
  const original = loaded?.name ?? '';
  const value = draft ?? original;
  const issue = draft === null ? null : validateShopName(draft);
  const dirty =
    loaded !== null && draft !== null && normalizeShopName(draft) !== normalizeShopName(original);
  const canEdit = loaded?.canEdit === true;
  const canSave = canEdit && dirty && !saving;

  const { allowLeave } = useConfirmBeforeLeave(dirty, () => setLeaveVisible(true));

  const save = async () => {
    if (busyRef.current || !loaded || !loaded.canEdit || draft === null) return;
    if (validateShopName(draft) !== null) {
      setSubmitted(true);
      nameRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await account.updateShopName(loaded.id, normalizeShopName(draft));
      // Cổng đã xác nhận: báo cho các màn đang hiện tên cũ tải lại, rồi mới báo thành công.
      session.notifyShopUpdated();
      toast.show(t('personal:editShop.saved'), { tone: 'success' });
      allowLeave();
      // Đã rời màn trong lúc chờ: không điều hướng thay người dùng.
      if (isActive()) navigation.back();
    } catch (error) {
      setSaveError(isAppError(error) ? error.code : 'SHOP_SAVE_FAILED');
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const nameError = submitted && issue ? t(`personal:validation.shopName.${issue}`) : undefined;
  const loadMessage = resolveErrorMessage(
    t,
    shop.state.status === 'error' ? shop.state.code : 'AUTH_SERVICE_UNAVAILABLE',
  );
  const saveMessage = saveError ? errorText(resolveErrorMessage(t, saveError)) : null;

  return (
    <Screen
      title={t('nav:subTitles.shopEdit')}
      onBack={navigation.back}
      testID="screen-UI-I02-edit"
      footer={
        canEdit ? (
          <Button
            label={t('personal:editShop.save')}
            onPress={() => void save()}
            disabled={!canSave}
            loading={saving}
            testID="edit-shop-save"
          />
        ) : undefined
      }
    >
      {shop.state.status === 'loading' ? (
        <Card testID="edit-shop-loading">
          <View style={{ gap: tokens.space.sm }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" />
          </View>
        </Card>
      ) : null}
      {shop.state.status === 'error' ? (
        <Card>
          <ErrorState
            testID="edit-shop-load-error"
            title={loadMessage.title}
            {...(loadMessage.hint ? { message: loadMessage.hint } : {})}
            onRetry={() => void shop.reload()}
            retrying={shop.refreshing}
          />
        </Card>
      ) : null}
      {shop.state.status === 'ready' && loaded === null ? (
        <Text color="textMuted" testID="edit-shop-no-shop">
          {t('personal:shop.noShop')}
        </Text>
      ) : null}
      {loaded && !canEdit ? (
        <Text color="textMuted" accessibilityRole="alert" testID="edit-shop-no-permission">
          {t('personal:shop.noEditPermission')}
        </Text>
      ) : null}
      {loaded && canEdit ? (
        <View style={{ gap: tokens.space.lg }}>
          <View style={{ alignItems: 'center' }}>
            <Avatar name={value} size="xl" shape="square" testID="edit-shop-avatar" />
          </View>
          <FormField
            label={t('personal:fields.shopName')}
            value={value}
            onChangeText={(next) => {
              setDraft(next);
              setSaveError(null);
            }}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            inputRef={nameRef}
            {...(nameError ? { error: nameError } : {})}
            testID="edit-shop-name"
          />
          <Text variant="caption" color="textMuted">
            {t('personal:shop.renameNote')}
          </Text>
          {saveMessage ? (
            <Text color="danger" accessibilityRole="alert" testID="edit-shop-save-error">
              {saveMessage}
            </Text>
          ) : null}
        </View>
      ) : null}
      <ConfirmDialog
        visible={leaveVisible}
        destructive
        title={t('personal:editShop.leaveTitle')}
        message={t('personal:editShop.leaveMessage')}
        confirmLabel={t('personal:editShop.leaveConfirm')}
        cancelLabel={t('personal:editShop.leaveCancel')}
        onCancel={() => setLeaveVisible(false)}
        onConfirm={() => {
          setLeaveVisible(false);
          allowLeave();
          navigation.back();
        }}
      />
    </Screen>
  );
}
