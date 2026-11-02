import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { EvidencePlayer, FILE_STATES } from '@/features/evidence';
import { useCurrentShopId } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  ErrorState,
  EvidenceStatusBadge,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from '@/shared/ui';

import { RECORDER_ENABLED, formatElapsed, summarizeSessionEvidence } from '../domain';
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
 * mã đơn lấy từ phiên (bất biến 2). Chân màn chỉ một nút Lưu: "Xem lại video" và "Ghi thêm đoạn riêng"
 * đã gỡ khỏi bố cục vì chưa có luồng (audit PK-1); xem lại video ngay trên màn bằng `EvidencePlayer` (chỉ đọc, không tự phát). Thời lượng là tổng
 * `durationMs` thật của các tệp đã đóng; không có thì không hiện (không bịa số).
 */
export function PackConfirmScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();
  const evidence = usePackEvidence(RECORDER_ENABLED ? session : null);
  const shopId = useCurrentShopId();

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
          <ErrorState
            title={t('screens:confirm.sessionMissing')}
            onRetry={navigation.back}
            retryLabel={t('screens:record.backToOrder')}
            testID="confirm-session-missing"
          />
        ) : (
          <>
            <Text color="textMuted" accessibilityLiveRegion="polite">
              {t('screens:preview.loading')}
            </Text>
            <Skeleton height={72} />
          </>
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
  // Xem lại: video MỚI NHẤT của phiên (không ghép đoạn, bất biến 4); bỏ tệp lỗi lưu (không có gì để xem).
  const videos = evidence
    .filter(
      (file) =>
        file.kind === 'video' &&
        file.state !== FILE_STATES.LOCAL_SAVE_FAILED &&
        file.state !== FILE_STATES.UNRECOVERABLE,
    )
    .sort((a, b) => b.createdAtDevice - a.createdAtDevice);
  const reviewFile = videos[0] ?? null;
  // Chỉ cộng thời lượng thật của tệp đã đóng (đặt ở sự kiện đóng tệp); không có thì không hiện.
  const measured = evidence.filter((file) => file.durationMs !== null);
  const durationMs =
    measured.length > 0 ? measured.reduce((sum, file) => sum + (file.durationMs ?? 0), 0) : null;

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
          {saving ? (
            <Text
              variant="caption"
              color="textMuted"
              accessibilityLiveRegion="polite"
              testID="confirm-saving-hint"
            >
              {t('screens:confirm.savingNow')}
            </Text>
          ) : null}
        </>
      }
    >
      {reviewFile ? (
        <View style={{ gap: tokens.space.xs }}>
          <EvidencePlayer file={reviewFile} shopId={shopId} />
          {videos.length > 1 ? (
            <Text variant="caption" color="textMuted" testID="confirm-more-videos">
              {t('screens:confirm.moreVideos', { count: videos.length })}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ gap: tokens.space.sm }}>
        <View>
          <Text variant="formLabel" color="inkMuted">
            {t('screens:confirm.orderCode')}
          </Text>
          <Text variant="formTitle" testID="confirm-order-code">
            {session.snapshot.orderCode}
          </Text>
        </View>
        {summary.label ? <EvidenceStatusBadge status={summary.label} /> : null}
        {summary.label ? (
          <Text>
            {t(
              summary.problem
                ? PROBLEM_MESSAGE_KEY[summary.problem]
                : confirmMessageKey(summary.label),
            )}
          </Text>
        ) : null}
        {durationMs !== null ? (
          <Text color="inkMuted" testID="confirm-duration">
            {`${t('screens:confirm.duration')}: ${formatElapsed(0, durationMs)}`}
          </Text>
        ) : null}
      </View>
      {summary.notSaved > 0 || session.sessionStatus === 'interrupted' ? (
        <Card tone="warning">
          <View style={{ gap: tokens.space.sm }}>
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
      ) : null}
    </Screen>
  );
}

const confirmMessageKey = (label: string) => {
  if (label === 'uploading') return 'screens:confirm.uploadingMessage';
  if (label === 'uploaded') return 'screens:confirm.uploadedMessage';
  if (label === 'verified') return 'screens:confirm.verifiedMessage';
  return 'screens:confirm.savedMessage';
};
