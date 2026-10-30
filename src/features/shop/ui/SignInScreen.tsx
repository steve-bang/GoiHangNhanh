import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEnabledSocialProviders } from '@/core/config/feature-flags';
import { resolveErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { useSession } from '@/features/personal';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

import { normalizeEmail, validateEmail } from '../domain/validation';
import { computeSignInLayout } from './auth-layout';
import { LINK_ROW_HEIGHT, SOCIAL_BUTTON_HEIGHT } from './onboarding-layout';
import { StackedBrandLogo } from './BrandLogo';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import { PasswordToggle, SocialIconRow, SuccessBanner } from './onboarding/AuthParts';
import { FormErrorBanner, IconField, type TextInputHandle } from './onboarding/OnboardingParts';
import { isRetryable, useGatewayTask } from './onboarding/useGatewayTask';
import { WelcomeIllustration } from './WelcomeIllustration';

/**
 * UI-A03, biến thể đăng nhập bằng email + mật khẩu (docs/09 mục 5.1; mockup 05-sign-in-and-recovery,
 * màn thứ nhất). Chỉ chuyển màn khi cổng xác nhận đăng nhập; KHÔNG hiện "đăng nhập thành công". Sai
 * thông tin báo chung (không nói cái nào sai). Mật khẩu chỉ ở state cục bộ của màn này: không vào
 * trạng thái luồng, tham số điều hướng hay log. Email điền sẵn (từ màn đăng ký/đặt lại mật khẩu) đi qua trạng thái luồng trong bộ nhớ, không qua URL.
 */
export function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { dispatch, recovery, dispatchRecovery, gateways } = useOnboardingFlow();
  const session = useSession();
  const providers = getEnabledSocialProviders();

  // Email điền sẵn: từ luồng khôi phục, hoặc từ "Đăng nhập lại" sau khi đăng xuất an toàn (V1-05, chỉ
  // trong bộ nhớ của phiên; không đọc tham số route).
  const [email, setEmail] = useState(recovery.signInEmail ?? session.signInEmailHint ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  // Banner "vừa đặt lại mật khẩu": nhớ lúc mở màn rồi xóa cờ ở luồng để chỉ hiện MỘT lần.
  const [showSuccess] = useState(recovery.resetNotice);
  const { busy, busyRef, formError, setFormError, run, retry } = useGatewayTask();
  const emailRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);
  useEffect(() => {
    // Email điền sẵn và banner chỉ dùng MỘT lần: xóa khỏi trạng thái luồng sau khi đã lấy.
    if (recovery.signInEmail !== null) dispatchRecovery({ type: 'signin_email_consumed' });
    if (session.signInEmailHint !== null) session.setSignInEmailHint(null);
    if (recovery.resetNotice) dispatchRecovery({ type: 'notice_consumed' });
    // chỉ chạy lúc mở màn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailIssue = validateEmail(email);
  const passwordMissing = password.length === 0;
  const emailError =
    touched.email && emailIssue
      ? t(
          emailIssue === 'required'
            ? 'screens:signUp.errors.emailRequired'
            : 'screens:signUp.errors.emailInvalid',
        )
      : undefined;
  const passwordError =
    touched.password && passwordMissing ? t('screens:signIn.errors.passwordRequired') : undefined;
  const banner = formError ? resolveErrorMessage(t, formError) : null;
  const successMessage = t('screens:signIn.resetSuccess');

  const touch = getMinTouchTarget();
  const layout = computeSignInLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    {
      showSocial: providers.length > 0,
      touch,
      errors: {
        ...(emailError ? { email: { chars: emailError.length } } : {}),
        ...(passwordError ? { password: { chars: passwordError.length } } : {}),
        ...(banner
          ? {
              banner: {
                chars: banner.title.length + 1 + (banner.hint?.length ?? 0),
                withRetry: formError ? isRetryable(formError) : false,
              },
            }
          : {}),
      },
      successChars: showSuccess ? successMessage.length : undefined,
    },
  );
  const { gaps, title } = layout;

  const submit = () => {
    if (busyRef.current) return;
    setTouched({ email: true, password: true });
    if (emailIssue) {
      emailRef.current?.focus();
      return;
    }
    if (passwordMissing) {
      passwordRef.current?.focus();
      return;
    }
    const normalized = normalizeEmail(email);
    void run(async (isActive) => {
      const account = await gateways.auth.signInWithPassword({ email: normalized, password });
      // Đã rời màn (Back/đi chỗ khác) trong lúc chờ: không điều hướng thay người dùng.
      if (!isActive()) return;
      // Ghi phiên toàn app (chỉ tầng logic, không đổi giao diện). `shopId` do máy chủ trả (từ
      // `userShops/{uid}`); null = chưa có shop. Họ tên lấy từ Auth, giống phiên khôi phục sau khi mở lại app.
      session.beginSession(
        { uid: account.uid, email: account.email, displayName: account.displayName },
        account.shopId,
      );
      if (account.hasShop) {
        // Rời luồng thiết lập: xóa dữ liệu của tài khoản trước (nếu có) khỏi bộ nhớ luồng.
        dispatch({ type: 'reset' });
        navigation.reset(ROUTES.home);
      } else {
        // Đã có tài khoản nhưng chưa có shop: đi tiếp bước tạo shop (cùng luồng với đăng ký).
        dispatch({ type: 'account_created', account });
        navigation.push(ROUTES.createShop);
      }
    });
  };

  const goForgot = () => {
    const typed = normalizeEmail(email);
    // Điền sẵn email ở màn Quên mật khẩu (chỉ khi chưa gõ gì ở luồng đó).
    if (typed && !recovery.email) dispatchRecovery({ type: 'email_changed', email: typed });
    navigation.push(ROUTES.forgotPassword);
  };

  return (
    <OnboardingScaffold testID="screen-UI-A03" padX={layout.padX} bottomPad={layout.bottomPad}>
      <View style={{ marginTop: gaps.top }}>
        <StackedBrandLogo compact={layout.compact} />
      </View>
      <View style={{ marginTop: gaps.logoToTitle }}>
        <Text accessibilityRole="header" bold style={[title, styles.center, { color: colors.ink }]}>
          {t('screens:signIn.title')}
        </Text>
        <Text style={[styles.center, { color: colors.inkMuted, marginTop: gaps.titleToSubtitle }]}>
          {t('screens:signIn.subtitle')}
        </Text>
      </View>

      {layout.illustrationHeight > 0 ? (
        <View style={styles.illustrationSlot}>
          <WelcomeIllustration height={layout.illustrationHeight} />
        </View>
      ) : null}

      {showSuccess ? (
        <View style={{ marginTop: gaps.toFields }}>
          <SuccessBanner testID="signin-reset-success" message={successMessage} />
        </View>
      ) : null}

      <View style={{ marginTop: gaps.toFields, gap: gaps.betweenFields }}>
        <IconField
          testID="signin-email"
          label={t('screens:signIn.emailLabel')}
          placeholder={t('screens:signIn.emailPlaceholder')}
          icon="mail"
          height={layout.fieldHeight}
          value={email}
          onChangeText={(value) => {
            setTouched((prev) => ({ ...prev, email: true }));
            setFormError(null);
            setEmail(value);
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          error={emailError}
          inputRef={emailRef}
          inputProps={{
            keyboardType: 'email-address',
            autoComplete: 'email',
            textContentType: 'emailAddress',
            returnKeyType: 'next',
            onSubmitEditing: () => passwordRef.current?.focus(),
            blurOnSubmit: false,
          }}
        />
        <IconField
          testID="signin-password"
          label={t('screens:signIn.passwordLabel')}
          placeholder={t('screens:signIn.passwordPlaceholder')}
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
            secureTextEntry: !showPassword,
            autoComplete: 'current-password',
            textContentType: 'password',
            returnKeyType: 'go',
            onSubmitEditing: submit,
          }}
          accessory={
            <PasswordToggle
              testID="signin-toggle-password"
              shown={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
              showLabel={t('screens:signIn.showPassword')}
              hideLabel={t('screens:signIn.hidePassword')}
            />
          }
        />
      </View>

      <Pressable
        testID="signin-forgot"
        accessibilityRole="link"
        accessibilityLabel={t('screens:signIn.forgot')}
        onPress={goForgot}
        hitSlop={8}
        style={[styles.forgot, { minHeight: Math.max(touch, LINK_ROW_HEIGHT) }]}
      >
        <Text bold style={{ color: colors.brand }}>
          {t('screens:signIn.forgot')}
        </Text>
      </Pressable>

      {formError ? (
        <View style={{ marginBottom: spacing.md }}>
          <FormErrorBanner
            code={formError}
            {...(isRetryable(formError) ? { onRetry: retry } : {})}
          />
        </View>
      ) : null}

      <Button
        testID="signin-submit"
        label={t('screens:signIn.submit')}
        loading={busy}
        onPress={submit}
      />

      {providers.length > 0 ? (
        <View testID="signin-social-group" style={{ marginTop: 16 }}>
          <View style={[styles.dividerRow, { gap: spacing.md }]}>
            <View style={[styles.line, { backgroundColor: colors.fieldBorder }]} />
            <Text variant="caption" style={{ color: colors.inkMuted }}>
              {t('screens:signIn.orSignInWith')}
            </Text>
            <View style={[styles.line, { backgroundColor: colors.fieldBorder }]} />
          </View>
          <View style={{ marginTop: 12 }}>
            <SocialIconRow
              providers={providers}
              disabled={busy}
              minHeight={SOCIAL_BUTTON_HEIGHT}
              labelOf={(provider) =>
                t(
                  provider === 'apple'
                    ? 'screens:signIn.signInWithApple'
                    : 'screens:signIn.signInWithGoogle',
                )
              }
              onPress={(provider) => void run(() => gateways.auth.signInWithProvider(provider))}
            />
          </View>
        </View>
      ) : null}

      <View style={[styles.linkRow, { minHeight: LINK_ROW_HEIGHT, marginTop: 8 }]}>
        <Text style={{ color: colors.inkMuted }}>{t('screens:signIn.noAccount')}</Text>
        <Pressable
          testID="signin-to-sign-up"
          accessibilityRole="link"
          accessibilityLabel={t('screens:signIn.createAccount')}
          onPress={() => navigation.push(ROUTES.signUp)}
          hitSlop={8}
          style={{ minHeight: touch, justifyContent: 'center' }}
        >
          <Text bold style={{ color: colors.brand }}>
            {t('screens:signIn.createAccount')}
          </Text>
        </Pressable>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  illustrationSlot: { paddingTop: 8 },
  forgot: { alignSelf: 'flex-end', justifyContent: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
});
