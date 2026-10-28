import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useEvidenceFileStore, useOrderStore, type PackingSession } from '@/features/orders';
import {
  CameraRecorder,
  hashFile,
  newEvidenceId,
  persistRecording,
  useAppNavigation,
  useScannerPermission,
  useScreenFocused,
  type CameraRecorderHandle,
} from '@/platform';
import { Button, RecordingFrame, Screen, Text } from '@/shared/ui';

import {
  formatElapsed,
  startRecording,
  type ActiveRecording,
  type RecordingOutcome,
  type RecordingPorts,
} from '../domain';

const CLOCK_TICK_MS = 1000;

type Phase = 'preparing' | 'recording' | 'saving' | 'failed';
type FailureKey = 'saveFailed' | 'storageFull' | 'recorderFailed' | 'startFailed';

const FAILURE_BY_REASON: Record<
  Extract<RecordingOutcome, { kind: 'failed' }>['reason'] | 'START',
  FailureKey
> = {
  LOCAL_STORE: 'startFailed',
  START: 'startFailed',
  RECORDER_FAILED: 'recorderFailed',
  STORAGE_FULL: 'storageFull',
  SAVE_FAILED: 'saveFailed',
  FILE_UNREADABLE: 'saveFailed',
};

/**
 * UI-C03 khi bộ ghi video thật đã bật (`RECORDER_ENABLED`). Camera ghi thật qua `CameraRecorder`;
 * `startRecording` tạo bản ghi tệp + phiên `recording` TRƯỚC khi ghi và đưa tệp qua các trạng thái
 * (đang ghi -> đang lưu -> chờ tải lên). Chỉ hiện "Đang quay" sau khi lệnh ghi đã được gửi và chưa
 * báo lỗi; chỉ sang màn xác nhận khi tệp ĐÃ lưu bền và có mã băm. Lỗi thì nói đúng điều đã xảy ra
 * (không "đã lưu") và cho đường về đơn; không xóa tệp nào. Rời màn khi đang ghi thì dừng ghi và vẫn lưu
 * nốt phần đã ghi. Chưa kiểm chứng trên thiết bị.
 */
export function PackRecordLive({ session }: { session: PackingSession }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const orders = useOrderStore();
  const files = useEvidenceFileStore();
  const permission = useScannerPermission();
  const focused = useScreenFocused();

  const handleRef = useRef<CameraRecorderHandle | null>(null);
  const active = useRef<ActiveRecording | null>(null);
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.stop(); // rời màn khi đang ghi: dừng; kết quả vẫn được lưu ở nền
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  const ports = useMemo<RecordingPorts>(
    () => ({
      files,
      orders,
      recorder: {
        record: () => {
          const handle = handleRef.current;
          if (!handle) throw new Error('camera_not_ready');
          return handle.record();
        },
      },
      persist: persistRecording,
      hash: hashFile,
      newEvidenceId,
      now: Date.now,
    }),
    [files, orders],
  );

  const fail = useCallback((key: FailureKey) => {
    if (!mounted.current) return;
    setFailure(key);
    setPhase('failed');
  }, []);

  const begin = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    const recording = await startRecording(ports, session);
    if ('kind' in recording) {
      fail(FAILURE_BY_REASON[recording.reason]);
      return;
    }
    active.current = recording;
    if (mounted.current) {
      setStartedAt(Date.now());
      setPhase('recording');
    }
    void recording.result.then((outcome) => {
      active.current = null;
      if (!mounted.current) return;
      if (outcome.kind === 'saved') {
        navigation.replace(ROUTES.packConfirm, { sessionId: session.id });
      } else {
        fail(FAILURE_BY_REASON[outcome.reason]);
      }
    });
  }, [fail, navigation, ports, session]);

  const stop = useCallback(() => {
    if (!active.current) return;
    setPhase('saving');
    active.current.stop();
  }, []);

  const cameraReady = permission.status === 'granted' && !cameraFailed;

  if (phase === 'failed') {
    return (
      <Screen
        title={t('nav:titles.UI-C03')}
        testID="screen-UI-C03"
        footer={
          <Button
            label={t('screens:record.backToOrder')}
            onPress={() => navigation.replace(ROUTES.orderPreview, { orderId: session.orderId })}
          />
        }
      >
        <Text accessibilityRole="alert">{t(`screens:record.${failure ?? 'saveFailed'}`)}</Text>
      </Screen>
    );
  }

  return (
    <RecordingFrame
      testID="screen-UI-C03"
      primaryCode={session.snapshot.orderCode}
      secondaryLabel={t('screens:record.package', { index: session.snapshot.packageIndex })}
      clockLabel={formatElapsed(startedAt ?? now, now)}
      guidance={t('screens:record.packGuidance')}
      recording={phase === 'recording'}
      badgeLabel={t('screens:record.badge')}
      previewLabel={t('screens:record.previewBadge')}
      {...(phase === 'saving' ? { notice: t('screens:record.saving') } : {})}
      preview={
        cameraReady && (focused || phase !== 'preparing') ? (
          <CameraRecorder
            testID="record-camera"
            handleRef={handleRef}
            torch={torch}
            onReady={() => void begin()}
            onError={() => {
              setCameraFailed(true);
              if (!active.current) fail('startFailed');
            }}
          />
        ) : undefined
      }
      previewMessage={t('screens:record.cameraError')}
      torch={torch}
      {...(cameraReady ? { onToggleTorch: () => setTorch((value) => !value) } : {})}
      onStop={stop}
      onEndSession={stop}
    />
  );
}
