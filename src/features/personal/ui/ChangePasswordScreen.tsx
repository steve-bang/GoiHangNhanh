import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { useAppNavigation, useIsScreenActive } from '@/platform';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  PasswordField,
  Screen,
  Skeleton,
  Text,
  useTheme,
  useToast,
  type TextFieldInput,
} from '@/shared/ui';

import {
  MIN_PASSWORD_LENGTH,
  textLength,
  validateConfirmNewPassword,
  validateCurrentPassword,
  validateNewPassword,
} from '../domain/validation';
import type { SignInMethod } from '../domain/types';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { SignOutDialogs } from './SignOutDialogs';
import { useSignOut } from './use-sign-out';
import { useRegion } from './use-region';

/** Mã lỗi buộc đăng nhập lại: không có cách nào sửa ngay tại màn này. */
const NEEDS_SIGN_IN: readonly ErrorCode[] = ['AUTH_REQUIRES_RECENT_LOGIN', 'AUTH_SESSION_EXPIRED'];

/**
 * Đổi mật khẩu (PER-04), route con của UI-I05 (decisions.md Q-20k), dựng theo board 07 khung 3. Chỉ có
 * form với tài khoản đăng nhập bằng mật khẩu (D-13, Q-20c); Apple/Google thấy thẻ giải thích THAY form
 * (màn tự đọc `signInMethod`, không dựa vào lối vào ở UI-I01). Nút Lưu ngay dưới các ô, không ghim đáy.
 * Không log, không giữ mật khẩu ngoài state của màn; thành công chỉ báo SAU KHI cổng xác nhận. Nút luôn
 * bật khi chưa gửi; kiểm tra khi bấm, lỗi hiện tại ô và focus vào ô lỗi đầu tiên. Yêu cầu độ dài hiện
 * theo thời gian thực (biểu tượng + chữ, không chỉ màu).
 */
