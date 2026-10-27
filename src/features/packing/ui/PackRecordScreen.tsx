import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import type { SessionId } from '@/core/ids';
import { useOrderStore, type PackingSession } from '@/features/orders';
import {
  CameraPreview,
  useAppNavigation,
  useRouteParams,
  useScannerPermission,
  useScreenFocused,
} from '@/platform';
import { RecordingFrame, Screen, Text } from '@/shared/ui';

import { RECORDER_ENABLED, formatElapsed } from '../domain';

const CLOCK_TICK_MS = 1000;

/**
 * UI-C03 Quay video đóng gói (đặc tả A05; mockup 03). Mở bằng ID phiên (`sessionId`) đã tạo ở bước
 * bắt đầu; mã đơn/kiện lấy từ ảnh chụp của phiên, không nhận qua tham số (bất biến 2). Camera chỉ
 * XEM TRƯỚC (expo-camera, không micro, không ghi tệp): giao diện giống mẫu nhưng luôn có dải "Bản thử
 * giao diện: chưa ghi video" khi `RECORDER_ENABLED=false` (bất biến 3, 11). Route nằm ngoài nhóm tab;
 * rời màn qua hộp thoại cảnh báo. "Dừng quay" và "Kết thúc phiên" sang Xác nhận video (UI-C04; vẫn là
 * màn minh họa, không báo "đã lưu"). Chưa xử lý gián đoạn (mất focus, app nền, camera bị thu hồi)
 * vì chưa ghi: decisions.md Q-17.
 */
export function PackRecordScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const store = useOrderStore();
  const permission = useScannerPermission();
  const focused = useScreenFocused();
  const sessionId = params.sessionId as SessionId | undefined;

  const [session, setSession] = useState<PackingSession | null | 'loading'>('loading');
  const [now, setNow] = useState(() => Date.now());
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = sessionId ? store.getSession(sessionId) : Promise.resolve(null);
    load.then((found) => alive && setSession(found)).catch(() => alive && setSession(null));
    return () => {
      alive = false;
    };
  }, [sessionId, store]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (session === 'loading' || session === null) {
    return (
      <Screen title={t('nav:titles.UI-C03')} onBack={navigation.back} testID="screen-UI-C03">
        {session === null ? (
          <Text accessibilityRole="alert">{t('screens:record.sessionMissing')}</Text>
        ) : (
          <Text color="textMuted">{t('screens:preview.loading')}</Text>
        )}
      </Screen>
    );
  }

  const goConfirm = () =>
    navigation.replace(ROUTES.packConfirm, { code: session.snapshot.orderCode });
  const cameraReady = permission.status === 'granted' && !cameraFailed;

  return (
    <RecordingFrame
      testID="screen-UI-C03"
      primaryCode={session.snapshot.orderCode}
      secondaryLabel={t('screens:record.package', { index: session.snapshot.packageIndex })}
      clockLabel={formatElapsed(session.startedAtDevice, now)}
      guidance={t('screens:record.packGuidance')}
      badgeLabel={t('screens:record.badge')}
      {...(RECORDER_ENABLED ? {} : { notice: t('screens:record.notRecording') })}
      preview={
        cameraReady && focused ? (
          <CameraPreview
            testID="record-camera"
            torch={torch}
            onError={() => setCameraFailed(true)}
          />
        ) : undefined
      }
      previewMessage={t('screens:record.cameraError')}
      torch={torch}
      {...(cameraReady ? { onToggleTorch: () => setTorch((value) => !value) } : {})}
      onStop={goConfirm}
      onEndSession={goConfirm}
    />
  );
}
