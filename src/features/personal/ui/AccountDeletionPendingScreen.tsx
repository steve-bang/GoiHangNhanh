import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PUBLIC_LINKS, supportContactUrl } from '@/core/config/public-links';
import { getSupportEmail } from '@/core/config/support-contact';
import { openExternalLink } from '@/platform';
import { Button, Card, IconTile, Screen, Text, useTheme } from '@/shared/ui';

import { canSubmitDelete } from '../domain/delete-account-conditions';
import { DeleteConditionList, DeletePasswordForm, UnsyncedLossNotice } from './DeleteAccountParts';
import { SignOutDialogs } from './SignOutDialogs';
import { useDeleteAccountAction, useDeleteConditions } from './use-account-deletion';
import { useSignOut } from './use-sign-out';

/**
 * "Đang hoàn tất xóa tài khoản" (V1-15; kế hoạch v1 mục 3.3, xóa dở dang của V1-14 l). Máy chủ đã khóa cửa
 * hàng nhưng chưa xóa xong tài khoản Auth (`account_deleted`): người dùng vẫn đăng nhập được, không có cửa
 * hàng. Màn cho gọi lại `deleteAccount` (nhập lại mật khẩu vì máy chủ đòi xác thực gần đây) rồi xóa dữ liệu
 * trên máy như luồng thường, hoặc Đăng xuất (luồng đăng xuất an toàn). Cùng điều kiện máy như màn Xóa tài
 * khoản (tranh chấp mở, tài khoản khác, đang quay: không xóa dữ liệu trên máy); bỏ mục "chủ cửa hàng" vì
 * cửa hàng đã bị khóa và không còn đọc được. Không có Back: người dùng không có cửa hàng để quay về.
 */
export function AccountDeletionPendingScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { conditions, gate } = useDeleteConditions({ withOwnership: false });
  const action = useDeleteAccountAction({ withOwnership: false });
  // Cửa hàng đã khóa: tệp chưa tải không bao giờ lên được nữa, nên không chặn đăng xuất vì chúng.
  const signOut = useSignOut({ allowUnsynced: true });
  const [unsyncedAcknowledged, setUnsyncedAcknowledged] = useState(false);
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Đồng ý xóa đã có từ lần yêu cầu trước (trong app hoặc qua hỗ trợ); chỉ còn tích riêng cho tệp chưa tải.
  const consent = { agreed: true, unsyncedAcknowledged };
  const allowed = gate !== null && canSubmitDelete(gate, consent);
  // Không vào được màn Liên hệ hỗ trợ trong tab (không còn cửa hàng): mở trang Hỗ trợ trên web hoặc email.
  // Còn giữ chỗ thì không có nút (V1-18; cùng mẫu nút ở điều kiện "dữ liệu tài khoản khác").
  const supportUrl = supportContactUrl(PUBLIC_LINKS.support, getSupportEmail());

  const confirm = () => {
    setSubmitted(true);
    if (!allowed || password.length === 0 || action.busy) return;
    void action.submit(password, consent);
  };

  return (
    <Screen
      title={t('nav:subTitles.accountDeletionPending')}
      testID="screen-UI-A04-deletion-pending"
      contentGap={tokens.space.lg}
    >
      <View style={{ alignItems: 'center', gap: tokens.space.sm }}>
        <IconTile icon="clock" tone="warning" shape="circle" size="lg" />
        <Text variant="sectionTitle" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('personal:deleteAccount.pending.title')}
        </Text>
        <Text color="textMuted" style={{ textAlign: 'center' }} testID="pending-intro">
          {t('personal:deleteAccount.pending.intro')}
        </Text>
      </View>
      <Card>
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="caption" color="textMuted" testID="pending-server-status">
            {t('personal:deleteAccount.pending.serverStatus')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('personal:deleteAccount.pending.dataDevice')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('personal:deleteAccount.pending.autoComplete')}
          </Text>
        </View>
      </Card>

      <DeleteConditionList conditions={conditions} hide={['ownership']} pending />
      {gate && gate.allowed && gate.unsyncedToLose > 0 ? (
        <UnsyncedLossNotice
          count={gate.unsyncedToLose}
          acknowledged={unsyncedAcknowledged}
          onAcknowledge={setUnsyncedAcknowledged}
        />
      ) : null}

      {gate && !gate.allowed ? (
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="caption" color="textMuted" testID="delete-blocked-hint">
            {t('personal:deleteAccount.pending.blockedHint')}
          </Text>
          {supportUrl ? (
            <Button
              label={t('personal:deleteAccount.supportLink')}
              variant="secondary"
              size="slim"
              onPress={() => void openExternalLink(supportUrl)}
              testID="pending-support-link"
            />
          ) : null}
        </View>
      ) : (
        <DeletePasswordForm
          password={password}
          onChangePassword={(value) => {
            setPassword(value);
            action.clearError();
          }}
          submitted={submitted}
          error={action.error}
          busy={action.busy}
          disabled={!allowed}
          confirmLabel={t('personal:deleteAccount.pending.confirm')}
          onConfirm={confirm}
        />
      )}
      <Button
        label={t('personal:deleteAccount.pending.signOut')}
        variant="secondary"
        disabled={action.busy || signOut.busy}
        onPress={signOut.start}
        testID="pending-sign-out"
      />
      <SignOutDialogs signOut={signOut} />
    </Screen>
  );
}
