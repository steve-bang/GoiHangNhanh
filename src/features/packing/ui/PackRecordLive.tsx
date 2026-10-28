import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useEvidenceFileStore, useOrderStore, type PackingSession } from '@/features/orders';
import {
  CameraRecorder,
  getAvailableDiskBytes,
  hashFile,
  newEvidenceId,
  persistRecording,
  useAppNavigation,
  useScannerPermission,
  useScreenFocused,
  type CameraRecorderHandle,
} from '@/platform';
import { Button, RecordingFrame, Screen, Text, useToast } from '@/shared/ui';

import {
  DEFAULT_RECORDING_POLICY,
  WARN_BEFORE_LIMIT_SECONDS,
  formatElapsed,
  maxRecordSeconds,
  startRecording,
  type ActiveRecording,
  type RecordingOutcome,
  type RecordingPorts,
} from '../domain';

const CLOCK_TICK_MS = 1000;

/**
 * Giới hạn quay (O-05): mặc định tối đa 10 phút mỗi lần, quá thì app tự dừng. Về sau theo gói của người
 * dùng: thay `DEFAULT_RECORDING_POLICY` bằng chính sách của gói.
 */
const POLICY = DEFAULT_RECORDING_POLICY;
const LIMIT_SECONDS = maxRecordSeconds(POLICY);
/** Sai lệch cho phép khi camera tự dừng đúng hạn (đồng hồ camera và JS lệch nhau chút ít). */
const LIMIT_TOLERANCE_MS = 3000;

type Phase = 'preparing' | 'recording' | 'saving' | 'failed';
type FailureKey =
  'saveFailed' | 'storageFull' | 'recorderFailed' | 'startFailed' | 'insufficientStorage';

const FAILURE_BY_REASON: Record<
  Extract<RecordingOutcome, { kind: 'failed' }>['reason'] | 'START' | 'INSUFFICIENT_STORAGE',
  FailureKey
