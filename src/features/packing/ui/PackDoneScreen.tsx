import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  Button,
  ErrorState,
  EvidenceStatusBadge,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from '@/shared/ui';

import { RECORDER_ENABLED, summarizeSessionEvidence } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { PROBLEM_MESSAGE_KEY } from './session-evidence-text';
import { usePackEvidence } from './use-pack-evidence';
import { usePackSession } from './use-pack-session';

/**
 * UI-C06 Hoàn tất đóng gói (đặc tả A08). Chỉ có nghĩa khi đã ghi tệp thật (`RECORDER_ENABLED=true`)
 * và chỉ nói điều TỆP THẬT của phiên cho phép: chưa tải xong thì nói đúng "Video đã lưu trên thiết bị,
 * đang chờ đồng bộ", không biểu tượng/màu gợi ý đã sao lưu (A08), cho làm đơn tiếp theo ngay. Phiên
 * chưa có tệp đã lưu trên máy thì KHÔNG nói đã hoàn tất/đã lưu (bất biến 3, 11). Xét MỌI tệp của phiên:
 * lỗi LƯU trên máy khác lỗi TẢI LÊN (video tải lên lỗi vẫn đã lưu trên máy và được nói đúng như vậy).
 * Mở bằng `sessionId` (bất biến 2). "Số video" chỉ đếm video đã lưu trên máy, không đếm tệp lỗi lưu.
 */
export function PackDoneScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();
  const evidence = usePackEvidence(RECORDER_ENABLED ? session : null);

  if (!RECORDER_ENABLED) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C06')}
        testID="screen-UI-C06"
        message={t('screens:packDone.nothingSaved')}
      />
    );
  }
  if (session === 'loading' || session === null || evidence === 'loading') {
    return (
      <Screen title={t('nav:titles.UI-C06')} onBack={navigation.back} testID="screen-UI-C06">
        {session === null ? (
          <ErrorState
            title={t('screens:confirm.sessionMissing')}
            onRetry={navigation.back}
            retryLabel={t('screens:record.backToOrder')}
            testID="done-session-missing"
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
  // Chưa có tệp nào đã lưu trên máy: không nói "hoàn tất". Lỗi TẢI LÊN thì video đã lưu nên vẫn qua được.
  if (summary.saved === 0) {
    const messageKey =
      summary.total === 0
        ? 'screens:packDone.noVideo'
        : summary.inProgress > 0
          ? 'screens:confirm.savingNow'
          : 'screens:confirm.saveFailed';
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C06')}
        testID="screen-UI-C06"
        message={t(messageKey)}
      />
    );
  }
  const incomplete = summary.notSaved > 0 || summary.inProgress > 0;
  const summaryKey = incomplete
    ? 'screens:packDone.summaryPartial'
    : summary.label === 'uploaded' || summary.label === 'verified'
      ? 'screens:packDone.summaryUploaded'
      : 'screens:packDone.summaryQueued';

  return (
    <Screen
      title={t('nav:titles.UI-C06')}
      testID="screen-UI-C06"
      footer={
        <>
          <Button
            label={t('screens:packDone.next')}
            onPress={() => navigation.replace(ROUTES.scan)}
          />
          <Button
            variant="secondary"
            label={t('screens:packDone.viewEvidence')}
            onPress={() => navigation.replace(ROUTES.orderEvidence, { orderId: session.orderId })}
          />
        </>
      }
    >
      <View style={{ gap: tokens.space.sm }}>
        <View>
          <Text variant="formLabel" color="inkMuted">
            {t('screens:confirm.orderCode')}
          </Text>
          <Text variant="formTitle" testID="done-order-code">
            {session.snapshot.orderCode}
          </Text>
        </View>
        {summary.label ? <EvidenceStatusBadge status={summary.label} /> : null}
        <Text>{t(summaryKey)}</Text>
        {summary.problem ? <Text>{t(PROBLEM_MESSAGE_KEY[summary.problem])}</Text> : null}
        <Text color="inkMuted">{`${t('screens:packDone.videoCount')}: ${summary.saved}`}</Text>
      </View>
    </Screen>
  );
}
