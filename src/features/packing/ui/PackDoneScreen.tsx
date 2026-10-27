import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Screen, Text, useTheme } from '@/shared/ui';

import { RECORDER_ENABLED } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { usePackSession } from './use-pack-session';

/**
 * UI-C06 Hoàn tất đóng gói (đặc tả A08). Chỉ có nghĩa khi đã ghi tệp thật (`RECORDER_ENABLED=true`):
 * chưa tải xong thì nói đúng "Video đã lưu trên thiết bị, đang chờ đồng bộ", không biểu tượng/màu gợi
 * ý đã sao lưu (A08), cho làm đơn tiếp theo ngay. Khi chưa có recorder (hiện tại) màn này KHÔNG hiện
 * badge hay câu "đã lưu" (chưa có tệp nào): chỉ báo "chưa có video nào được lưu" (`PackNotRecorded`).
 * Mở bằng `sessionId` (bất biến 2). Số video và nội dung còn là minh họa.
 */
export function PackDoneScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();

  if (!RECORDER_ENABLED) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C06')}
        testID="screen-UI-C06"
        message={t('screens:packDone.nothingSaved')}
      />
    );
  }
  if (session === 'loading' || session === null) {
    return (
      <Screen title={t('nav:titles.UI-C06')} onBack={navigation.back} testID="screen-UI-C06">
        {session === null ? (
          <Text accessibilityRole="alert">{t('screens:confirm.sessionMissing')}</Text>
        ) : (
          <Text color="textMuted">{t('screens:preview.loading')}</Text>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      title={t('nav:titles.UI-C06')}
      testID="screen-UI-C06"
      illustrative
      footer={
        <>
          <Button
            label={t('screens:packDone.next')}
            onPress={() => navigation.replace(ROUTES.scan)}
          />
          <Button
            variant="secondary"
            label={t('screens:packDone.viewEvidence')}
            onPress={() => navigation.replace(ROUTES.orders)}
          />
        </>
      }
    >
      <Card>
        <View style={{ gap: tokens.space.sm }}>
          <Text>{`${t('screens:confirm.orderCode')}: ${session.snapshot.orderCode}`}</Text>
          <Text>{t('screens:packDone.summary')}</Text>
          <Text>{`${t('screens:packDone.videoCount')}: 1`}</Text>
          <EvidenceStatusBadge status="saved_on_device" />
        </View>
      </Card>
    </Screen>
  );
}
