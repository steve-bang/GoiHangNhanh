import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Screen, Text, useTheme } from '@/shared/ui';

import { toDisplayStatus } from '@/features/evidence';

import { RECORDER_ENABLED } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { usePackEvidence } from './use-pack-evidence';
import { usePackSession } from './use-pack-session';

/**
 * UI-C06 Hoàn tất đóng gói (đặc tả A08). Chỉ có nghĩa khi đã ghi tệp thật (`RECORDER_ENABLED=true`)
 * và chỉ nói điều TỆP THẬT của phiên cho phép: chưa tải xong thì nói đúng "Video đã lưu trên thiết bị,
 * đang chờ đồng bộ", không biểu tượng/màu gợi ý đã sao lưu (A08), cho làm đơn tiếp theo ngay. Phiên
 * chưa có tệp, hoặc tệp lỗi, thì KHÔNG nói đã hoàn tất/đã lưu (bất biến 3, 11). Mở bằng `sessionId`
 * (bất biến 2). Số video là số tệp thật của phiên.
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
          <Text accessibilityRole="alert">{t('screens:confirm.sessionMissing')}</Text>
        ) : (
          <Text color="textMuted">{t('screens:preview.loading')}</Text>
        )}
      </Screen>
    );
  }
  const file = evidence[evidence.length - 1];
  const display = file ? toDisplayStatus(file.state) : null;
  if (!file || !display || display.kind === 'capture' || display.label === 'error') {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C06')}
        testID="screen-UI-C06"
        message={t(file ? 'screens:confirm.saveFailed' : 'screens:packDone.noVideo')}
      />
    );
  }

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
            onPress={() => navigation.replace(ROUTES.orders)}
          />
        </>
      }
    >
      <Card>
        <View style={{ gap: tokens.space.sm }}>
          <Text>{`${t('screens:confirm.orderCode')}: ${session.snapshot.orderCode}`}</Text>
          <Text>
            {t(
              display.label === 'uploaded' || display.label === 'verified'
                ? 'screens:packDone.summaryUploaded'
                : 'screens:packDone.summaryQueued',
            )}
          </Text>
          <Text>{`${t('screens:packDone.videoCount')}: ${evidence.length}`}</Text>
          <EvidenceStatusBadge status={display.label} />
        </View>
      </Card>
    </Screen>
  );
}
