import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/shared/ui';

import type { useSignOut } from './use-sign-out';

/**
 * Ba hộp thoại của luồng đăng xuất an toàn (PER-21, board 07 khung 4a/4b/4c): xác nhận, đang quay
 * (chặn), còn tệp chưa đồng bộ (chặn). Dùng chung cho tab Cá nhân và màn "Chưa kết nối được cửa hàng"
 * của cổng phiên (V1-06). `allowOpenSync = false` ẩn nút mở Trung tâm đồng bộ (khi cổng phiên đang chặn
 * mọi màn nghiệp vụ, nút đó chỉ dẫn lại về chính màn chặn).
 */
export function SignOutDialogs({
  signOut,
  allowOpenSync = true,
}: {
  signOut: ReturnType<typeof useSignOut>;
  allowOpenSync?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ConfirmDialog
        visible={signOut.step === 'confirm'}
        destructive
        confirmOutlined
        icon="sign-out"
        title={t('personal:signOut.dialogTitle')}
        message={t('personal:signOut.dialogMessage')}
        detail={t('personal:signOut.dataNote')}
        confirmLabel={t('personal:signOut.confirm')}
        cancelLabel={t('personal:signOut.cancel')}
        onCancel={signOut.dismiss}
        onConfirm={() => void signOut.confirm()}
      />
      <ConfirmDialog
        visible={signOut.step === 'blocked_recording'}
        hideConfirm
        icon="camera"
        title={t('personal:signOut.recordingTitle')}
        message={t('personal:signOut.recordingMessage')}
        messageTestID="sign-out-recording"
        cancelLabel={t('personal:signOut.cancel')}
        onCancel={signOut.dismiss}
      />
      <ConfirmDialog
        visible={signOut.step === 'unsynced'}
        icon="alert-triangle"
        iconTone="warning"
        title={t('personal:signOut.unsyncedTitle')}
        message={t('personal:signOut.unsyncedMessage', { count: signOut.unsyncedCount })}
        messageTestID="sign-out-unsynced"
        {...(allowOpenSync
          ? {
              confirmLabel: t('personal:signOut.openSync'),
              confirmTestID: 'sign-out-open-sync',
              onConfirm: signOut.openSyncCenter,
            }
          : { hideConfirm: true })}
        cancelLabel={t('personal:signOut.cancel')}
        onCancel={signOut.dismiss}
      />
    </>
  );
}
