import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useEvidenceFileStore, useOrderStore, type PackingSession } from '@/features/orders';
import {
  CameraRecorder,
  getAvailableDiskBytes,
  hashFile,
  monotonicNow,
  newEvidenceId,
  onceAppActive,
  persistRecording,
  subscribeAppBackground,
  useAppNavigation,
  useKeepScreenAwake,
  useScannerPermission,
  useScreenFocused,
  type CameraRecorderHandle,
} from '@/platform';
import { Button, RecordingFrame, Screen, Text, useToast } from '@/shared/ui';

import {
  ACTIVE_RECORDING_POLICY,
  WARN_BEFORE_LIMIT_SECONDS,
  classifyCameraEnd,
  formatElapsed,
  maxRecordSeconds,
  requiredFreeBytes,
  startRecording,
  type ActiveRecording,
  type RecordingOutcome,
  type RecordingPorts,
} from '../domain';

const CLOCK_TICK_MS = 1000;

/**
 * Giới hạn quay (O-05): mặc định tối đa 10 phút mỗi lần, quá thì app tự dừng. Về sau theo gói của người
 * dùng: đổi `ACTIVE_RECORDING_POLICY` (cùng nguồn với UI-C02).
 */
const POLICY = ACTIVE_RECORDING_POLICY;
const LIMIT_SECONDS = maxRecordSeconds(POLICY);

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
 *
 * V1-11: giữ màn hình sáng suốt lúc chuẩn bị, quay và lưu (tắt khi lỗi hoặc rời màn). App chuyển sang nền
 * khi đang quay: dừng ghi qua đúng đường lưu ở trên, phiên `interrupted` (không quay tiếp, không ghép tệp,
 * phiên/kiện giữ nguyên), quay lại app thì báo đã dừng. Camera tự dừng sớm (bị hệ thống ngắt) cũng là
 * gián đoạn. `inactive` của iOS không tính là vào nền (`subscribeAppBackground`).
 * CẦN kiểm chứng trên iOS và Android thật: hành vi của `expo-camera` khi view bị gỡ/app vào nền lúc đang ghi.
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
  /**
   * Mốc (đồng hồ đơn điệu) lúc gọi lệnh ghi và lúc camera TRẢ kết quả, chốt ngay trong bộ ghi, TRƯỚC khi
   * lưu bền và băm (có thể mất hàng chục giây). Dùng để biết camera dừng ở thời lượng nào; không dùng
   * thời điểm xử lý xong, nếu không quay bị ngắt sớm mà lưu chậm sẽ bị báo nhầm là "tự dừng vì giới hạn".
   */
  const cameraTiming = useRef<{ begin: number; end: number | null } | null>(null);
  /** App tự dừng vì hết thời lượng tối đa (khác với người dùng chủ động dừng). */
  const limitHit = useRef(false);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => monotonicNow());
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  /** Bản trạng thái của `limitHit` để hiển thị (ref không được đọc lúc render). */
  const [limitReached, setLimitReached] = useState(false);
  /** Lần quay bị gián đoạn (vào nền, camera bị ngắt sớm): phiên lưu xong sẽ là `interrupted`. */
  const interrupted = useRef(false);
  /** Đã dừng vì app vào nền (để nói đúng nguyên nhân ở dải báo). */
  const [stoppedInBackground, setStoppedInBackground] = useState(false);
  /**
   * Bản đồng bộ của `phase` cho trình nghe vào nền: mọi chỗ gọi `setPhase` đặt ref NGAY cùng lúc (không chờ
   * render), để sự kiện tới giữa lúc đổi pha và lần vẽ kế tiếp không bị bỏ qua.
   */
  const phaseRef = useRef<Phase>('preparing');
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
          const timing: { begin: number; end: number | null } = {
            begin: monotonicNow(),
            end: null,
          };
          cameraTiming.current = timing;
          const recording = handle.record(options);
          const mark = () => {
            if (timing.end !== null) return;
            timing.end = monotonicNow();
            // Camera đã trả kết quả: từ đây chỉ còn lưu + băm. Chốt NGAY nguyên nhân (trước khi lưu/băm có thể
            // mất lâu) và chuyển màn sang "đang lưu" để không còn hiện "Đang quay" / nút Dừng.
            const ended = classifyCameraEnd({
              stopRequested: stopRequested.current,
              elapsedMs: timing.end - timing.begin,
              limitSeconds: LIMIT_SECONDS,
            });
            if (ended === 'limit') {
              limitHit.current = true;
              if (mounted.current) setLimitReached(true);
            } else if (ended === 'early') {
              interrupted.current = true; // hệ thống ngắt camera: video có thể thiếu phần sau
            }
            if (phaseRef.current !== 'failed') phaseRef.current = 'saving';
            if (mounted.current) setPhase((current) => (current === 'failed' ? current : 'saving'));
          };
          return {
            ...recording,
            done: recording.done.then(
              (result) => {
                mark();
                return result;
              },
              (error: unknown) => {
                mark();
                throw error;
              },
            ),
          };
        },
      },
      minFreeBytes: requiredFreeBytes(POLICY),
      persist: persistRecording,
      hash: hashFile,
      availableBytes: getAvailableDiskBytes,
      maxDurationSec: LIMIT_SECONDS,
      wasInterrupted: () => interrupted.current,
      newEvidenceId,
      now: Date.now, // giờ THIẾT BỊ cho dấu thời gian bằng chứng (không dùng đồng hồ đơn điệu)
    }),
    [files, orders],
  );

  const fail = useCallback((key: FailureKey) => {
    if (!mounted.current) return;
    phaseRef.current = 'failed';
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
    // Vào nền trong lúc khởi động (V1-11): ghi phiên `interrupted` ngay khi đã có bản ghi.
    if (interrupted.current) void recording.markInterrupted();
    void recording.result.then((outcome) => {
      active.current = null;
      if (!mounted.current) return;
      if (outcome.kind === 'saved') {
        // Dừng do hết thời lượng tối đa (bộ đếm của app, hoặc camera tự dừng đúng hạn): báo người dùng.
        // `limitHit` đã được chốt khi camera trả kết quả (bộ ghi ở trên) hoặc khi bộ đếm của app dừng; bấm
        // Dừng sau đó không xóa nó. Ngắt sớm hơn (cuộc gọi, OS...) thì KHÔNG nói là do giới hạn.
        if (limitHit.current) {
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
      startedAtRef.current = monotonicNow();
      setStartedAt(startedAtRef.current);
      // Đặt ref NGAY (không chờ render): sự kiện vào nền tới trước lần vẽ kế tiếp vẫn thấy "đang quay".
      const next: Phase =
        pendingStop.current || cameraTiming.current?.end != null ? 'saving' : 'recording';
      if (phaseRef.current !== 'failed') phaseRef.current = next;
      setPhase(next);
    }
  }, [fail, navigation, ports, requestStop, session, t, toast]);

  const stop = useCallback(() => {
    if (!active.current) return;
    phaseRef.current = 'saving';
    setPhase('saving');
    requestStop();
  }, [requestStop]);

  useKeepScreenAwake(phase !== 'failed');

  // App vào nền khi đang quay (V1-11): dừng có chủ đích qua đường lưu sẵn có, đánh dấu gián đoạn, báo khi
  // quay lại. Toast hẹn qua `onceAppActive` vì lúc đó màn này có thể đã chuyển sang Xác nhận.
  useEffect(
    () =>
      subscribeAppBackground(() => {
        const current = phaseRef.current;
        const recordingNow = current === 'recording' && active.current && !stopRequested.current;
        const startingNow = current === 'preparing' && started.current && !active.current;
        if (!recordingNow && !startingNow) return;
        interrupted.current = true;
        phaseRef.current = 'saving';
        setStoppedInBackground(true);
        setPhase('saving');
        if (recordingNow) {
          void active.current?.markInterrupted(); // ghi phiên `interrupted` NGAY, không chờ lưu xong
          requestStop();
        } else pendingStop.current = true; // bản ghi đang khởi động: dừng ngay khi bắt đầu xong
        onceAppActive(() =>
          toast.show(t('screens:record.stoppedInBackground'), { tone: 'info', durationMs: 10000 }),
        );
      }),
    [requestStop, t, toast],
  );

  // Đồng hồ + giới hạn thời lượng: tới hạn thì tự dừng và lưu như người dùng bấm "Dừng quay".
  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const timer = setInterval(() => {
      const current = monotonicNow();
      setNow(current);
      const began = startedAtRef.current;
      // Camera đã trả kết quả (dừng sớm vì lý do khác, đang lưu/băm) thì bộ đếm không còn là nguyên nhân dừng.
      const cameraEnded = cameraTiming.current?.end != null;
      if (
        began !== null &&
        !cameraEnded &&
        current - began >= LIMIT_SECONDS * 1000 &&
        !limitHit.current
      ) {
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
      phaseRef.current = 'saving';
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
      ? t(
          stoppedInBackground
            ? 'screens:record.backgroundSaving'
            : limitReached
              ? 'screens:record.limitReachedSaving'
              : 'screens:record.saving',
          { minutes },
        )
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
      footnote={t('screens:record.killWarning')}
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
      stopHidden={phase === 'saving'}
      onEndSession={endSession}
    />
  );
}
