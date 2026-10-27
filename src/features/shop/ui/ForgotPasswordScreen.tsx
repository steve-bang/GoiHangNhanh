import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ErrorCode } from '@/core/errors/codes';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation, useRouteParams } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

import { DEFAULT_RESEND_SECONDS } from '../domain/otp';
import { normalizeEmail, validateEmail } from '../domain/validation';
import { computeForgotLayout } from './auth-layout';
import { TipCard } from './onboarding/AuthParts';
import { LockIllustration } from './onboarding/AuthIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import {
  FormErrorBanner,
  IconField,
  resolveErrorMessage,
  type ErrorMessage,
  type TextInputHandle,
} from './onboarding/OnboardingParts';
import { isRetryable, useGatewayTask } from './onboarding/useGatewayTask';

/**
 * UI-A07 Quên mật khẩu (mockup 05, màn thứ hai). TRUNG TÍNH: gửi xong luôn sang màn Nhập mã, không
 * nói email có tài khoản hay không. Email giữ trong luồng khi lỗi và khi quay lại từ màn Nhập mã.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const { recovery, dispatchRecovery, gateways } = useOnboardingFlow();
  const [touched, setTouched] = useState(false);
  const { busy, busyRef, formError, setFormError, run, retry } = useGatewayTask();
  const emailRef = useRef<TextInputHandle>(null);
  const email = recovery.email;
  useEffect(() => {
    // Điền sẵn email từ màn Đăng nhập (chỉ khi chưa gõ gì ở luồng này).
    if (!recovery.email && params.email) {
      dispatchRecovery({ type: 'email_changed', email: params.email });
    }
    // chỉ chạy lúc mở màn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issue = validateEmail(email);
  const emailError =
    touched && issue
      ? t(
          issue === 'required'
            ? 'screens:forgot.errors.emailRequired'
            : 'screens:signUp.errors.emailInvalid',
        )
      : undefined;
  /** Cùng mã lỗi, lời riêng theo ngữ cảnh "xin mã". */
  const override = (code: ErrorCode): ErrorMessage | undefined => {
    if (code === 'AUTH_TOO_MANY_REQUESTS') return { title: t('screens:forgot.errors.tooMany') };
    if (code === 'AUTH_SERVICE_UNAVAILABLE')
      return { title: t('screens:forgot.errors.sendFailed') };
    return undefined;
  };
  const bannerMessage = formError
    ? (override(formError) ?? resolveErrorMessage(t, formError))
    : null;

  const touch = getMinTouchTarget();
  const layout = computeForgotLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    {
      touch,
      errors: {
        ...(emailError ? { email: { chars: emailError.length } } : {}),
        ...(bannerMessage
          ? {
              banner: {
                chars: bannerMessage.title.length + 1 + (bannerMessage.hint?.length ?? 0),
                withRetry: formError ? isRetryable(formError) : false,
              },
            }
          : {}),
      },
    },
  );
  const { gaps, title } = layout;

  const submit = () => {
    if (busyRef.current) return;
    setTouched(true);
    if (issue) {
      emailRef.current?.focus();
      return;
    }
    const normalized = normalizeEmail(email);
    void run(async () => {
      const result = await gateways.auth.requestPasswordRecovery(normalized);
      dispatchRecovery({
        type: 'code_requested',
        email: normalized,
        resendAvailableAt: Date.now() + (result.retryAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000,
      });
      navigation.push(ROUTES.verifyOtp);
    });
  };

  const backToSignIn = () => {
    const typed = normalizeEmail(email);
    if (typed) navigation.reset(ROUTES.signIn, { email: typed });
    else navigation.reset(ROUTES.signIn);
  };

  return (
    <OnboardingScaffold
      testID="screen-UI-A07"
      padX={layout.padX}
      bottomPad={layout.bottomPad}
      onBack={navigation.back}
      headerTitle={t('screens:forgot.headerTitle')}
    >
      {layout.illustrationHeight > 0 ? (
        <View style={{ marginTop: gaps.afterHeader }}>
          <LockIllustration height={layout.illustrationHeight} />
        </View>
      ) : null}
      <View style={{ marginTop: gaps.illustrationToTitle }}>
        <Text accessibilityRole="header" bold style={[title, styles.center, { color: colors.ink }]}>
          {t('screens:forgot.title')}
        </Text>
        <Text
          style={[styles.center, { color: colors.inkMuted, marginTop: gaps.titleToDescription }]}
        >
          {t('screens:forgot.description')}
        </Text>
      </View>

      <View style={{ marginTop: gaps.toField }}>
        <IconField
          testID="forgot-email"
          label={t('screens:forgot.emailLabel')}
          placeholder={t('screens:forgot.emailPlaceholder')}
          icon="mail"
          height={layout.fieldHeight}
          value={email}
          onChangeText={(value) => {
            setTouched(true);
            setFormError(null);
            dispatchRecovery({ type: 'email_changed', email: value });
          }}
          onBlur={() => setTouched(true)}
          error={emailError}
          hint={t('screens:forgot.emailHint')}
          inputRef={emailRef}
          inputProps={{
            keyboardType: 'email-address',
            autoComplete: 'email',
            textContentType: 'emailAddress',
            returnKeyType: 'send',
            onSubmitEditing: submit,
          }}
        />
      </View>

      {formError && bannerMessage ? (
        <View style={{ marginTop: spacing.md }}>
          <FormErrorBanner
            code={formError}
            message={bannerMessage}
            {...(isRetryable(formError) ? { onRetry: retry } : {})}
          />
        </View>
      ) : null}

      <View style={{ marginTop: gaps.toButton }}>
        <Button
          testID="forgot-submit"
          label={t('screens:forgot.submit')}
          loading={busy}
          onPress={submit}
        />
      </View>
      <Pressable
        testID="forgot-back-to-sign-in"
        accessibilityRole="link"
        accessibilityLabel={t('screens:forgot.backToSignIn')}
        onPress={backToSignIn}
        hitSlop={8}
        style={[styles.link, { minHeight: Math.max(touch, 48) }]}
      >
        <Text bold style={{ color: colors.brand }}>
          {t('screens:forgot.backToSignIn')}
        </Text>
      </Pressable>

      <View style={styles.spacer} />
      <TipCard
        testID="forgot-tip"
        icon="bulb"
        title={t('screens:forgot.tipTitle')}
        body={t('screens:forgot.tipBody')}
      />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  link: { alignSelf: 'center', justifyContent: 'center' },
  spacer: { flexGrow: 1, minHeight: 12 },
});
