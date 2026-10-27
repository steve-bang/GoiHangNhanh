import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEnabledSocialProviders, type SocialProvider } from '@/core/config/feature-flags';
import type { ErrorCode } from '@/core/errors/codes';
import { resolveErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Icon, Text, useTheme } from '@/shared/ui';

import { normalizeEmail, validateEmail, validatePassword } from '../domain/validation';
import { FormErrorBanner, IconField, type TextInputHandle } from './onboarding/OnboardingParts';
import { ShieldClipboardIllustration } from './onboarding/OnboardingIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';
import {
  computeSignUpLayout,
  LINK_ROW_HEIGHT,
  SOCIAL_BUTTON_HEIGHT,
  type SignUpErrorSpecs,
} from './onboarding-layout';
import { useGatewayTask } from './onboarding/useGatewayTask';

/** Mật khẩu đã gửi đi không còn trong app: ô hiện chấm cố định, không phải mật khẩu thật. */
const LOCKED_PASSWORD_MASK = '••••••••';

/** Lỗi máy chủ gắn với một ô nhập (hiện dưới ô); các lỗi khác hiện ở khung phía trên nút chính. */
type FieldErrorCode = 'AUTH_EMAIL_IN_USE' | 'AUTH_WEAK_PASSWORD';
function isFieldErrorCode(code: ErrorCode): code is FieldErrorCode {
  return code === 'AUTH_EMAIL_IN_USE' || code === 'AUTH_WEAK_PASSWORD';
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
 * cổng xác nhận đã tạo tài khoản. Lỗi gắn với ô (email đã dùng, mật khẩu yếu) hiện dưới ô đó; lỗi chung (mạng, hệ thống) hiện ở khung trên nút chính kèm "Thử lại". Mật khẩu chỉ nằm trong state
 * cục bộ của màn này, không đưa vào trạng thái luồng.
 *
 * Sau khi tài khoản đã tạo, quay lại màn này KHÔNG sửa/tạo lần hai: hai ô bị khóa (chỉ đọc), nút chính
 * là "Tiếp tục" và đi thẳng sang bước tạo shop, không gọi lại cổng đăng ký.
 */
export function SignUpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { state, dispatch, dispatchRecovery, gateways } = useOnboardingFlow();
  const providers = getEnabledSocialProviders();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const { busy, busyRef, formError, setFormError, run, retry } = useGatewayTask();
  /** Lỗi máy chủ gắn với một ô: hiện dưới ô đó và mất khi người dùng sửa ô đó. */
  const [fieldError, setFieldError] = useState<FieldErrorCode | null>(null);
  const emailRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);

  // Tài khoản của email này đã được máy chủ xác nhận trong luồng: khóa ô, không tạo/sửa lần hai.
  const locked =
    state.account !== null &&
    normalizeEmail(state.account.email).toLowerCase() === normalizeEmail(state.email).toLowerCase();

  // Ô chỉ đọc khi đã tạo xong hoặc đang chờ cổng: không đổi email/mật khẩu giữa lúc đã gửi đi.
  const readOnly = locked || busy;

  const emailIssue = validateEmail(state.email);
  const passwordIssue = validatePassword(password);
  const emailError =
    !locked && touched.email && emailIssue
      ? t(
          emailIssue === 'required'
            ? 'screens:signUp.errors.emailRequired'
            : 'screens:signUp.errors.emailInvalid',
        )
      : fieldError === 'AUTH_EMAIL_IN_USE'
        ? t('errors:AUTH_EMAIL_IN_USE')
        : undefined;
  const passwordError =
    !locked && touched.password && passwordIssue
      ? t(
          passwordIssue === 'required'
            ? 'screens:signUp.errors.passwordRequired'
            : 'screens:signUp.errors.passwordTooShort',
        )
      : fieldError === 'AUTH_WEAK_PASSWORD'
        ? t('errors:AUTH_WEAK_PASSWORD')
        : undefined;
  const emailHasSignInAction = !(touched.email && emailIssue) && fieldError === 'AUTH_EMAIL_IN_USE';
  const bannerMessage = formError ? resolveErrorMessage(t, formError) : null;

  const touch = getMinTouchTarget();
  const errorSpecs: SignUpErrorSpecs = {
    email: emailError ? { chars: emailError.length, withAction: emailHasSignInAction } : undefined,
    password: passwordError ? { chars: passwordError.length } : undefined,
    banner: bannerMessage
      ? {
          chars: bannerMessage.title.length + 1 + (bannerMessage.hint?.length ?? 0),
          withRetry: true,
        }
      : undefined,
  };
  const layout = computeSignUpLayout(
    { width, height, insetTop: insets.top, insetBottom: insets.bottom, fontScale },
    { showSocial: providers.length > 0, touch, errors: errorSpecs },
  );
  const { gaps, title } = layout;

  /** Lỗi gắn với một ô hiện dưới ô đó; các lỗi khác thành khung lỗi chung (xử lý ở `useGatewayTask`). */
  const runGateway = (task: Parameters<typeof run>[0]) => {
    setFieldError(null);
    void run(task, (code) => {
      if (!isFieldErrorCode(code)) return false;
      setFieldError(code);
      return true;
    });
  };

  const submit = () => {
    if (busyRef.current) return;
    if (locked) {
      navigation.push(ROUTES.createShop);
      return;
    }
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
    runGateway(async (isActive) => {
      const account = await gateways.auth.signUpWithEmail({ email, password });
      // Tài khoản đã tạo trên máy chủ: ghi nhận dù người dùng đã rời màn, nhưng không điều hướng thay họ.
      // Email trong luồng luôn là email ĐÃ GỬI (không phải giá trị đang gõ) để màn khóa đúng và không tạo lần hai.
      dispatch({ type: 'email_changed', email });
      dispatch({ type: 'account_created', account });
      if (!isActive()) return;
      navigation.push(ROUTES.createShop);
    });
  };

  /** Sang Đăng nhập, mang theo email đang gõ (chỉ email, không bao giờ mật khẩu). */
  const goSignIn = () => {
    const typed = normalizeEmail(state.email);
    if (typed) dispatchRecovery({ type: 'signin_email_set', email: typed });
    navigation.push(ROUTES.signIn);
  };

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
            if (readOnly) return;
            setTouched((prev) => ({ ...prev, email: true }));
            setFormError(null);
            setFieldError((prev) => (prev === 'AUTH_EMAIL_IN_USE' ? null : prev));
            dispatch({ type: 'email_changed', email });
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          error={emailError}
          errorAction={
            emailHasSignInAction
              ? {
                  label: t('screens:signUp.signIn'),
                  onPress: goSignIn,
                  testID: 'signup-email-error-action',
                }
              : undefined
          }
          inputRef={emailRef}
          inputProps={{
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            autoComplete: 'email',
            textContentType: 'emailAddress',
            returnKeyType: 'next',
            onSubmitEditing: () => passwordRef.current?.focus(),
            blurOnSubmit: false,
            ...(readOnly ? { editable: false, accessibilityState: { disabled: true } } : {}),
          }}
        />
        <IconField
          testID="signup-password"
          label={t('screens:signUp.passwordLabel')}
          placeholder={t('screens:signUp.passwordPlaceholder')}
          icon="lock"
          height={layout.fieldHeight}
          value={locked ? LOCKED_PASSWORD_MASK : password}
          onChangeText={(value) => {
            if (readOnly) return;
            setTouched((prev) => ({ ...prev, password: true }));
            setFormError(null);
            setFieldError((prev) => (prev === 'AUTH_WEAK_PASSWORD' ? null : prev));
            setPassword(value);
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          error={passwordError}
          inputRef={passwordRef}
          inputProps={{
            secureTextEntry: !locked && !showPassword,
            autoComplete: 'new-password',
            textContentType: 'newPassword',
            passwordRules: 'minlength: 8;',
            returnKeyType: 'go',
            onSubmitEditing: submit,
            ...(readOnly ? { editable: false, accessibilityState: { disabled: true } } : {}),
          }}
          accessory={
            locked ? undefined : (
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
            )
          }
        />
      </View>

      {formError ? (
        <View style={{ marginTop: spacing.md }}>
          <FormErrorBanner code={formError} onRetry={retry} />
        </View>
      ) : null}

      <View style={{ marginTop: gaps.fieldsToButton }}>
        <Button
          testID="signup-submit"
          label={t(locked ? 'screens:signUp.continue' : 'screens:signUp.submit')}
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
                onPress={() => runGateway(() => gateways.auth.signInWithProvider(provider))}
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
          onPress={goSignIn}
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
