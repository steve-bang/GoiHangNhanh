import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useIsScreenActive } from '@/platform';
import { Button, PasswordField, Screen, Text, useTheme, useToast } from '@/shared/ui';

import {
  validateConfirmNewPassword,
  validateCurrentPassword,
  validateNewPassword,
} from '../domain/validation';
import { usePersonalGateways } from './PersonalGatewaysProvider';

/** Mã lỗi buộc đăng nhập lại: không có cách nào sửa ngay tại màn này. */
const NEEDS_SIGN_IN: readonly ErrorCode[] = ['AUTH_REQUIRES_RECENT_LOGIN', 'AUTH_SESSION_EXPIRED'];

/**
 * Đổi mật khẩu (PER-04), route con của UI-I05 (decisions.md Q-19k). Chỉ dành cho tài khoản đăng nhập
 * bằng mật khẩu (D-13, Q-19c): màn vào từ UI-I01 chỉ hiện lối vào đó khi `signInMethod === 'password'`.
 * Không log, không giữ mật khẩu ngoài state của màn; thành công chỉ báo SAU KHI cổng xác nhận.
 */
export function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const isActive = useIsScreenActive();
  const { account } = usePersonalGateways();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<ErrorCode | null>(null);
  const busyRef = useRef(false);

  const currentIssue = validateCurrentPassword(current);
  const nextIssue = validateNewPassword(current, next);
  const confirmIssue = validateConfirmNewPassword(next, confirm);
  const valid = !currentIssue && !nextIssue && !confirmIssue;

  // Lỗi từ máy chủ gắn đúng ô; ô khác chỉ báo sau khi bấm Đổi mật khẩu hoặc khi ô đã có nội dung sai.
  const wrongCurrent = serverError === 'AUTH_WRONG_CURRENT_PASSWORD';
  const weakNext = serverError === 'AUTH_WEAK_PASSWORD';
  const currentError = wrongCurrent
    ? errorText(resolveErrorMessage(t, 'AUTH_WRONG_CURRENT_PASSWORD'))
    : submitted && currentIssue
      ? t(`personal:validation.currentPassword.${currentIssue}`)
      : undefined;
  const nextError = weakNext
    ? errorText(resolveErrorMessage(t, 'AUTH_WEAK_PASSWORD'))
    : (submitted || next.length > 0) && nextIssue
      ? t(`personal:validation.newPassword.${nextIssue}`)
      : undefined;
  const confirmError =
    (submitted || confirm.length > 0) && confirmIssue
      ? t(`personal:validation.confirmNewPassword.${confirmIssue}`)
      : undefined;

  const bannerCode = serverError && !wrongCurrent && !weakNext ? serverError : null;
  const bannerMessage = bannerCode ? errorText(resolveErrorMessage(t, bannerCode)) : null;

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setServerError(null);
  };

  const submit = async () => {
    if (busyRef.current) return;
    setSubmitted(true);
    if (!valid) return;
    busyRef.current = true;
    setSaving(true);
    setServerError(null);
    try {
      await account.changePassword({ currentPassword: current, newPassword: next });
      toast.show(t('personal:changePassword.saved'), { tone: 'success' });
      if (isActive()) navigation.back();
    } catch (error) {
      setServerError(error instanceof AppError ? error.code : 'AUTH_SERVICE_UNAVAILABLE');
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      title={t('nav:subTitles.changePassword')}
      onBack={navigation.back}
      testID="screen-UI-I05-change-password"
      footer={
        <Button
          label={t('personal:changePassword.submit')}
          onPress={() => void submit()}
          disabled={saving}
          loading={saving}
          testID="change-password-submit"
        />
      }
    >
      <View style={{ gap: tokens.space.lg }}>
        <PasswordField
          label={t('personal:fields.currentPassword')}
          value={current}
          onChangeText={edit(setCurrent)}
          autoComplete="current-password"
          {...(currentError ? { error: currentError } : {})}
          testID="change-password-current"
        />
        <PasswordField
          label={t('personal:fields.newPassword')}
          value={next}
          onChangeText={edit(setNext)}
          autoComplete="new-password"
          hint={t('personal:hints.newPassword')}
          {...(nextError ? { error: nextError } : {})}
          testID="change-password-new"
        />
        <PasswordField
          label={t('personal:fields.confirmNewPassword')}
          value={confirm}
          onChangeText={edit(setConfirm)}
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          {...(confirmError ? { error: confirmError } : {})}
          testID="change-password-confirm"
        />
        {bannerMessage && bannerCode ? (
          <View style={{ gap: tokens.space.sm }}>
            <Text color="danger" accessibilityRole="alert" testID="change-password-error">
              {bannerMessage}
            </Text>
            {NEEDS_SIGN_IN.includes(bannerCode) ? (
              <Button
                label={t('personal:changePassword.signInAgain')}
                variant="secondary"
                onPress={() => navigation.reset(ROUTES.signIn)}
                testID="change-password-sign-in"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
