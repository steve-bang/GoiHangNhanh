import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ErrorCode } from '@/core/errors/codes';
import { resolveErrorMessage, type ErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

import { maskEmail } from '../domain/mask-email';
import { DEFAULT_RESEND_SECONDS, formatCountdown } from '../domain/otp';
import { computeForgotLayout } from './auth-layout';
import { SuccessBanner, TipCard, useCountdown } from './onboarding/AuthParts';
import { LockIllustration } from './onboarding/AuthIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import { FormErrorBanner } from './onboarding/OnboardingParts';
import { isRetryable, useGatewayTask } from './onboarding/useGatewayTask';

/**
 * UI-A07 (route con `/forgot-password/sent`) Kiểm tra hộp thư: sau khi gửi thư đặt lại mật khẩu của
 * Firebase (D-14 v1, `PASSWORD_RECOVERY_MODE = 'email_link'`; decisions.md Q-29 / V1-03).
 * TRUNG TÍNH: "Nếu email này đã đăng ký..."; email luôn được che. Nằm TRÊN màn Quên mật khẩu trong
 * ngăn xếp (Back/Đổi email về đó, giữ email). Vào thẳng khi chưa gửi thì về Quên mật khẩu.
 * Không hứa thư chắc chắn tới; mật khẩu mới đặt trên trang của Firebase, không phải trong app.
 * Màu chữ theo vai trò của `Text` (`ink`/`inkMuted`/`brand`) để cùng bảng màu với các màn trước/sau
 * trong luồng (khung ngoài `Screen`); khoảng cách theo token, không viết số thiết kế.
 */
export function RecoveryEmailSentScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { recovery, dispatchRecovery, gateways } = useOnboardingFlow();
  const requestedEmail = recovery.requestedEmail;
  // Chặn vào bằng đường dẫn trực tiếp: kiểm tra một lần lúc mở màn.
  const [allowed] = useState(requestedEmail !== null);
  useEffect(() => {
    if (!allowed) navigation.replace(ROUTES.forgotPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [resent, setResent] = useState(false);
  const { busy, busyRef, formError, run, retry } = useGatewayTask();
  const seconds = useCountdown(recovery.resendAvailableAt);

  /** Cùng lời với màn Quên mật khẩu ở chế độ email. */
  const override = (code: ErrorCode): ErrorMessage | undefined => {
    if (code === 'AUTH_TOO_MANY_REQUESTS')
      return { title: t('screens:forgot.errors.emailTooMany') };
    if (code === 'AUTH_SERVICE_UNAVAILABLE')
      return { title: t('screens:forgot.errors.emailSendFailed') };
    return undefined;
  };
  const bannerMessage = formError
    ? (override(formError) ?? resolveErrorMessage(t, formError))
    : null;

  const touch = getMinTouchTarget();
  const description = t('screens:recoverySent.description', {
    email: maskEmail(requestedEmail ?? ''),
  });
  // Màn này không có ô nhập; hai đoạn mô tả thay chỗ, nên ước tính theo tổng độ dài hai đoạn.
  const layout = computeForgotLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    { touch, descriptionChars: description.length + t('screens:recoverySent.nextStep').length },
  );
  const { gaps, title } = layout;

  const resend = () => {
    if (!requestedEmail || busyRef.current) return;
    setResent(false);
    void run(async (isActive) => {
      const result = await gateways.auth.requestPasswordRecovery(requestedEmail);
      if (!isActive()) return;
      dispatchRecovery({
        type: 'code_requested',
        email: requestedEmail,
        resendAvailableAt: Date.now() + (result.retryAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000,
      });
      setResent(true);
    });
  };

  const backToSignIn = () => {
    const email = requestedEmail;
    dispatchRecovery({ type: 'left_flow' });
    if (email) dispatchRecovery({ type: 'signin_email_set', email });
    navigation.reset(ROUTES.signIn);
  };

  if (!allowed || !requestedEmail) return null;

  return (
    <OnboardingScaffold
      testID="screen-UI-A07-sent"
      padX={layout.padX}
      bottomPad={layout.bottomPad}
      onBack={navigation.back}
      headerTitle={t('screens:recoverySent.headerTitle')}
    >
      {layout.illustrationHeight > 0 ? (
        <View style={{ marginTop: gaps.afterHeader }}>
          <LockIllustration height={layout.illustrationHeight} />
        </View>
      ) : null}
      <View style={{ marginTop: gaps.illustrationToTitle }}>
        <Text accessibilityRole="header" bold color="ink" style={[title, styles.center]}>
          {t('screens:recoverySent.title')}
        </Text>
        <Text
          testID="recovery-sent-description"
          color="inkMuted"
          style={[styles.center, { marginTop: gaps.titleToDescription }]}
        >
          {description}
        </Text>
        <Text color="inkMuted" style={[styles.center, { marginTop: tokens.space.sm }]}>
          {t('screens:recoverySent.nextStep')}
        </Text>
      </View>
      <View style={[styles.linkRow, { minHeight: touch }]}>
        <Text color="inkMuted">{t('screens:recoverySent.notYours')}</Text>
        <Pressable
          testID="recovery-sent-change-email"
          accessibilityRole="link"
          accessibilityLabel={t('screens:recoverySent.changeEmail')}
          onPress={navigation.back}
          hitSlop={tokens.space.sm}
          style={[styles.pressable, { minHeight: touch }]}
        >
          <Text bold color="brand">
            {t('screens:recoverySent.changeEmail')}
          </Text>
        </Pressable>
      </View>

      {resent ? (
        <View style={{ marginTop: tokens.space.sm }}>
          <SuccessBanner testID="recovery-sent-resent" message={t('screens:recoverySent.resent')} />
        </View>
      ) : null}

      {formError && bannerMessage ? (
        <View style={{ marginTop: tokens.space.md }}>
          <FormErrorBanner
            code={formError}
            message={bannerMessage}
            {...(isRetryable(formError) ? { onRetry: retry } : {})}
          />
        </View>
      ) : null}

      <View style={{ marginTop: gaps.toButton }}>
        <Button
          testID="recovery-sent-back-to-sign-in"
          label={t('screens:recoverySent.backToSignIn')}
          onPress={backToSignIn}
        />
      </View>
      <View style={[styles.linkRow, { minHeight: touch, marginTop: tokens.space.sm }]}>
        {seconds > 0 ? (
          <Text testID="recovery-sent-countdown" variant="caption" color="inkMuted">
            {t('screens:recoverySent.resendIn', { time: formatCountdown(seconds) })}
          </Text>
        ) : (
          <Pressable
            testID="recovery-sent-resend"
            accessibilityRole="button"
            accessibilityLabel={t('screens:recoverySent.resend')}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={resend}
            hitSlop={tokens.space.sm}
            style={[styles.pressable, { minHeight: touch }]}
          >
            <Text bold color="brand">
              {t('screens:recoverySent.resend')}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.spacer, { minHeight: tokens.space.md }]} />
      <TipCard
        testID="recovery-sent-tip"
        icon="bulb"
        title={t('screens:recoverySent.tipTitle')}
        body={t('screens:recoverySent.tipBody')}
      />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  pressable: { justifyContent: 'center' },
  spacer: { flexGrow: 1 },
});
