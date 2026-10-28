import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import {
  getAvailableDiskBytes,
  openAppSettings,
  probeEvidenceDirWritable,
  readDeviceCondition,
  UNKNOWN_DEVICE_CONDITION,
  useAppNavigation,
  type DeviceCondition,
  useScannerPermission,
} from '@/platform';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';

import { ACTIVE_RECORDING_POLICY, RECORDER_ENABLED, runPrecheck } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { usePackSession } from './use-pack-session';

/** Đọc pin/nhiệt độ treo quá hạn này thì coi là "không biết" (không chặn quay). */
const DEVICE_READ_TIMEOUT_MS = 3000;

/**
 * UI-C02 Kiểm tra trước khi quay (đặc tả A04). CHẠY NGẦM: khi đạt hết thì chuyển thẳng sang màn quay,
 * không thêm thao tác; chỉ hiện nội dung khi có điều kiện bắt buộc không đạt (quyền camera, dung lượng,
 * khả năng ghi tệp cục bộ), kèm cách khắc phục cụ thể, nút Kiểm tra lại và Về đơn hàng (không mất dữ
 * liệu đơn). Mở bằng `sessionId` (bất biến 2); phiên không còn ở trạng thái `created` thì để màn quay
 * nói đúng tình trạng. Chỉ có nghĩa khi bộ ghi thật bật (`RECORDER_ENABLED`). Micro chưa kiểm: ghi
 * không tiếng tới khi O-09 chốt. Chỗ trống phải đủ quay 10 phút (O-05, về sau theo gói); pin thấp khi không
 * sạc và máy quá nóng cũng chặn (nhiệt độ chưa có nguồn trên Expo). Chưa kiểm chứng trên thiết bị.
 */
export function PackPrecheckScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();
  const permission = useScannerPermission();
  const [round, setRound] = useState(0);
  // Chỉ đo máy khi bộ ghi bật và phiên còn ở `created` (phiên thiếu/đã qua `created` thì không có gì để chuẩn bị).
  const needsCheck =
    RECORDER_ENABLED &&
    session !== 'loading' &&
    session !== null &&
    session.sessionStatus === 'created';
  // Pin/nhiệt độ, dung lượng trống và thử ghi đo trong effect (không I/O lúc render) theo từng lượt `round`;
  // chưa có kết quả của lượt này thì chờ (tránh chuyển sang quay bằng số liệu cũ).
  const [device, setDevice] = useState<{ round: number; value: DeviceCondition } | null>(null);
  const [disk, setDisk] = useState<{
    round: number;
    freeBytes: number | null;
    writable: boolean;
  } | null>(null);
  useEffect(() => {
    if (!needsCheck) return undefined;
    let alive = true;
    const measured = {
      round,
      freeBytes: getAvailableDiskBytes(),
      writable: probeEvidenceDirWritable(),
    };
    // Đọc pin treo thì không kẹt mãi ở "Đang kiểm tra máy…": quá hạn coi là "không biết" (không chặn).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unknown = new Promise<DeviceCondition>((resolve) => {
      timer = setTimeout(() => resolve(UNKNOWN_DEVICE_CONDITION), DEVICE_READ_TIMEOUT_MS);
    });
    void Promise.race([readDeviceCondition(), unknown])
      .catch(() => UNKNOWN_DEVICE_CONDITION)
      .then((value) => {
        clearTimeout(timer);
        if (!alive) return;
        setDisk(measured);
        setDevice({ round, value });
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [needsCheck, round]);

  const result = useMemo(
    () =>
      needsCheck && device?.round === round && disk?.round === round
        ? runPrecheck({
            camera: permission.status,
            freeBytes: disk.freeBytes,
            canWrite: () => disk.writable,
            device: device.value,
            policy: ACTIVE_RECORDING_POLICY,
          })
        : ({ status: 'pending' } as const),
    [needsCheck, permission.status, round, device, disk],
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
            <Text accessibilityRole="alert">
              {issue.code === 'INSUFFICIENT_STORAGE'
                ? t('screens:precheck.storageMinutes', {
                    minutes: ACTIVE_RECORDING_POLICY.maxRecordMinutes,
                  })
                : t(`errors:${issue.code}`)}
            </Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
