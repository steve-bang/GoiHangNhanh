import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { useCurrentShopId } from '@/features/orders';
import {
  ACTIVE_RECORDING_POLICY,
  WARN_BEFORE_LIMIT_SECONDS,
  classifyCameraEnd,
  formatElapsed,
  maxRecordSeconds,
  requiredFreeBytes,
} from '@/features/packing';
import {
  CameraRecorder,
  getAvailableDiskBytes,
  hashFile,
  monotonicNow,
  newReturnRecordId,
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

import { useReturnStore } from '../data';
import {
  findUnrecordedVideo,
  startOpeningVideo,
  type ActiveVideo,
  type MissingVideoReason,
  type ReturnDetails,
  type VideoFailure,
  type VideoPorts,
  type VideoStartFailure,
} from '../domain';
import { SkipReasonSheet } from './ReturnSkipSheet';
import { useReturnMedia } from './use-return-photos';
import { useReturnOps } from './use-return-ops';

const CLOCK_TICK_MS = 1000;
const POLICY = ACTIVE_RECORDING_POLICY;
const LIMIT_SECONDS = maxRecordSeconds(POLICY);

type Phase = 'preparing' | 'recording' | 'saving' | 'failed';
type FailureKey =
  | 'saveFailed'
  | 'storageFull'
  | 'recorderFailed'
  | 'startFailed'
  | 'insufficientStorage'
  | 'notReady';

const FAILURE_BY_REASON: Record<VideoStartFailure | VideoFailure, FailureKey> = {
  NOT_READY: 'notReady',
  ALREADY_RECORDED: 'notReady',
  ATTEMPTED: 'startFailed',
  INSUFFICIENT_STORAGE: 'insufficientStorage',
  LOCAL_STORE: 'startFailed',
  RECORDER_FAILED: 'recorderFailed',
  STORAGE_FULL: 'storageFull',
  SAVE_FAILED: 'saveFailed',
  FILE_UNREADABLE: 'saveFailed',
};

/** Lý do mặc định khi video không quay/lưu được (người dùng đổi được trong bảng hỏi lý do). */
const FAILED_REASONS: readonly MissingVideoReason[] = ['device_problem', 'user_skipped'];

/**
 * UI-D04 khi bộ ghi video thật đã bật (`RECORDER_ENABLED`, R2b/Q-28, ADR-020). Quay video mở kiện thật qua
 * `CameraRecorder` (không thu tiếng, O-09) và `startOpeningVideo`: bản ghi media gắn hồ sơ được tạo TRƯỚC
 * khi mở camera; chỉ hiện "Đang quay" sau khi lệnh ghi đã gửi và chưa báo lỗi; chỉ sang bước kiểm hàng
 * khi video ĐÃ lưu bền, có mã băm và đã ghi vào hồ sơ. Lỗi thì nói đúng điều đã xảy ra, KHÔNG nói "đã
 * lưu", KHÔNG xóa tệp nào, và cho ghi nhận lý do chưa có video (không quay bù: bất biến 6).
 *
 * Mỗi hồ sơ chỉ MỘT video mở kiện: đã có video hoặc đã có lần quay trước (kể cả lưu lỗi) thì không mở
 * camera nữa (bất biến 4, 6). Video đã lưu mà hồ sơ chưa ghi nhận (lỗi kho ở bước cuối, app bị đóng) thì
 * tự ghi nhận khi mở màn. Kiện đã mở trước khi quay vẫn là nhánh ngoại lệ: video chỉ ghi tình trạng
 * hiện tại và hồ sơ vẫn mang nhãn hạn chế bằng chứng. Chưa kiểm tra pin/nhiệt độ/ghi thử (A04) như UI-C02
 * của đóng gói; chỉ kiểm dung lượng. Video bị chặn rời màn bằng hộp thoại của khung.
 *
 * V1-11 (giống UI-C03): giữ màn hình sáng khi chuẩn bị/quay/lưu; app vào nền khi đang quay thì dừng qua đường
 * lưu sẵn có và ghi video `interrupted: true` (hạn chế bằng chứng, không quay bù/quay tiếp: bất biến 6);
 * camera tự dừng sớm cũng là gián đoạn. CẦN kiểm chứng trên iOS và Android thật (cùng danh sách ở ADR-020).
 */
export function ReturnRecordLive({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const toast = useToast();
  const { returnCase } = details;
  const { videos, reload } = useReturnMedia(returnCase.id);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<MissingVideoReason>('device_problem');
  const [busy, setBusy] = useState(false);
  const [reconcileFailed, setReconcileFailed] = useState(false);
  const [reconcileTry, setReconcileTry] = useState(0);
  /**
   * Video vừa lưu bị gián đoạn mà hồ sơ chưa ghi nhận được (lỗi kho): bước đối soát ghi đúng cờ gián đoạn.
   * Bổ sung cho cờ BỀN trên bản ghi video (`ReturnMedia.interrupted`, V1-13), phòng khi kho lỗi đúng lúc
   * ghi cờ; app bị tắt giữa hai bước thì đối soát lần sau đọc cờ bền.
   */
  const [interruptedVideoId, setInterruptedVideoId] = useState<string | null>(null);

  const toItems = useCallback(
    () => navigation.replace(ROUTES.returnItems, { returnId: returnCase.id }),
    [navigation, returnCase.id],
  );
  const toList = useCallback(() => navigation.replace(ROUTES.returns), [navigation]);

  // Chưa ghi tình trạng bên ngoài thì quay lại bước đó; đã xác nhận thì sang màn xem (không nhảy cóc).
  const redirect =
    returnCase.status === 'receiving' || returnCase.status === 'confirmed'
      ? returnCase.status
      : null;
  useEffect(() => {
    if (redirect) {
      navigation.replace(redirect === 'receiving' ? ROUTES.returnExterior : ROUTES.returnDone, {
        returnId: returnCase.id,
      });
    }
  }, [redirect, navigation, returnCase.id]);

  // Video đã lưu bền mà hồ sơ chưa ghi nhận: ghi nhận rồi sang kiểm hàng (không quay lại).
  const unrecorded = videos ? findUnrecordedVideo(returnCase.openingVideo, videos) : null;
  useEffect(() => {
    if (!unrecorded || redirect) return undefined;
    let alive = true;
    ops
      .recordOpeningVideo(
        returnCase.id,
        unrecorded.id,
        unrecorded.interrupted === true || interruptedVideoId === unrecorded.id,
      )
      .then(() => alive && toItems())
      .catch((error: unknown) => {
        logger.warn('returns.video_reconcile_failed', {
          reason: isAppError(error) ? error.code : 'unknown',
        });
        if (alive) setReconcileFailed(true);
      });
    return () => {
      alive = false;
    };
    // `reconcileTry` đổi khi người dùng bấm Thử lại.
  }, [unrecorded, redirect, ops, returnCase.id, toItems, reconcileTry, interruptedVideoId]);

  const skip = async (chosen: MissingVideoReason) => {
    if (busy) return;
    setBusy(true);
    try {
      await ops.skipOpeningVideo(returnCase.id, chosen);
      toItems();
    } catch (error) {
      logger.warn('returns.video_step_failed', {
        reason: isAppError(error) ? error.code : 'unknown',
      });
      toast.show(
        errorText(resolveErrorMessage(t, isAppError(error) ? error.code : 'RETURN_SAVE_FAILED')),
        { tone: 'error' },
      );
      setBusy(false);
    }
  };
  const openedBefore = returnCase.openedBefore !== null;
  const options: readonly MissingVideoReason[] = openedBefore
    ? ['opened_before_recording']
    : FAILED_REASONS;
  const askForReason = () => {
    setReason(options[0] ?? 'device_problem');
    setAsking(true);
  };
  const sheet = (
    <SkipReasonSheet
      visible={asking}
      onClose={() => setAsking(false)}
      options={options}
      reason={reason}
      onSelect={setReason}
      busy={busy}
      onConfirm={() => void skip(reason)}
    />
  );

  if (redirect || videos === null) {
    return (
      <Screen title={t('nav:titles.UI-D04')} testID="screen-UI-D04">
        <Text color="textMuted">{t('returns:record.live.loading')}</Text>
      </Screen>
    );
  }

  // Bước video đã xong (đã quay hoặc đã ghi lý do): không mở camera nữa.
  if (returnCase.openingVideo !== null) {
    return (
      <Screen
        title={t('nav:titles.UI-D04')}
        testID="screen-UI-D04"
        footer={
          <Button
            testID="return-video-continue"
            label={t('returns:record.live.continue')}
            onPress={toItems}
          />
        }
      >
        <Text>{t('returns:record.live.done')}</Text>
      </Screen>
    );
  }

  if (unrecorded) {
    return (
      <Screen
        title={t('nav:titles.UI-D04')}
        testID="screen-UI-D04"
        footer={
          reconcileFailed ? (
            <Button
              testID="return-video-reconcile-retry"
              label={t('returns:record.live.retry')}
              onPress={() => {
                setReconcileFailed(false);
                setReconcileTry((n) => n + 1);
              }}
            />
          ) : undefined
        }
      >
        <Text accessibilityRole={reconcileFailed ? 'alert' : undefined}>
          {t(
            reconcileFailed
              ? 'returns:record.live.reconcileFailed'
              : 'returns:record.live.reconciling',
          )}
        </Text>
      </Screen>
    );
  }

  // Đã từng có một lần quay nhưng không lưu được: kiện có thể đã mở, không quay lại như thể chưa mở.
  if (videos.length > 0) {
    return (
      <>
        <Screen
          title={t('nav:titles.UI-D04')}
          testID="screen-UI-D04"
          footer={
            <Button
              testID="return-video-note-reason"
              label={t('returns:record.live.noteReason')}
              onPress={askForReason}
            />
          }
        >
          <Text accessibilityRole="alert">{t('returns:record.live.attempted')}</Text>
        </Screen>
        {sheet}
      </>
    );
  }

  return (
    <LiveCamera
      details={details}
      onSaved={(saved) => {
        if (saved.recordedInCase) {
          toItems();
          return;
        }
        if (saved.interrupted) setInterruptedVideoId(saved.mediaId);
        void reload(); // đối soát ở trên sẽ ghi nhận video đã lưu vào hồ sơ
      }}
      onFailedAskReason={askForReason}
      toList={toList}
      sheet={sheet}
    />
  );
}

function LiveCamera({
  details,
  onSaved,
  onFailedAskReason,
  toList,
  sheet,
}: {
  details: ReturnDetails;
  onSaved: (saved: {
    readonly mediaId: string;
    readonly recordedInCase: boolean;
    readonly interrupted: boolean;
  }) => void;
  onFailedAskReason: () => void;
  toList: () => void;
  sheet: React.ReactNode;
}) {
  const { t } = useTranslation();
  const store = useReturnStore();
  const shopId = useCurrentShopId();
  const permission = useScannerPermission();
  const focused = useScreenFocused();
  const toast = useToast();
  const { returnCase } = details;

  const handleRef = useRef<CameraRecorderHandle | null>(null);
  const active = useRef<ActiveVideo | null>(null);
  const started = useRef(false);
  const cancelled = useRef(false);
  const pendingStop = useRef(false);
  const stopRequested = useRef(false);
  const limitHit = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const mounted = useRef(true);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => monotonicNow());
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  /** Lần quay bị gián đoạn (vào nền, camera bị ngắt sớm): video ghi vào hồ sơ `interrupted: true`. */
  const interrupted = useRef(false);
  const [stoppedInBackground, setStoppedInBackground] = useState(false);
  /**
   * Bản đồng bộ của `phase` cho trình nghe vào nền: mọi chỗ gọi `setPhase` đặt ref NGAY cùng lúc (không chờ
   * render), để sự kiện tới giữa lúc đổi pha và lần vẽ kế tiếp không bị bỏ qua.
   */
  const phaseRef = useRef<Phase>('preparing');

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

  const ports = useMemo<VideoPorts>(
    () => ({
      store,
      recorder: {
        record: (options) => {
          const handle = handleRef.current;
          if (!handle) throw new Error('camera_not_ready');
          const begun = monotonicNow();
          const recording = handle.record(options);
          let marked = false;
          const mark = () => {
            if (marked) return;
            marked = true;
            // Camera tự dừng sớm mà không ai yêu cầu (hệ thống ngắt camera): video có thể thiếu phần sau.
            const ended = classifyCameraEnd({
              stopRequested: stopRequested.current,
              elapsedMs: monotonicNow() - begun,
              limitSeconds: LIMIT_SECONDS,
            });
            if (ended === 'early') interrupted.current = true;
            // Camera đã trả kết quả: từ đây chỉ còn lưu + băm.
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
      newId: newReturnRecordId,
      now: Date.now, // giờ THIẾT BỊ cho dấu thời gian bằng chứng (không dùng đồng hồ đơn điệu)
    }),
    [store],
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
    const recording = await startOpeningVideo(ports, { shopId, returnId: returnCase.id });
    if ('kind' in recording) {
      logger.warn('returns.video_start_failed', { reason: recording.reason });
      fail(FAILURE_BY_REASON[recording.reason]);
      return;
    }
    active.current = recording;
    // Vào nền trong lúc khởi động (V1-11): ghi cờ gián đoạn bền ngay khi đã có bản ghi (V1-13).
    if (interrupted.current) void recording.markInterrupted();
    void recording.result.then((outcome) => {
      active.current = null;
      if (outcome.kind === 'saved') {
        if (limitHit.current && mounted.current) {
          toast.show(t('screens:record.limitReached', { minutes: POLICY.maxRecordMinutes }), {
            tone: 'info',
            durationMs: 8000,
          });
        }
        onSaved(outcome);
      } else {
        logger.warn('returns.video_failed', { reason: outcome.reason });
        fail(FAILURE_BY_REASON[outcome.reason]);
      }
    });
    // Màn đã bị gỡ hoặc người dùng đã đòi kết thúc trong lúc khởi động: dừng ngay.
    if (!mounted.current || pendingStop.current) requestStop();
    if (mounted.current) {
      startedAtRef.current = monotonicNow();
      setStartedAt(startedAtRef.current);
      // Đặt ref NGAY (không chờ render): sự kiện vào nền tới trước lần vẽ kế tiếp vẫn thấy "đang quay".
      const next: Phase = pendingStop.current ? 'saving' : 'recording';
      if (phaseRef.current !== 'failed') phaseRef.current = next;
      setPhase(next);
    }
  }, [fail, onSaved, ports, requestStop, returnCase.id, shopId, t, toast]);

  const stop = useCallback(() => {
    if (!active.current) return;
    phaseRef.current = 'saving';
    setPhase('saving');
    requestStop();
  }, [requestStop]);

  useKeepScreenAwake(phase !== 'failed');

  // App vào nền khi đang quay (V1-11): dừng qua đường lưu sẵn có, ghi gián đoạn, báo khi quay lại app.
  useEffect(
    () =>
      subscribeAppBackground(() => {
        const current = phaseRef.current;
        const recordingNow = current === 'recording' && active.current && !stopRequested.current;
        const startingNow = current === 'preparing' && started.current && !active.current;
        if (!recordingNow && !startingNow) return;
        interrupted.current = true;
        void active.current?.markInterrupted(); // ghi cờ gián đoạn BỀN ngay, không chờ lưu xong (V1-13)
        phaseRef.current = 'saving';
        setStoppedInBackground(true);
        setPhase('saving');
        if (recordingNow) requestStop();
        else pendingStop.current = true; // bản ghi đang khởi động: dừng ngay khi bắt đầu xong
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
      if (began !== null && current - began >= LIMIT_SECONDS * 1000 && !limitHit.current) {
        limitHit.current = true;
        setLimitReached(true);
        stop();
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [phase, stop]);

  /** "Kết thúc phiên" ở từng pha: đang ghi thì dừng và lưu; chưa ghi thì về danh sách. */
  const endSession = useCallback(() => {
    if (phase === 'recording') {
      stop();
    } else if (phase === 'preparing' && started.current) {
      pendingStop.current = true; // bản ghi đang khởi động: dừng ngay khi xong
      phaseRef.current = 'saving';
      setPhase('saving');
    } else {
      cancelled.current = true; // chưa tạo gì, hoặc việc lưu chạy ở nền
      toList();
    }
  }, [phase, stop, toList]);

  const cameraReady = permission.status === 'granted' && !cameraFailed;
  const remainingSeconds =
    phase === 'recording' && startedAt !== null
      ? LIMIT_SECONDS - Math.floor((now - startedAt) / 1000)
      : null;
  const minutes = POLICY.maxRecordMinutes;
  const openedBefore = returnCase.openedBefore !== null;
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
        : openedBefore
          ? t('returns:review.videoOpenedBefore')
          : null;

  if (phase === 'failed') {
    return (
      <>
        <Screen
          title={t('nav:titles.UI-D04')}
          testID="screen-UI-D04"
          footer={
            failure === 'notReady' ? (
              <Button label={t('returns:record.live.backToList')} onPress={toList} />
            ) : (
              <Button
                testID="return-video-note-reason"
                label={t('returns:record.live.noteReason')}
                onPress={onFailedAskReason}
              />
            )
          }
        >
          <Text accessibilityRole="alert" testID="return-video-failure">
            {failure === 'insufficientStorage'
              ? t('returns:record.live.insufficientStorage', { minutes })
              : t(`returns:record.live.${failure ?? 'saveFailed'}`)}
          </Text>
        </Screen>
        {sheet}
      </>
    );
  }

  return (
    <>
      <RecordingFrame
        testID="screen-UI-D04"
        primaryCode={returnCase.code}
        secondaryLabel={
          returnCase.sourceOrderId ? t('screens:record.returnCase') : t('returns:record.unlinked')
        }
        clockLabel={formatElapsed(startedAt ?? now, now)}
        guidance={t('screens:record.returnGuidance')}
        footnote={t('screens:record.killWarning')}
        recording={phase === 'recording'}
        badgeLabel={t('screens:record.badge')}
        previewLabel={t('screens:record.previewBadge')}
        {...(notice ? { notice } : {})}
        {...(phase === 'preparing' || phase === 'saving'
          ? {
              leaveMessage: t(
                phase === 'saving'
                  ? 'returns:record.live.leaveSaving'
                  : 'returns:record.live.leavePreparing',
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
      {sheet}
    </>
  );
}