export function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const isActive = useIsScreenActive();
  const { account } = usePersonalGateways();
  const session = useSession();
  // Chỉ tài khoản đăng nhập bằng mật khẩu mới có mật khẩu để đổi (D-13, Q-20c): cần biết cách đăng nhập.
  const profile = useRegion(() => account.getProfile(), session.key);
  // "Đăng nhập lại" PHẢI đi qua luồng Đăng xuất an toàn (PER-21: chặn khi đang quay, cảnh báo tệp chưa
  // đồng bộ): chỉ chuyển màn sẽ để người khác đăng nhập tài khoản khác trên máy mà tệp của tài khoản này
  // còn chưa tải (V1-05, review PR #51).
  const signOut = useSignOut(
    profile.state.status === 'ready' ? { signInAgainEmail: profile.state.data.email } : {},
  );

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<ErrorCode | null>(null);
  const busyRef = useRef(false);
  const currentRef = useRef<TextFieldInput>(null);
  const nextRef = useRef<TextFieldInput>(null);
  const confirmRef = useRef<TextFieldInput>(null);

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
    : submitted && nextIssue
      ? t(`personal:validation.newPassword.${nextIssue}`)
      : undefined;
  const confirmError =
    submitted && confirmIssue
      ? t(`personal:validation.confirmNewPassword.${confirmIssue}`)
      : undefined;

  const loadMessage = resolveErrorMessage(
    t,
    profile.state.status === 'error' ? profile.state.code : 'AUTH_SERVICE_UNAVAILABLE',
  );

  const bannerCode = serverError && !wrongCurrent && !weakNext ? serverError : null;
  const bannerMessage = bannerCode ? errorText(resolveErrorMessage(t, bannerCode)) : null;

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setServerError(null);
  };

  const submit = async () => {
    if (busyRef.current) return;
    setSubmitted(true);
    if (!valid) {
      (currentIssue ? currentRef : nextIssue ? nextRef : confirmRef).current?.focus();
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setServerError(null);
    try {
      await account.changePassword({ currentPassword: current, newPassword: next });
      toast.show(t('personal:changePassword.saved'), { tone: 'success' });
      if (isActive()) navigation.back();
    } catch (error) {
      const code = error instanceof AppError ? error.code : 'AUTH_SERVICE_UNAVAILABLE';
      setServerError(code);
      if (code === 'AUTH_WRONG_CURRENT_PASSWORD') currentRef.current?.focus();
      else if (code === 'AUTH_WEAK_PASSWORD') nextRef.current?.focus();
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
    >
      {profile.state.status === 'loading' ? (
        <Card testID="change-password-loading">
          <View style={{ gap: tokens.space.sm }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" />
          </View>
        </Card>
      ) : null}
      {profile.state.status === 'error' ? (
        <Card>
          <ErrorState
            testID="change-password-load-error"
            title={loadMessage.title}
            {...(loadMessage.hint ? { message: loadMessage.hint } : {})}
            onRetry={() => void profile.reload()}
            retrying={profile.refreshing}
          />
        </Card>
      ) : null}
      {profile.state.status === 'ready' && profile.state.data.signInMethod !== 'password' ? (
        <SocialAccountNotice method={profile.state.data.signInMethod} />
      ) : null}
      {profile.state.status === 'ready' && profile.state.data.signInMethod === 'password' ? (
        <View style={{ gap: tokens.space.lg }}>
          <PasswordField
            label={t('personal:fields.currentPassword')}
            placeholder={t('personal:placeholders.currentPassword')}
            required
            value={current}
            onChangeText={edit(setCurrent)}
            autoComplete="current-password"
            inputRef={currentRef}
            {...(currentError ? { error: currentError } : {})}
            testID="change-password-current"
          />
          <View style={{ gap: tokens.space.sm }}>
            <PasswordField
              label={t('personal:fields.newPassword')}
              placeholder={t('personal:placeholders.newPassword')}
              required
              value={next}
              onChangeText={edit(setNext)}
              autoComplete="new-password"
              inputRef={nextRef}
              {...(nextError ? { error: nextError } : {})}
              testID="change-password-new"
            />
            <LengthRequirement met={textLength(next) >= MIN_PASSWORD_LENGTH} />
          </View>
          <PasswordField
            label={t('personal:fields.confirmNewPassword')}
            placeholder={t('personal:placeholders.confirmNewPassword')}
            required
            value={confirm}
            onChangeText={edit(setConfirm)}
            autoComplete="new-password"
            inputRef={confirmRef}
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
                  onPress={signOut.start}
                  disabled={signOut.busy}
                  testID="change-password-sign-in"
                />
              ) : null}
            </View>
          ) : null}
          {/* Board 07 khung 3: Lưu ngay dưới các ô (không ghim đáy). */}
          <Button
            label={t('personal:changePassword.submit')}
            onPress={() => void submit()}
            disabled={saving}
            loading={saving}
            testID="change-password-submit"
          />
        </View>
      ) : null}
      <SignOutDialogs signOut={signOut} />
    </Screen>
  );
}

/**
 * Tài khoản Apple/Google không có mật khẩu của Đơn Chứng để đổi (Q-20c, D-13): thay form bằng thẻ giải
 * thích (board 07 khung 3 vẽ cả form lẫn thẻ; hiện form cho tài khoản không đổi được là chức năng giả).
 */
function SocialAccountNotice({ method }: { method: Exclude<SignInMethod, 'password'> }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const provider = t(`personal:changePassword.provider.${method}`);
  return (
    <Card tone="brand" testID="change-password-social">
      <View style={{ gap: tokens.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
          <Icon name={method} size={20} color={tokens.color.text.primary} />
          <Text bold accessibilityRole="header" style={{ flex: 1 }}>
            {t('personal:changePassword.socialTitle', { provider })}
          </Text>
        </View>
        <Text color="textMuted">{t('personal:changePassword.socialMessage', { provider })}</Text>
      </View>
    </Card>
  );
}

/** Dòng yêu cầu độ dài: đổi biểu tượng và nhãn trợ năng khi đạt (không chỉ đổi màu). */
function LengthRequirement({ met }: { met: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const text = t('personal:changePassword.requirementLength', { min: MIN_PASSWORD_LENGTH });
  const state = met
    ? t('personal:changePassword.requirementMet')
    : t('personal:changePassword.requirementUnmet');
  return (
    <View
      testID="change-password-requirement"
      accessible
      accessibilityLabel={`${text}. ${state}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}
    >
      <Icon
        name={met ? 'check-circle' : 'circle-outline'}
        size={18}
        color={met ? tokens.color.feedback.success.fg : tokens.color.text.secondary}
      />
      <Text
        variant="caption"
        color={met ? 'text' : 'textMuted'}
        bold={met}
        testID="change-password-requirement-text"
      >
        {text}
      </Text>
    </View>
  );
}
