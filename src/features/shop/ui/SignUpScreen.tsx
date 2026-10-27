import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEnabledSocialProviders, type SocialProvider } from '@/core/config/feature-flags';
import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Icon, Text, useTheme } from '@/shared/ui';

import { normalizeEmail, validateEmail, validatePassword } from '../domain/validation';
import { FormErrorBanner, IconField, type TextInputHandle } from './onboarding/OnboardingParts';
import { ShieldClipboardIllustration } from './onboarding/OnboardingIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import { computeSignUpLayout, LINK_ROW_HEIGHT, SOCIAL_BUTTON_HEIGHT } from './onboarding-layout';

/** Lỗi lạ (không phải AppError) coi như chưa kết nối được dịch vụ: không bao giờ báo thành công. */
export function toErrorCode(error: unknown): ErrorCode {
  return isAppError(error) ? error.code : 'AUTH_SERVICE_UNAVAILABLE';
}

function SocialButton({
  provider,
  disabled,
  onPress,
}: {
  provider: SocialProvider;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      testID={`signup-social-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={t(
        provider === 'apple' ? 'screens:signUp.signUpWithApple' : 'screens:signUp.signUpWithGoogle',
      )}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.social,
        {
          minHeight: Math.max(getMinTouchTarget(), SOCIAL_BUTTON_HEIGHT),
          backgroundColor: colors.surface,
          borderColor: colors.fieldBorder,
          borderRadius: radius.md,
          gap: spacing.sm,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon name={provider} size={20} color={colors.ink} />
      <Text bold color="ink">
        {t(`screens:signUp.${provider}`)}
      </Text>
    </Pressable>
  );
}

/**
 * UI-A03, biến thể tạo tài khoản bằng email + mật khẩu (docs/09 mục 4, 5.1; mockup 01-onboarding,
 * màn thứ hai). Dùng cổng xác thực từ `OnboardingFlowProvider`: chỉ chuyển sang bước tiếp theo khi
 * cổng xác nhận đã tạo tài khoản. Lỗi từ cổng hiện theo mẫu ba phần. Mật khẩu chỉ nằm trong state
 * cục bộ của màn này, không đưa vào trạng thái luồng.
 */
export function SignUpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { state, dispatch, gateways } = useOnboardingFlow();
  const providers = getEnabledSocialProviders();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const emailRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const layout = computeSignUpLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    { showSocial: providers.length > 0 },
  );
  const { gaps, title } = layout;

  const emailIssue = validateEmail(state.email);
  const passwordIssue = validatePassword(password);
  const emailError =
    touched.email && emailIssue
      ? t(
          emailIssue === 'required'
            ? 'screens:signUp.errors.emailRequired'
            : 'screens:signUp.errors.emailInvalid',
        )
      : undefined;
  const passwordError =
    touched.password && passwordIssue
      ? t(
          passwordIssue === 'required'
            ? 'screens:signUp.errors.passwordRequired'
            : 'screens:signUp.errors.passwordTooShort',
        )
      : undefined;

  /** Chạy một lời gọi cổng; chống bấm đúp bằng cờ ref (state chưa kịp cập nhật giữa hai lần chạm). */
  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFormError(null);
    try {
      await task();
    } catch (error) {
      if (mountedRef.current) setFormError(toErrorCode(error));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const submit = () => {
    if (busyRef.current) return;
    setTouched({ email: true, password: true });
    if (emailIssue) {
      emailRef.current?.focus();
      return;
    }
    if (passwordIssue) {
      passwordRef.current?.focus();
      return;
    }
    const email = normalizeEmail(state.email);
    void run(async () => {
      // Tài khoản đã được máy chủ xác nhận ở lần trước (người dùng quay lại màn này): không tạo lần hai.
      if (state.account && state.account.email === email) {
        navigation.push(ROUTES.createShop);
        return;
      }
      const account = await gateways.auth.signUpWithEmail({ email, password });
      dispatch({ type: 'account_created', account });
      navigation.push(ROUTES.createShop);
    });
  };

  const touch = getMinTouchTarget();

  return (
    <OnboardingScaffold
      testID="screen-UI-A03"
      padX={layout.padX}
      bottomPad={layout.bottomPad}
      onBack={navigation.back}
    >
      <View style={{ marginTop: gaps.afterBack }}>
        <Text accessibilityRole="header" bold style={[title, { color: colors.ink }]}>
          {t('screens:signUp.title')}
        </Text>
        <Text style={{ color: colors.inkMuted, marginTop: gaps.titleToSubtitle }}>
          {t('screens:signUp.subtitle')}
        </Text>
      </View>

      <View style={{ marginTop: gaps.subtitleToFields, gap: gaps.betweenFields }}>
        <IconField
          testID="signup-email"
          label={t('screens:signUp.emailLabel')}
          placeholder={t('screens:signUp.emailPlaceholder')}
          icon="mail"
          height={layout.fieldHeight}
          value={state.email}
          onChangeText={(email) => {
            setTouched((prev) => ({ ...prev, email: true }));
            setFormError(null);
            dispatch({ type: 'email_changed', email });
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          error={emailError}
          inputRef={emailRef}
          inputProps={{
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            autoComplete: 'email',
            textContentType: 'emailAddress',
            returnKeyType: 'next',
            onSubmitEditing: () => passwordRef.current?.focus(),
            blurOnSubmit: false,
          }}
        />
        <IconField
          testID="signup-password"
          label={t('screens:signUp.passwordLabel')}
          placeholder={t('screens:signUp.passwordPlaceholder')}
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
            autoComplete: 'new-password',
            textContentType: 'newPassword',
            passwordRules: 'minlength: 8;',
            returnKeyType: 'go',
            onSubmitEditing: submit,
          }}
          accessory={
            <Pressable
              testID="signup-toggle-password"
              accessibilityRole="button"
              accessibilityLabel={t(
                showPassword ? 'screens:signUp.hidePassword' : 'screens:signUp.showPassword',
              )}
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={6}
              style={[styles.eye, { minWidth: touch, minHeight: touch }]}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.inkMuted} />
            </Pressable>
          }
        />
      </View>

      {formError ? (
        <View style={{ marginTop: spacing.md }}>
          <FormErrorBanner code={formError} />
        </View>
      ) : null}

      <View style={{ marginTop: gaps.fieldsToButton }}>
        <Button
          testID="signup-submit"
          label={t('screens:signUp.submit')}
          loading={busy}
          onPress={submit}
        />
      </View>

      {providers.length > 0 ? (
        <View testID="signup-social-group" style={{ marginTop: gaps.buttonToDivider }}>
          <View style={[styles.dividerRow, { gap: spacing.md }]}>
            <View style={[styles.line, { backgroundColor: colors.fieldBorder }]} />
            <Text variant="caption" style={{ color: colors.inkMuted }}>
              {t('screens:signUp.orSignUpWith')}
            </Text>
            <View style={[styles.line, { backgroundColor: colors.fieldBorder }]} />
          </View>
          <View style={[styles.socialRow, { gap: spacing.md, marginTop: gaps.dividerToSocial }]}>
            {providers.map((provider) => (
              <SocialButton
                key={provider}
                provider={provider}
                disabled={busy}
                onPress={() => void run(() => gateways.auth.signInWithProvider(provider))}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.linkRow, { minHeight: LINK_ROW_HEIGHT, marginTop: gaps.socialToLink }]}>
        <Text style={{ color: colors.inkMuted }}>{t('screens:signUp.haveAccount')}</Text>
        <Pressable
          testID="signup-to-sign-in"
          accessibilityRole="link"
          accessibilityLabel={t('screens:signUp.signIn')}
          onPress={() => navigation.push(ROUTES.signIn)}
          hitSlop={8}
          style={{ minHeight: touch, justifyContent: 'center' }}
        >
          <Text bold style={{ color: colors.brand }}>
            {t('screens:signUp.signIn')}
          </Text>
        </Pressable>
      </View>

      {layout.illustrationHeight > 0 ? (
        <View style={styles.illustrationSlot}>
          <ShieldClipboardIllustration height={layout.illustrationHeight} />
        </View>
      ) : null}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  eye: { alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  socialRow: { flexDirection: 'row' },
  social: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  illustrationSlot: { flexGrow: 1, justifyContent: 'center', paddingTop: 16 },
});
