import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PASSWORD_RECOVERY_MODE } from '@/core/config/feature-flags';
import type { ErrorCode } from '@/core/errors/codes';
import { resolveErrorMessage, type ErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

import { validateConfirmPassword, validatePassword } from '../domain/validation';
import { AUTH_TITLE_VARIANT, computeNewPasswordLayout } from './auth-layout';
import { PasswordToggle, RequirementCard } from './onboarding/AuthParts';
import { LockCheckIllustration } from './onboarding/AuthIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import { FormErrorBanner, IconField, type TextInputHandle } from './onboarding/OnboardingParts';
import { isRetryable, useGatewayTask } from './onboarding/useGatewayTask';

/**
 * UI-A09 Mật khẩu mới (mockup 05, màn thứ tư). Chỉ vào được khi đã có "vé" từ màn Nhập mã (kiểm tra
 * một lần lúc mở màn). Mật khẩu chỉ ở state cục bộ. Đặt lại xong: về Đăng nhập (xóa lịch sử) kèm
 * banner thành công một lần. Phiên hết hạn: xóa mật khẩu đã gõ, nút "Quay lại bước đầu".
 */
export function NewPasswordScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { recovery, dispatchRecovery, gateways } = useOnboardingFlow();
  // Vé hết hạn theo hạn cổng báo (nếu có) thì coi như chưa có vé: phải nhập mã lại.
  const [ticket] = useState(() =>
    recovery.ticket !== null &&
    recovery.ticketExpiresAt !== null &&
    Date.now() >= recovery.ticketExpiresAt
      ? null
      : recovery.ticket,
  );
  const [requestedEmail] = useState(recovery.requestedEmail);
  // Chế độ thư đặt lại (v1, D-14): mật khẩu mới đặt trên trang của Firebase, màn này không có lối
  // vào; liên kết sâu thì về Đăng nhập (decisions.md Q-29 / V1-03).
  const otpMode = PASSWORD_RECOVERY_MODE === 'otp';
  const allowed = otpMode && ticket !== null;
  useEffect(() => {
    if (!otpMode) {
      navigation.replace(ROUTES.signIn);
    } else if (!allowed) {
      if (recovery.ticket !== null) dispatchRecovery({ type: 'ticket_expired' });
      navigation.replace(requestedEmail ? ROUTES.verifyOtp : ROUTES.forgotPassword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ password: false, confirm: false });
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const { busy, busyRef, formError, setFormError, run, retry } = useGatewayTask();
  const passwordRef = useRef<TextInputHandle>(null);
  const confirmRef = useRef<TextInputHandle>(null);

  const passwordIssue = validatePassword(password);
  const confirmIssue = validateConfirmPassword(password, confirm);
  const passwordError =
    touched.password && passwordIssue
      ? t(
          passwordIssue === 'required'
            ? 'screens:newPassword.errors.newRequired'
            : 'screens:signUp.errors.passwordTooShort',
        )
      : undefined;
  const confirmError =
    touched.confirm && confirmIssue
      ? t(
          confirmIssue === 'required'
            ? 'screens:newPassword.errors.confirmRequired'
            : 'screens:newPassword.errors.mismatch',
        )
      : undefined;
  const canSubmit = passwordIssue === null && confirmIssue === null;

  const override = (code: ErrorCode): ErrorMessage | undefined =>
    code === 'AUTH_SERVICE_UNAVAILABLE'
      ? { title: t('screens:newPassword.errors.systemBusy') }
      : undefined;
  const bannerMessage = formError
    ? (override(formError) ?? resolveErrorMessage(t, formError))
    : null;
  const sessionExpired = formError === 'AUTH_RESET_SESSION_EXPIRED';

  const touch = getMinTouchTarget();
  const layout = computeNewPasswordLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    {
      touch,
      errors: {
        ...(passwordError ? { password: { chars: passwordError.length } } : {}),
        ...(confirmError ? { confirm: { chars: confirmError.length } } : {}),
        ...(bannerMessage
          ? {
              banner: {
                chars: bannerMessage.title.length + 1 + (bannerMessage.hint?.length ?? 0),
                withRetry: true,
              },
            }
          : {}),
      },
    },
  );
  const { gaps } = layout;

  const submit = () => {
    if (busyRef.current || !ticket) return;
    setTouched({ password: true, confirm: true });
    if (passwordIssue) {
      passwordRef.current?.focus();
      return;
    }
    if (confirmIssue) {
      confirmRef.current?.focus();
      return;
    }
    void run(
      async (isActive) => {
        await gateways.auth.resetPassword({ ticket, newPassword: password });
        // Mật khẩu đã đổi trên máy chủ: luôn xóa vé khỏi luồng (kèm email điền sẵn + banner cho
        // màn Đăng nhập), nhưng chỉ điều hướng nếu người dùng còn ở màn này.
        dispatchRecovery({ type: 'reset_completed' });
        if (!isActive()) return;
        navigation.reset(ROUTES.signIn);
      },
      (code) => {
        if (code === 'AUTH_RESET_SESSION_EXPIRED') {
          // Phiên đã hết hạn: không giữ mật khẩu đã gõ.
          setPassword('');
          setConfirm('');
          setTouched({ password: false, confirm: false });
        }
        return false;
      },
    );
  };

  if (!allowed) return null;

  const toggle = (key: 'password' | 'confirm') => (
    <PasswordToggle
      testID={`newpass-toggle-${key}`}
      shown={show[key]}
      onToggle={() => setShow((prev) => ({ ...prev, [key]: !prev[key] }))}
      showLabel={t('screens:newPassword.showPassword')}
      hideLabel={t('screens:newPassword.hidePassword')}
    />
  );

  return (
    <OnboardingScaffold
      testID="screen-UI-A09"
      padX={layout.padX}
      bottomPad={layout.bottomPad}
      onBack={navigation.back}
      headerTitle={t('screens:newPassword.headerTitle')}
    >
      {layout.illustrationHeight > 0 ? (
        <View style={{ marginTop: gaps.afterHeader }}>
          <LockCheckIllustration height={layout.illustrationHeight} />
        </View>
      ) : null}
      <View style={{ marginTop: gaps.illustrationToTitle }}>
        <Text
          accessibilityRole="header"
          variant={AUTH_TITLE_VARIANT}
          style={{ color: tokens.color.text.strong }}
        >
          {t('screens:newPassword.title')}
        </Text>
        <Text style={{ color: tokens.color.text.subtle, marginTop: gaps.titleToDescription }}>
          {t('screens:newPassword.description')}
        </Text>
      </View>

      <View style={{ marginTop: gaps.toFields, gap: gaps.betweenFields }}>
        <IconField
          testID="newpass-password"
          label={t('screens:newPassword.newLabel')}
          placeholder={t('screens:newPassword.newPlaceholder')}
          icon="lock"
          height={layout.fieldHeight}
          value={password}
          onChangeText={(value) => {
            setTouched((prev) => ({ ...prev, password: true }));
            setFormError(null);
            setPassword(value);
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          error={passwordError}
          inputRef={passwordRef}
          inputProps={{
            secureTextEntry: !show.password,
            autoComplete: 'new-password',
            textContentType: 'newPassword',
            passwordRules: 'minlength: 8;',
            returnKeyType: 'next',
            onSubmitEditing: () => confirmRef.current?.focus(),
            blurOnSubmit: false,
          }}
          accessory={toggle('password')}
        />
        <IconField
          testID="newpass-confirm"
          label={t('screens:newPassword.confirmLabel')}
          placeholder={t('screens:newPassword.confirmPlaceholder')}
          icon="lock"
          height={layout.fieldHeight}
          value={confirm}
          onChangeText={(value) => {
            setTouched((prev) => ({ ...prev, confirm: true }));
            setFormError(null);
            setConfirm(value);
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
          error={confirmError}
          inputRef={confirmRef}
          inputProps={{
            secureTextEntry: !show.confirm,
            autoComplete: 'new-password',
            textContentType: 'newPassword',
            returnKeyType: 'go',
            onSubmitEditing: submit,
          }}
          accessory={toggle('confirm')}
        />
      </View>

      <View style={{ marginTop: gaps.toRules }}>
        <RequirementCard
          testID="newpass-rules"
          title={t('screens:newPassword.rulesTitle')}
          label={t('screens:newPassword.ruleLength')}
          met={passwordIssue === null}
          accessibilityLabel={t(
            passwordIssue === null
              ? 'screens:newPassword.ruleMetA11y'
              : 'screens:newPassword.ruleUnmetA11y',
          )}
        />
      </View>

      {formError && bannerMessage ? (
        <View style={{ marginTop: tokens.space.md }}>
          <FormErrorBanner
            code={formError}
            message={bannerMessage}
            {...(sessionExpired
              ? {
                  action: {
                    label: t('screens:newPassword.backToStart'),
                    onPress: navigation.back,
                    testID: 'newpass-back-to-start',
                  },
                }
              : isRetryable(formError)
                ? { onRetry: retry }
                : {})}
          />
        </View>
      ) : null}

      <View style={[styles.buttonSlot, { marginTop: gaps.toButton }]}>
        <Button
          testID="newpass-submit"
          label={t('screens:newPassword.submit')}
          disabled={!canSubmit}
          loading={busy}
          onPress={submit}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({ buttonSlot: { alignSelf: 'stretch' } });
