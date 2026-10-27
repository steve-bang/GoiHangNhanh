import { resolveErrorMessage } from '@/core/i18n/error-message';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

import { maskEmail } from '../domain/mask-email';
import { DEFAULT_RESEND_SECONDS, formatCountdown, isOtpComplete, sanitizeOtp } from '../domain/otp';
import { computeOtpLayout } from './auth-layout';
import { OtpBoxes, SuccessBanner, TipCard, useCountdown } from './onboarding/AuthParts';
import { PhoneCodeIllustration } from './onboarding/AuthIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import { FieldError, FormErrorBanner, type TextInputHandle } from './onboarding/OnboardingParts';
import { isRetryable, useGatewayTask } from './onboarding/useGatewayTask';

/**
 * UI-A08 Nhập mã xác minh (mockup 05, màn thứ ba). Một ô nhập thật vẽ thành 6 ô số; tự xác minh khi
 * đủ 6 chữ số (vẫn có nút Xác minh). Không vào được khi chưa xin mã (về Quên mật khẩu). Mô tả trung
 * tính: không khẳng định email có tài khoản. Mã người dùng gõ chỉ ở state cục bộ, không log.
 */
export function VerifyOtpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
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

  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<'incomplete' | 'AUTH_OTP_INVALID' | null>(null);
  const [notice, setNotice] = useState(false);
  const { busy, busyRef, formError, setFormError, run, retry } = useGatewayTask();
  const inputRef = useRef<TextInputHandle>(null);
  const seconds = useCountdown(recovery.resendAvailableAt);

  const complete = isOtpComplete(code);
  const bannerMessage = formError ? resolveErrorMessage(t, formError) : null;
  const fieldMessage =
    fieldError === 'incomplete'
      ? t('screens:otp.errors.incomplete')
      : fieldError
        ? t(`errors:${fieldError}`)
        : undefined;

  const touch = getMinTouchTarget();
  const layout = computeOtpLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    {
      touch,
      fieldError: fieldMessage ? { chars: fieldMessage.length } : undefined,
      banner: bannerMessage
        ? {
            chars: bannerMessage.title.length + 1 + (bannerMessage.hint?.length ?? 0),
            withRetry: true,
          }
        : undefined,
      notice,
    },
  );
  const { gaps, title } = layout;

  const verify = (value: string) => {
    if (!requestedEmail || busyRef.current) return;
    void run(
      async (isActive) => {
        const { ticket, expiresInSeconds } = await gateways.auth.verifyRecoveryCode({
          email: requestedEmail,
          code: value,
        });
        // Người dùng đã bấm Back/đi chỗ khác trong lúc chờ: không giữ vé, không điều hướng.
        if (!isActive()) return;
        dispatchRecovery({
          type: 'code_verified',
          ticket,
          ticketExpiresAt:
            expiresInSeconds === undefined ? null : Date.now() + expiresInSeconds * 1000,
        });
        // replace: mã đã dùng xong, Back từ màn sau về Quên mật khẩu chứ không về màn nhập mã
        navigation.replace(ROUTES.newPassword);
      },
      (errorCode) => {
        if (errorCode === 'AUTH_OTP_INVALID') {
          setFieldError('AUTH_OTP_INVALID');
          return true;
        }
        return false;
      },
    );
  };

  const onChange = (raw: string) => {
    const next = sanitizeOtp(raw);
    // Gõ/dán thêm khi đã đủ 6 số không đổi mã: không xác minh lại cùng một mã (tránh tốn lượt thử).
    if (next === code) return;
    setCode(next);
    setFieldError(null);
    setFormError(null);
    setNotice(false);
    if (isOtpComplete(next)) verify(next);
  };

  const submit = () => {
    if (busyRef.current) return;
    if (!complete) {
      setFieldError('incomplete');
      inputRef.current?.focus();
      return;
    }
    verify(code);
  };

  const resend = () => {
    if (!requestedEmail || busyRef.current) return;
    void run(async (isActive) => {
      const result = await gateways.auth.requestPasswordRecovery(requestedEmail);
      if (!isActive()) return;
      dispatchRecovery({
        type: 'code_requested',
        email: requestedEmail,
        resendAvailableAt: Date.now() + (result.retryAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000,
      });
      setCode('');
      setFieldError(null);
      setNotice(true);
      inputRef.current?.focus();
    });
  };

  if (!allowed || !requestedEmail) return null;

  return (
    <OnboardingScaffold
      testID="screen-UI-A08"
      padX={layout.padX}
      bottomPad={layout.bottomPad}
      onBack={navigation.back}
      headerTitle={t('screens:otp.headerTitle')}
    >
      {layout.illustrationHeight > 0 ? (
        <View style={{ marginTop: gaps.afterHeader }}>
          <PhoneCodeIllustration height={layout.illustrationHeight} />
        </View>
      ) : null}
      <View style={{ marginTop: gaps.illustrationToTitle }}>
        <Text accessibilityRole="header" bold style={[title, styles.center, { color: colors.ink }]}>
          {t('screens:otp.title')}
        </Text>
        <Text
          testID="otp-description"
          style={[styles.center, { color: colors.inkMuted, marginTop: gaps.titleToDescription }]}
        >
          {t('screens:otp.description', { email: maskEmail(requestedEmail) })}
        </Text>
      </View>
      <View style={[styles.linkRow, { minHeight: Math.max(touch, 48) }]}>
        <Text style={{ color: colors.inkMuted }}>{t('screens:otp.notYours')}</Text>
        <Pressable
          testID="otp-change"
          accessibilityRole="link"
          accessibilityLabel={t('screens:otp.change')}
          onPress={navigation.back}
          hitSlop={8}
          style={{ minHeight: touch, justifyContent: 'center' }}
        >
          <Text bold style={{ color: colors.brand }}>
            {t('screens:otp.change')}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: gaps.toBoxes - 8 }}>
        <OtpBoxes
          testID="otp-input"
          value={code}
          onChangeText={onChange}
          label={t('screens:otp.codeLabel')}
          hasError={fieldError === 'AUTH_OTP_INVALID'}
          editable={!busy}
          box={layout.box}
          inputRef={inputRef}
          onBlur={() => {
            // Rời ô khi mới nhập dở: báo thiếu số (không báo khi chưa gõ gì).
            if (code.length > 0 && !complete) setFieldError('incomplete');
          }}
          onSubmitEditing={submit}
        />
        {fieldMessage ? <FieldError testID="otp-error" message={fieldMessage} /> : null}
      </View>

      {notice ? (
        <View style={{ marginTop: spacing.sm }}>
          <SuccessBanner testID="otp-resent" message={t('screens:otp.resent')} />
        </View>
      ) : null}

      {formError && bannerMessage ? (
        <View style={{ marginTop: spacing.md }}>
          <FormErrorBanner
            code={formError}
            {...(formError === 'AUTH_OTP_EXPIRED'
              ? {
                  action: {
                    label: t('screens:otp.resend'),
                    onPress: resend,
                    testID: 'otp-error-resend',
                  },
                }
              : isRetryable(formError)
                ? { onRetry: retry }
                : {})}
          />
        </View>
      ) : null}

      <View style={[styles.linkRow, { minHeight: Math.max(touch, 48), marginTop: 8 }]}>
        {seconds > 0 ? (
          <Text testID="otp-countdown" variant="caption" style={{ color: colors.inkMuted }}>
            {t('screens:otp.resendIn', { time: formatCountdown(seconds) })}
          </Text>
        ) : (
          <Pressable
            testID="otp-resend"
            accessibilityRole="link"
            accessibilityLabel={t('screens:otp.resend')}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={resend}
            hitSlop={8}
            style={{ minHeight: touch, justifyContent: 'center' }}
          >
            <Text bold style={{ color: colors.brand }}>
              {t('screens:otp.resend')}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ marginTop: gaps.toButton }}>
        <Button
          testID="otp-submit"
          label={t('screens:otp.submit')}
          disabled={!complete}
          loading={busy}
          onPress={submit}
        />
      </View>

      <View style={styles.spacer} />
      <TipCard
        testID="otp-tip"
        icon="brand-shield-check"
        title={t('screens:otp.tipTitle')}
        body={t('screens:otp.tipBody')}
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
  spacer: { flexGrow: 1, minHeight: 12 },
});
