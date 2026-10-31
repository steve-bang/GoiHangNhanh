import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { RECORDER_ENABLED } from '@/core/config/recorder';
import { RecordingFrame, useToast } from '@/shared/ui';

import type { MissingVideoReason, ReturnDetails } from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { ReturnRecordLive } from './ReturnRecordLive';
import { SkipReasonSheet } from './ReturnSkipSheet';
import { resumeRoute } from './return-routes';
import { useReturnCase } from './use-return-case';
import { useReturnOps } from './use-return-ops';

const PLACEHOLDER_CLOCK = '00:00';

/**
 * UI-D04 Quay video mở kiện (đặc tả B04 + B05). Dùng chung khung với màn quay đóng gói để giảm học,
 * nhưng hướng dẫn khác: quay từ TRƯỚC khi mở niêm phong. Không có thanh tab, rời màn phải qua cảnh báo.
 *
 * Cờ `RECORDER_ENABLED` BẬT (ADR-020, R2b/Q-28): quay thật qua `ReturnRecordLive` (chưa kiểm chứng trên
 * thiết bị). Cờ TẮT (mặc định): màn này LUÔN là xem trước (`recording={false}`): không bao giờ hiện
 * "Đang quay" khi không có tệp (bất biến 3, 11). Dừng/kết thúc phiên ghi nhận hồ sơ "chưa có video mở
 * kiện" (kèm lý do) rồi sang kiểm hàng: không tạo video giả (bất biến 6).
 */
export function ReturnRecordScreen() {
  const params = useRouteParams();
  const { state, reload } = useReturnCase(params.returnId);
  if (state.kind !== 'ready') {
    return <ReturnLoadState uiCode="UI-D04" state={state} onRetry={reload} />;
  }
  return RECORDER_ENABLED ? (
    <ReturnRecordLive details={state.details} />
  ) : (
    <RecordBody details={state.details} />
  );
}

const REASONS: readonly MissingVideoReason[] = [
  'recorder_unavailable',
  'device_problem',
  'user_skipped',
];

function RecordBody({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const toast = useToast();
  const { returnCase } = details;
  const openedBefore = returnCase.openedBefore !== null;
  // Kiện đã mở trước khi quay: lý do duy nhất đúng sự thật; không cho chọn lý do mâu thuẫn.
  const options: readonly MissingVideoReason[] = openedBefore
    ? ['opened_before_recording']
    : REASONS;
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<MissingVideoReason>(options[0] ?? 'recorder_unavailable');
  const [busy, setBusy] = useState(false);

  // Chưa ghi tình trạng bên ngoài thì quay lại bước đó; đã xác nhận thì sang màn xem (không nhảy cóc).
  const redirect =
    returnCase.status === 'receiving' || returnCase.status === 'confirmed'
      ? resumeRoute(returnCase.status)
      : null;
  useEffect(() => {
    if (redirect) navigation.replace(redirect, { returnId: returnCase.id });
  }, [redirect, navigation, returnCase.id]);

  const goNext = async (chosen: MissingVideoReason) => {
    if (busy) return;
    setBusy(true);
    try {
      // Đã ghi nhận "chưa có video" từ lần trước (mở lại màn): không ghi lịch sử thêm lần nữa.
      if (returnCase.openingVideo === null) await ops.skipOpeningVideo(returnCase.id, chosen);
      navigation.replace(ROUTES.returnItems, { returnId: returnCase.id });
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

  /** Dừng/kết thúc phiên khi chưa có video: hỏi lý do (video là bằng chứng chính, bỏ qua phải có lý do). */
  const request = () => {
    if (returnCase.openingVideo !== null) void goNext(reason);
    else setAsking(true);
  };

  return (
    <>
      <RecordingFrame
        testID="screen-UI-D04"
        primaryCode={returnCase.code}
        secondaryLabel={
          returnCase.sourceOrderId ? t('screens:record.returnCase') : t('returns:record.unlinked')
        }
        clockLabel={PLACEHOLDER_CLOCK}
        guidance={t('screens:record.returnGuidance')}
        recording={false}
        badgeLabel={t('screens:record.badge')}
        previewLabel={t('screens:record.previewBadge')}
        notice={t('returns:record.notice')}
        leaveMessage={t('returns:record.leave')}
        onStop={request}
        onEndSession={request}
      />
      <SkipReasonSheet
        visible={asking}
        onClose={() => setAsking(false)}
        options={options}
        reason={reason}
        onSelect={setReason}
        busy={busy}
        onConfirm={() => void goNext(reason)}
      />
    </>
  );
}
