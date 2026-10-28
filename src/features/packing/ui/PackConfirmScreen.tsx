import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Icon, Screen, Text, useTheme } from '@/shared/ui';

import { toDisplayStatus } from '@/features/evidence';

import { RECORDER_ENABLED } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { usePackEvidence } from './use-pack-evidence';
import { usePackSession } from './use-pack-session';

/**
 * UI-C04 Kết thúc và xác nhận video (đặc tả A06). Chỉ có nghĩa khi đã ghi tệp thật
 * (`RECORDER_ENABLED=true`) và chỉ nói điều TỆP THẬT của phiên cho phép: *Đã lưu trên máy* khi tệp đã
 * đóng, đọc được và có mã băm (trạng thái hàng đợi); đang lưu thì nói đang lưu; lỗi thì báo chưa lưu
 * được, KHÔNG nhãn "đã lưu" (bất biến 3, 11; docs/09 mục 5.5, A.1). Khi chưa có recorder hoặc phiên
 * chưa có tệp nào màn này chỉ báo "chưa có video nào được lưu" (`PackNotRecorded`). Mở bằng `sessionId`;
 * mã đơn lấy từ phiên (bất biến 2). "Xem lại" và "Ghi thêm đoạn riêng" chưa có logic.
 */
export function PackConfirmScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();
  const evidence = usePackEvidence(RECORDER_ENABLED ? session : null);

  if (!RECORDER_ENABLED) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C04')}
        testID="screen-UI-C04"
        message={t('screens:confirm.nothingSaved')}
      />
    );
  }
  if (session === 'loading' || session === null || evidence === 'loading') {
    return (
      <Screen title={t('nav:titles.UI-C04')} onBack={navigation.back} testID="screen-UI-C04">
        {session === null ? (
          <Text accessibilityRole="alert">{t('screens:confirm.sessionMissing')}</Text>
        ) : (
          <Text color="textMuted">{t('screens:preview.loading')}</Text>
        )}
      </Screen>
    );
  }
  const file = evidence[evidence.length - 1];
  if (!file) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C04')}
        testID="screen-UI-C04"
        message={t('screens:confirm.noVideo')}
      />
    );
  }
  const display = toDisplayStatus(file.state);
  if (display.kind === 'label' && display.label === 'error') {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C04')}
        testID="screen-UI-C04"
        message={t('screens:confirm.saveFailed')}
      />
    );
  }

  return (
    <Screen
      title={t('nav:titles.UI-C04')}
      testID="screen-UI-C04"
      footer={
        <>
          <Button
            label={t('screens:confirm.save')}
            onPress={() => navigation.replace(ROUTES.packDone, { sessionId: session.id })}
            disabled={display.kind === 'capture'}
          />
          <Button
            variant="secondary"
            label={t('screens:confirm.review')}
            onPress={() => undefined}
            disabled
          />
          <Button
            variant="secondary"
            label={t('screens:confirm.addSegment')}
            onPress={() => undefined}
            disabled
          />
        </>
      }
    >
      <View
        accessible
        accessibilityLabel={t('screens:confirm.thumbnail')}
        style={{
          // token-exception: khung xem trước video giữ chỗ, chiều cao minh họa (chưa có ảnh thu nhỏ thật)
          minHeight: 180,
          backgroundColor: tokens.color.camera.background,
          borderRadius: tokens.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={48} color={tokens.color.camera.onCamera} />
      </View>
      <Card>
        <View style={{ gap: tokens.space.sm }}>
          <Text>{`${t('screens:confirm.orderCode')}: ${session.snapshot.orderCode}`}</Text>
          {display.kind === 'label' ? (
            <EvidenceStatusBadge status={display.label} />
          ) : (
            <Text>{t('screens:confirm.savingNow')}</Text>
          )}
          {display.kind === 'label' ? <Text>{t(confirmMessageKey(display.label))}</Text> : null}
        </View>
      </Card>
    </Screen>
  );
}

const confirmMessageKey = (label: string) => {
  if (label === 'uploading') return 'screens:confirm.uploadingMessage';
  if (label === 'uploaded') return 'screens:confirm.uploadedMessage';
  if (label === 'verified') return 'screens:confirm.verifiedMessage';
  return 'screens:confirm.savedMessage';
};
