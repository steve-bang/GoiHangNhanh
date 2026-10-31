import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { isPlaceholderLink, LEGAL_LINKS } from '@/core/config/legal-links';
import { getSupportEmail } from '@/core/config/support-contact';
import { ROUTES } from '@/core/navigation';
import { openExternalLink, useAppNavigation } from '@/platform';
import {
  Button,
  Checkbox,
  IconTile,
  ListGroup,
  ListItem,
  Screen,
  Text,
  useTheme,
} from '@/shared/ui';

import { canSubmitDelete } from '../domain/delete-account-conditions';
import {
  DeleteConditionList,
  DeleteDataCard,
  DeletePasswordForm,
  UnsyncedLossNotice,
} from './DeleteAccountParts';
import { useDeleteAccountAction, useDeleteConditions } from './use-account-deletion';

/**
 * Xóa tài khoản (PER-22; board 07 khung 20), route con của UI-I05 (Q-21b). Luồng thật V1-15: điều kiện
 * thật (đang quay, tranh chấp mở, dữ liệu tài khoản khác: chặn; tệp chưa tải: cảnh báo + tích riêng) ->
 * "Tôi hiểu và đồng ý" -> nhập mật khẩu -> máy chủ `deleteAccount` -> CHỈ khi máy chủ xác nhận mới xóa dữ
 * liệu trên máy (`LocalWipeProvider`) và về Chào mừng. Lỗi trước khi máy chủ xác nhận: không xóa gì.
 */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { conditions, gate } = useDeleteConditions();
  const action = useDeleteAccountAction();
  const [agreed, setAgreed] = useState(false);
  const [unsyncedAcknowledged, setUnsyncedAcknowledged] = useState(false);
  const [step, setStep] = useState<'review' | 'password'>('review');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const consent = { agreed, unsyncedAcknowledged };
  const canContinue = gate !== null && canSubmitDelete(gate, consent);
  const hasSupport = getSupportEmail() !== null;
  // Liên kết dùng chung với web (`public-links.ts`, V1-18); còn giữ chỗ `.invalid` thì ẩn (không mở trang
  // chắc chắn lỗi).
  const webLink = isPlaceholderLink(LEGAL_LINKS.accountDeletion)
    ? null
    : LEGAL_LINKS.accountDeletion;

  const confirm = () => {
    setSubmitted(true);
    if (password.length === 0 || action.busy) return;
    void action.submit(password, consent);
  };

  return (
    <Screen
      title={t('nav:subTitles.deleteAccount')}
      onBack={step === 'password' && !action.busy ? () => setStep('review') : navigation.back}
      testID="screen-UI-I05-delete-account"
      contentGap={tokens.space.lg}
    >
      <View style={{ alignItems: 'center', gap: tokens.space.sm }}>
        <IconTile icon="alert" tone="danger" shape="circle" size="lg" />
        <Text variant="sectionTitle" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('personal:deleteAccount.title')}
        </Text>
        <Text color="textMuted" style={{ textAlign: 'center' }} testID="delete-intro">
          {t('personal:deleteAccount.intro')}
        </Text>
      </View>

      {step === 'password' ? (
        <DeletePasswordForm
          password={password}
          onChangePassword={(value) => {
            setPassword(value);
            action.clearError();
          }}
          submitted={submitted}
          error={action.error}
          busy={action.busy}
          confirmLabel={t('personal:deleteAccount.password.confirm')}
          onConfirm={confirm}
          onBack={() => {
            action.clearError();
            setStep('review');
          }}
        />
      ) : (
        <>
          <DeleteConditionList
            conditions={conditions}
            actions={{
              // Câu của mục này bảo "xóa qua trang web hoặc liên hệ hỗ trợ": có kênh thật thì bấm được ngay.
              // Còn giữ chỗ thì không có nút (như trước V1-18).
              foreign:
                webLink || hasSupport ? (
                  <>
                    {webLink ? (
                      <Button
                        label={t('personal:deleteAccount.webLink')}
                        variant="secondary"
                        size="slim"
                        onPress={() => void openExternalLink(webLink)}
                        testID="delete-foreign-web-link"
                      />
                    ) : null}
                    {hasSupport ? (
                      <Button
                        label={t('personal:deleteAccount.supportLink')}
                        variant="secondary"
                        size="slim"
                        onPress={() => navigation.push(ROUTES.helpContact)}
                        testID="delete-foreign-support-link"
                      />
                    ) : null}
                  </>
                ) : undefined,
            }}
          />
          {gate && gate.allowed && gate.unsyncedToLose > 0 ? (
            <UnsyncedLossNotice
              count={gate.unsyncedToLose}
              acknowledged={unsyncedAcknowledged}
              onAcknowledge={setUnsyncedAcknowledged}
            />
          ) : null}

          <DeleteDataCard />

          <Checkbox
            label={t('personal:deleteAccount.agree')}
            checked={agreed}
            onChange={setAgreed}
            testID="delete-agree"
          />
          <View style={{ gap: tokens.space.sm }}>
            <Button
              label={t('personal:deleteAccount.delete')}
              variant="destructive"
              disabled={!canContinue}
              onPress={() => {
                setSubmitted(false);
                setStep('password');
              }}
              accessibilityHint={t('personal:deleteAccount.deleteHint')}
              testID="delete-submit"
            />
            {gate && !gate.allowed ? (
              <Text variant="caption" color="textMuted" testID="delete-blocked-hint">
                {t('personal:deleteAccount.blockedHint')}
              </Text>
            ) : null}
            {hasSupport || webLink ? (
              <View style={{ gap: tokens.space.xs }} testID="delete-support">
                <Text variant="caption" color="textMuted">
                  {t('personal:deleteAccount.support')}
                </Text>
                <ListGroup>
                  {webLink ? (
                    <ListItem
                      leadingIcon="info"
                      title={t('personal:deleteAccount.webLink')}
                      titleWeight="regular"
                      onPress={() => void openExternalLink(webLink)}
                      testID="delete-web-link"
                    />
                  ) : null}
                  {hasSupport ? (
                    <ListItem
                      leadingIcon="help"
                      title={t('personal:deleteAccount.supportLink')}
                      titleWeight="regular"
                      onPress={() => navigation.push(ROUTES.helpContact)}
                      testID="delete-support-link"
                    />
                  ) : null}
                </ListGroup>
              </View>
            ) : null}
          </View>
          <Button
            label={t('personal:deleteAccount.keep')}
            variant="secondary"
            onPress={navigation.back}
            testID="delete-keep"
          />
        </>
      )}
    </Screen>
  );
}
