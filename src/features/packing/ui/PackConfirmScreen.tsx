import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Icon, Screen, Text, useTheme } from '@/shared/ui';

import { RECORDER_ENABLED, summarizeSessionEvidence } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { PROBLEM_MESSAGE_KEY } from './session-evidence-text';
import { usePackEvidence } from './use-pack-evidence';
import { usePackSession } from './use-pack-session';

/**
 * UI-C04 Kết thúc và xác nhận video (đặc tả A06). Chỉ có nghĩa khi đã ghi tệp thật
 * (`RECORDER_ENABLED=true`) và chỉ nói điều TỆP THẬT của phiên cho phép, xét MỌI tệp của phiên (không
 * chỉ tệp cuối): *Đã lưu trên máy* khi tệp đã đóng, đọc được và có mã băm (trạng thái hàng đợi); đang
 * lưu thì nói đang lưu; lỗi LƯU trên máy thì báo chưa lưu được, còn lỗi TẢI LÊN thì nói video vẫn đã lưu
 * trên máy (không bảo quay lại); KHÔNG nhãn "đã lưu" cho tệp chưa lưu được (bất biến 3, 11; docs/09
 * mục 5.5, A.1). Khi chưa có recorder hoặc phiên
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
  const summary = summarizeSessionEvidence(evidence);
  if (summary.total === 0) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C04')}
        testID="screen-UI-C04"
        message={t('screens:confirm.noVideo')}
      />
    );
  }
  // Mọi tệp của phiên đều chưa lưu được trên máy (khác với lỗi tải lên: video đó đã nằm trên máy).
  if (summary.saved === 0 && summary.inProgress === 0) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C04')}
        testID="screen-UI-C04"
        message={t('screens:confirm.saveFailed')}
      />
    );
  }
  const saving = summary.inProgress > 0;

  return (
    <Screen
      title={t('nav:titles.UI-C04')}
      testID="screen-UI-C04"
      footer={
        <>
          <Button
            label={t('screens:confirm.save')}
            onPress={() => navigation.replace(ROUTES.packDone, { sessionId: session.id })}
            disabled={saving}
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
          {summary.label ? <EvidenceStatusBadge status={summary.label} /> : null}
          {saving ? <Text>{t('screens:confirm.savingNow')}</Text> : null}
          {summary.label ? (
            <Text>
              {t(
                summary.problem
                  ? PROBLEM_MESSAGE_KEY[summary.problem]
                  : confirmMessageKey(summary.label),
              )}
            </Text>
          ) : null}
          {summary.notSaved > 0 ? (
            <Text accessibilityRole="alert">{t('screens:confirm.partialFailed')}</Text>
          ) : null}
          {session.sessionStatus === 'interrupted' ? (
            // A06 "thông báo gián đoạn": quay bị dừng giữa chừng (app vào nền, camera bị ngắt; V1-11).
            <Text accessibilityRole="alert" testID="confirm-interrupted">
              {t('screens:confirm.interrupted')}
            </Text>
          ) : null}
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
