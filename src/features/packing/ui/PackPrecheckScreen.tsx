import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import {
  getAvailableDiskBytes,
  openAppSettings,
  probeEvidenceDirWritable,
  useAppNavigation,
  useScannerPermission,
} from '@/platform';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';

import { RECORDER_ENABLED, runPrecheck } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { usePackSession } from './use-pack-session';

/**
 * UI-C02 Kiểm tra trước khi quay (đặc tả A04). CHẠY NGẦM: khi đạt hết thì chuyển thẳng sang màn quay,
 * không thêm thao tác; chỉ hiện nội dung khi có điều kiện bắt buộc không đạt (quyền camera, dung lượng,
 * khả năng ghi tệp cục bộ), kèm cách khắc phục cụ thể, nút Kiểm tra lại và Về đơn hàng (không mất dữ
 * liệu đơn). Mở bằng `sessionId` (bất biến 2); phiên không còn ở trạng thái `created` thì để màn quay
 * nói đúng tình trạng. Chỉ có nghĩa khi bộ ghi thật bật (`RECORDER_ENABLED`). Micro chưa kiểm: ghi
 * không tiếng tới khi O-09 chốt. Ngưỡng dung lượng tạm chờ O-05. Chưa kiểm chứng trên thiết bị.
 */
export function PackPrecheckScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();
  const permission = useScannerPermission();
  const [round, setRound] = useState(0);

  // Mỗi lần bấm "Kiểm tra lại" (round) hoặc quyền đổi thì đo lại dung lượng và thử ghi.
  const result = useMemo(
    () =>
      // Bộ ghi tắt thì KHÔNG đo máy hay thử ghi (không có gì để chuẩn bị).
      RECORDER_ENABLED
        ? runPrecheck({
            camera: permission.status,
            freeBytes: getAvailableDiskBytes(),
            canWrite: probeEvidenceDirWritable,
          })
        : ({ status: 'pending' } as const),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` chỉ để buộc kiểm tra lại
    [permission.status, round],
  );

  const sessionId = session && session !== 'loading' ? session.id : null;
  const proceed =
    result.status === 'ready' || (session !== 'loading' && session?.sessionStatus !== 'created');
  useEffect(() => {
    if (!RECORDER_ENABLED || !sessionId || !proceed) return;
    navigation.replace(ROUTES.packRecord, { sessionId });
  }, [navigation, proceed, sessionId]);

  if (!RECORDER_ENABLED) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C02')}
        testID="screen-UI-C02"
        message={t('screens:record.notRecording')}
      />
    );
  }
  if (session === 'loading' || session === null || result.status !== 'blocked' || proceed) {
    return (
      <Screen title={t('nav:titles.UI-C02')} onBack={navigation.back} testID="screen-UI-C02">
        {session === null ? (
          <Text accessibilityRole="alert">{t('screens:record.sessionMissing')}</Text>
        ) : (
          <Text color="textMuted">{t('screens:precheck.checking')}</Text>
        )}
      </Screen>
    );
  }

  const fixes = new Set(result.issues.map((issue) => issue.fix));
  return (
    <Screen
      title={t('nav:titles.UI-C02')}
      testID="screen-UI-C02"
      onBack={navigation.back}
      footer={
        <>
          {fixes.has('request_permission') ? (
            <Button
              label={t('screens:precheck.requestCamera')}
              onPress={() => void permission.request()}
            />
          ) : null}
          {fixes.has('open_settings') ? (
            <Button
              label={t('screens:precheck.openSettings')}
              onPress={() => void openAppSettings()}
            />
          ) : null}
          <Button
            variant={
              fixes.has('request_permission') || fixes.has('open_settings')
                ? 'secondary'
                : 'primary'
            }
            label={t('screens:precheck.recheck')}
            onPress={() => setRound((value) => value + 1)}
          />
          <Button
            variant="secondary"
            label={t('screens:precheck.backToOrder')}
            onPress={() => navigation.replace(ROUTES.orderPreview, { orderId: session.orderId })}
          />
        </>
      }
    >
      <Text>{t('screens:precheck.intro')}</Text>
      <View style={{ gap: tokens.space.sm }}>
        {result.issues.map((issue) => (
          <Card key={issue.id} tone="warning" testID={`precheck-issue-${issue.id}`}>
            <Text accessibilityRole="alert">{t(`errors:${issue.code}`)}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
