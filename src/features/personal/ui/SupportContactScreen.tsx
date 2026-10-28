import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getSupportEmail } from '@/core/config/support-contact';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { useAppNavigation, useIsScreenActive, openExternalLink } from '@/platform';
import {
  Button,
  FormField,
  Screen,
  Text,
  useTheme,
  useToast,
  type TextFieldInput,
} from '@/shared/ui';

import {
  SUPPORT_MESSAGE_MAX_LENGTH,
  buildSupportMailto,
  validateSupportRequest,
  type SupportRequestField,
} from '../domain/support-request';
import { Notice } from './Notice';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';

/**
 * Liên hệ hỗ trợ (UI-I06 route con; board 07 khung 17). KHÔNG có kênh gửi thật (Q-20g, Q-21ae), nên:
 * - Có địa chỉ hỗ trợ thật (`getSupportEmail()`): "Gửi yêu cầu" mở ứng dụng email với chủ đề/nội dung soạn
 *   sẵn tới địa chỉ đó. Mở được chỉ nghĩa là ứng dụng email đã mở, KHÔNG phải "đã gửi": thông báo bảo người
 *   dùng tự bấm Gửi trong email. Không tự đính kèm video hay dữ liệu bằng chứng.
 * - Chưa có địa chỉ (hôm nay): hiện thẻ nói rõ chưa gửi được và khóa nút; không bịa địa chỉ.
 * Lệch board (D14): bỏ "Số điện thoại *" (hồ sơ không có SĐT, đặc tả không cần, thu tối thiểu), thêm "Chủ
 * đề" và "Mã đơn (không bắt buộc)" theo PER-18. Họ và tên điền sẵn từ hồ sơ, chưa có thì để trống.
 */
export function SupportContactScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const isActive = useIsScreenActive();
  const { account } = usePersonalGateways();
  const session = useSession();
  const profile = useRegion(() => account.getProfile(), session.key);
  const supportEmail = getSupportEmail();

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const busyRef = useRef(false);
  const nameRef = useRef<TextFieldInput>(null);
  const subjectRef = useRef<TextFieldInput>(null);
  const messageRef = useRef<TextFieldInput>(null);

  const prefill = profile.state.status === 'ready' ? (profile.state.data.displayName ?? '') : '';
  const name = nameDraft ?? prefill;
  const input = { name, subject, orderCode, message };
  const issues = validateSupportRequest(input);
  const errorFor = (field: SupportRequestField) => {
    const issue = submitted ? issues[field] : undefined;
    return issue ? { error: t(`personal:help.contact.validation.${field}.${issue}`) } : {};
  };

  const send = async () => {
    if (busyRef.current || !supportEmail) return;
    const firstInvalid = (['name', 'subject', 'message'] as const).find((f) => issues[f]);
    if (firstInvalid) {
      setSubmitted(true);
      ({ name: nameRef, subject: subjectRef, message: messageRef })[firstInvalid].current?.focus();
      return;
    }
    busyRef.current = true;
    setSending(true);
    setOpenFailed(false);
    try {
      const url = buildSupportMailto(supportEmail, input, {
        name: t('personal:help.contact.mailName'),
        orderCode: t('personal:help.contact.mailOrderCode'),
      });
      const opened = await openExternalLink(url);
      if (!isActive()) return;
      if (opened) toast.show(t('personal:help.contact.opened'), { tone: 'info' });
      else setOpenFailed(true);
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  };

  const failure = resolveErrorMessage(t, 'SUPPORT_MAIL_UNAVAILABLE');
  const locked = supportEmail === null;
  return (
    <Screen
      title={t('nav:subTitles.helpContact')}
      onBack={navigation.back}
      testID="screen-UI-I06-contact"
      contentGap={tokens.space.lg}
    >
      {locked ? (
        <Notice testID="support-no-channel">{t('personal:help.contact.notice')}</Notice>
      ) : null}
      <Text color="textMuted">{t('personal:help.contact.intro')}</Text>
      <View style={{ gap: tokens.space.lg }}>
        <FormField
          label={t('personal:help.contact.name')}
          required
          value={name}
          onChangeText={setNameDraft}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          inputRef={nameRef}
          {...errorFor('name')}
          testID="support-name"
        />
        <FormField
          label={t('personal:help.contact.subject')}
          required
          placeholder={t('personal:help.contact.subjectPlaceholder')}
          value={subject}
          onChangeText={setSubject}
          returnKeyType="next"
          inputRef={subjectRef}
          {...errorFor('subject')}
          testID="support-subject"
        />
        <FormField
          label={t('personal:help.contact.orderCode')}
          placeholder={t('personal:help.contact.orderCodePlaceholder')}
          value={orderCode}
          onChangeText={setOrderCode}
          autoCapitalize="none"
          returnKeyType="next"
          testID="support-order-code"
        />
        <FormField
          label={t('personal:help.contact.message')}
          required
          multiline
          counterMax={SUPPORT_MESSAGE_MAX_LENGTH}
          placeholder={t('personal:help.contact.messagePlaceholder')}
          value={message}
          onChangeText={setMessage}
          inputRef={messageRef}
          {...errorFor('message')}
          testID="support-message"
        />
        {openFailed ? (
          <Text color="danger" accessibilityRole="alert" testID="support-open-error">
            {errorText(failure)}
          </Text>
        ) : null}
        <Button
          label={t('personal:help.contact.send')}
          onPress={() => void send()}
          disabled={locked}
          loading={sending}
          accessibilityHint={
            locked ? t('personal:help.contact.sendLockedHint') : t('personal:help.contact.sendHint')
          }
          testID="support-send"
        />
      </View>
    </Screen>
  );
}