> = {
  LOCAL_STORE: 'startFailed',
  START: 'startFailed',
  INSUFFICIENT_STORAGE: 'insufficientStorage',
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
 * (không "đã lưu") và cho đường về đơn; không xóa tệp nào.
 *
 * Rời màn (hộp thoại "Kết thúc phiên" theo từng pha):
 * - `preparing`, chưa bắt đầu ghi: chưa tạo tệp/phiên `recording` nào nên chỉ về đơn (không tệp mồ côi).
 *   Đã bắt đầu khởi động (bản ghi tệp đã tạo trước khi ghi, bất biến 2): dừng ngay khi bắt đầu xong.
 * - `recording`: dừng ghi rồi lưu như "Dừng quay".
 * - `saving`: việc lưu chạy ở nền (không phụ thuộc màn) nên về đơn được, kết quả nằm ở trạng thái tệp.
 * Màn bị gỡ bằng đường khác (điều hướng chương trình): dừng ghi qua tay cầm đã giữ (không qua `ref` camera
 * đã bị tháo) và dừng ngay khi bắt đầu xong nếu màn gỡ trong lúc khởi động. KHÔNG hứa "lưu nốt" khi camera
 * bị gỡ giữa chừng: kết quả thật tới từ bộ ghi, lỗi thì tệp ghi `local_save_failed` và phiên `interrupted`.
 * CẦN kiểm chứng trên iOS và Android thật: hành vi của `expo-camera` khi view bị gỡ lúc đang ghi.
 */
export function PackRecordLive({ session }: { session: PackingSession }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const orders = useOrderStore();
  const files = useEvidenceFileStore();
  const permission = useScannerPermission();
  const focused = useScreenFocused();
  const toast = useToast();

  const handleRef = useRef<CameraRecorderHandle | null>(null);
  const active = useRef<ActiveRecording | null>(null);
  const started = useRef(false);
  /** Người dùng rời khi chưa bắt đầu ghi: không được bắt đầu ghi nữa. */
  const cancelled = useRef(false);
  /** Người dùng đòi kết thúc khi bản ghi đang khởi động: dừng ngay khi bắt đầu xong. */
  const pendingStop = useRef(false);
  const stopRequested = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  /** App tự dừng vì hết thời lượng tối đa (khác với người dùng chủ động dừng). */
  const limitHit = useRef(false);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  /** Bản trạng thái của `limitHit` để hiển thị (ref không được đọc lúc render). */
  const [limitReached, setLimitReached] = useState(false);
  const mounted = useRef(true);

  /** Dừng đúng một lần (tránh gọi `stopRecording` hai lần khi vừa bấm dừng vừa gỡ màn). */
  const requestStop = useCallback(() => {
    const recording = active.current;
    if (!recording || stopRequested.current) return;
    stopRequested.current = true;
    recording.stop();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      requestStop(); // màn bị gỡ khi đang ghi: dừng qua tay cầm đã giữ; kết quả vẫn xử lý ở nền
    };
  }, [requestStop]);

  const ports = useMemo<RecordingPorts>(
    () => ({
      files,
      orders,
      recorder: {
        record: (options) => {
          const handle = handleRef.current;
          if (!handle) throw new Error('camera_not_ready');
          return handle.record(options);
        },
      },
      persist: persistRecording,
      hash: hashFile,
      availableBytes: getAvailableDiskBytes,
      maxDurationSec: LIMIT_SECONDS,
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
    if (started.current || cancelled.current) return;
    started.current = true;
    const recording = await startRecording(ports, session);
    if ('kind' in recording) {
      fail(FAILURE_BY_REASON[recording.reason]);
      return;
    }
    active.current = recording;
    void recording.result.then((outcome) => {
      active.current = null;
      if (!mounted.current) return;
      if (outcome.kind === 'saved') {
        // Dừng do hết thời lượng tối đa (bộ đếm của app, hoặc camera tự dừng đúng hạn): báo người dùng.
        const began = startedAtRef.current;
        const stoppedByCamera =
          !stopRequested.current &&
          began !== null &&
          Date.now() - began >= LIMIT_SECONDS * 1000 - LIMIT_TOLERANCE_MS;
        if (limitHit.current || stoppedByCamera) {
          toast.show(t('screens:record.limitReached', { minutes: POLICY.maxRecordMinutes }), {
            tone: 'info',
            durationMs: 8000,
          });
        }
        navigation.replace(ROUTES.packConfirm, { sessionId: session.id });
      } else {
        fail(FAILURE_BY_REASON[outcome.reason]);
      }
    });
    // Màn đã bị gỡ hoặc người dùng đã đòi kết thúc trong lúc khởi động: dừng ngay (không ai khác dừng).
    if (!mounted.current || pendingStop.current) requestStop();
    if (mounted.current) {
      startedAtRef.current = Date.now();
      setStartedAt(startedAtRef.current);
      setPhase(pendingStop.current ? 'saving' : 'recording');
    }
  }, [fail, navigation, ports, requestStop, session, t, toast]);

  const stop = useCallback(() => {
    if (!active.current) return;
    setPhase('saving');
    requestStop();
  }, [requestStop]);

  // Đồng hồ + giới hạn thời lượng: tới hạn thì tự dừng và lưu như người dùng bấm "Dừng quay".
  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const began = startedAtRef.current;
      if (began !== null && current - began >= LIMIT_SECONDS * 1000 && !limitHit.current) {
        limitHit.current = true;
        setLimitReached(true);
        stop();
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [phase, stop]);

  const toOrder = useCallback(
    () => navigation.replace(ROUTES.orderPreview, { orderId: session.orderId }),
    [navigation, session.orderId],
  );

  /** "Kết thúc phiên" ở từng pha (xem mô tả trên). */
  const endSession = useCallback(() => {
    if (phase === 'recording') {
      stop();
    } else if (phase === 'preparing' && started.current) {
      pendingStop.current = true; // bản ghi đang khởi động: dừng ngay khi xong
      setPhase('saving');
    } else if (phase === 'preparing') {
      cancelled.current = true; // chưa tạo tệp/phiên nào: chỉ về đơn
      toOrder();
    } else if (phase === 'saving') {
      toOrder(); // việc lưu vẫn chạy ở nền
    }
  }, [phase, stop, toOrder]);

  const cameraReady = permission.status === 'granted' && !cameraFailed;
  const minutes = POLICY.maxRecordMinutes;
  const remainingSeconds =
    phase === 'recording' && startedAt !== null
      ? LIMIT_SECONDS - Math.floor((now - startedAt) / 1000)
      : null;
  // Dải báo trung thực: đã dừng vì hết giờ / sắp hết giờ / đang lưu.
  const notice =
    phase === 'saving'
      ? t(limitReached ? 'screens:record.limitReachedSaving' : 'screens:record.saving', {
          minutes,
        })
      : remainingSeconds !== null && remainingSeconds <= WARN_BEFORE_LIMIT_SECONDS
        ? t('screens:record.limitSoon', { minutes })
        : null;

  if (phase === 'failed') {
    return (
      <Screen
        title={t('nav:titles.UI-C03')}
        testID="screen-UI-C03"
        footer={<Button label={t('screens:record.backToOrder')} onPress={toOrder} />}
      >
        <Text accessibilityRole="alert">
          {failure === 'insufficientStorage'
            ? t('screens:precheck.storageMinutes', { minutes: POLICY.maxRecordMinutes })
            : t(`screens:record.${failure ?? 'saveFailed'}`)}
        </Text>
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
      {...(notice ? { notice } : {})}
      {...(phase === 'preparing' || phase === 'saving'
        ? {
            leaveMessage: t(
              phase === 'saving' ? 'screens:record.leaveSaving' : 'screens:record.leavePreparing',
            ),
          }
        : {})}
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
      onEndSession={endSession}
    />
  );
}
