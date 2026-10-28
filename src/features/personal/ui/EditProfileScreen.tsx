import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import type { ErrorCode } from '@/core/errors/codes';
import { useAppNavigation, useConfirmBeforeLeave, useIsScreenActive } from '@/platform';
import {
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

import { normalizeDisplayName, validateDisplayName } from '../domain/validation';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { toErrorCode, useRegion } from './use-region';

/**
 * Sửa hồ sơ (PER-02/03), route con của UI-I01 (decisions.md Q-20k), dựng theo board 07 khung 2: nhãn
 * "Họ và tên *", ô chữ, nút Lưu ngay dưới ô. Chỉ sửa họ tên; board không có ô email nên không dựng
 * (email vẫn hiện ở thẻ hồ sơ màn Cá nhân; chưa có xác minh đổi email). Không dựng avatar lớn vì chưa có
 * chọn ảnh. Nút Lưu chỉ tắt khi chưa có thay đổi hoặc đang gửi; kiểm tra khi bấm Lưu,
 * lỗi hiện tại ô và focus vào ô đó. Thành công chỉ được báo
 * SAU KHI cổng xác nhận; lỗi lưu hiện ngay tại màn và giữ nguyên điều người dùng đã gõ.
 */
export function EditProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const isActive = useIsScreenActive();
  const { account } = usePersonalGateways();
  const session = useSession();
  const profile = useRegion(() => account.getProfile(), session.key);

  // `null` = chưa gõ gì: ô hiện họ tên đang lưu.
  const [draft, setDraft] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ErrorCode | null>(null);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const busyRef = useRef(false);
  const nameRef = useRef<TextFieldInput>(null);

  const loaded = profile.state.status === 'ready' ? profile.state.data : null;
  const original = loaded?.displayName ?? '';
  const value = draft ?? original;
  const issue = draft === null ? null : validateDisplayName(draft);
  const dirty =
    loaded !== null &&
    draft !== null &&
    normalizeDisplayName(draft) !== normalizeDisplayName(original);
  const canSave = loaded !== null && dirty && !saving;

  const { allowLeave } = useConfirmBeforeLeave(dirty, () => setLeaveVisible(true));

  const save = async () => {
    if (busyRef.current || !loaded || draft === null) return;
    if (validateDisplayName(draft) !== null) {
      setSubmitted(true);
      nameRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await account.updateProfile({ displayName: normalizeDisplayName(draft) });
      // Cổng đã xác nhận: cập nhật phiên (màn Cá nhân tải lại tên mới), rồi mới báo thành công.
      session.updateDisplayName(updated.displayName);
      toast.show(t('personal:editProfile.saved'), { tone: 'success' });
      allowLeave();
      // Đã rời màn trong lúc chờ: không điều hướng thay người dùng.
      if (isActive()) navigation.back();
    } catch (error) {
      setSaveError(toErrorCode(error));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const nameError = submitted && issue ? t(`personal:validation.displayName.${issue}`) : undefined;
  const loadMessage = resolveErrorMessage(
    t,
    profile.state.status === 'error' ? profile.state.code : 'AUTH_SERVICE_UNAVAILABLE',
  );
  const saveMessage = saveError ? errorText(resolveErrorMessage(t, saveError)) : null;

  return (
    <Screen
      title={t('nav:subTitles.editProfile')}
      onBack={navigation.back}
      testID="screen-UI-I01-edit-profile"
    >
      {profile.state.status === 'loading' ? (
        <Card testID="edit-profile-loading">
          <View style={{ gap: tokens.space.sm }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" />
          </View>
        </Card>
      ) : null}
      {profile.state.status === 'error' ? (
        <Card>
          <ErrorState
            testID="edit-profile-load-error"
            title={loadMessage.title}
            {...(loadMessage.hint ? { message: loadMessage.hint } : {})}
            onRetry={() => void profile.reload()}
            retrying={profile.refreshing}
          />
        </Card>
      ) : null}
      {loaded ? (
        <View style={{ gap: tokens.space.lg }}>
          <FormField
            label={t('personal:fields.displayName')}
            required
            value={value}
            onChangeText={(next) => {
              setDraft(next);
              setSaveError(null);
            }}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            inputRef={nameRef}
            {...(nameError ? { error: nameError } : {})}
            testID="edit-profile-name"
          />
          {saveMessage ? (
            <Text color="danger" accessibilityRole="alert" testID="edit-profile-save-error">
              {saveMessage}
            </Text>
          ) : null}
          {/* Board 07 khung 2: Lưu ngay dưới ô (không ghim đáy). */}
          <Button
            label={t('personal:editProfile.save')}
            onPress={() => void save()}
            disabled={!canSave}
            loading={saving}
            testID="edit-profile-save"
          />
        </View>
      ) : null}
      <ConfirmDialog
        visible={leaveVisible}
        destructive
        title={t('personal:editProfile.leaveTitle')}
        message={t('personal:editProfile.leaveMessage')}
        confirmLabel={t('personal:editProfile.leaveConfirm')}
        cancelLabel={t('personal:editProfile.leaveCancel')}
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
