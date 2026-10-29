import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { RecordingFrame, useToast } from '@/shared/ui';

import type { ReturnDetails } from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { resumeRoute } from './return-routes';
import { useReturnCase } from './use-return-case';
import { useReturnOps } from './use-return-ops';

const PLACEHOLDER_CLOCK = '00:00';

/**
 * UI-D04 Quay video mở kiện (đặc tả B04 + B05). Dùng chung khung với màn quay đóng gói để giảm học,
 * nhưng hướng dẫn khác: quay từ TRƯỚC khi mở niêm phong. Không có thanh tab, rời màn phải qua cảnh báo.
 *
 * R1: luồng ghi video mở kiện CHƯA nối camera (ghi video đóng gói còn sau cờ và chưa kiểm chứng trên
 * thiết bị; ADR-020), nên màn này LUÔN là xem trước (`recording={false}`, kể cả khi bật cờ ghi video
 * của đóng gói: không bao giờ hiện "Đang quay" khi không có tệp; bất biến 3, 11). Dừng/kết thúc phiên
 * ghi nhận hồ sơ "chưa có video mở kiện" (kèm lý do) rồi sang kiểm hàng: không tạo video giả (bất biến 6).
 */
export function ReturnRecordScreen() {
  const params = useRouteParams();
  const { state, reload } = useReturnCase(params.returnId);
  if (state.kind !== 'ready') {
    return <ReturnLoadState uiCode="UI-D04" state={state} onRetry={reload} />;
  }
  return <RecordBody details={state.details} />;
}

function RecordBody({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const toast = useToast();
  const { returnCase } = details;
  const [busy, setBusy] = useState(false);

  // Chưa ghi tình trạng bên ngoài thì quay lại bước đó; đã xác nhận thì sang màn xem (không nhảy cóc).
  const redirect =
    returnCase.status === 'receiving' || returnCase.status === 'confirmed'
      ? resumeRoute(returnCase.status)
      : null;
  useEffect(() => {
    if (redirect) navigation.replace(redirect, { returnId: returnCase.id });
  }, [redirect, navigation, returnCase.id]);

  const goNext = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Đã ghi nhận "chưa có video" từ lần trước (mở lại màn): không ghi lịch sử thêm lần nữa.
      if (returnCase.openingVideo === null) {
        await ops.skipOpeningVideo(
          returnCase.id,
          returnCase.openedBefore ? 'opened_before_recording' : 'recorder_unavailable',
        );
      }
      navigation.replace(ROUTES.returnItems, { returnId: returnCase.id });
    } catch (error) {
      logger.warn('returns.video_step_failed', {
        reason: isAppError(error) ? error.code : 'unknown',
      });
      toast.show(
        errorText(resolveErrorMessage(t, isAppError(error) ? error.code : 'RETURN_SAVE_FAILED')),
        {
          tone: 'error',
        },
      );
      setBusy(false);
    }
  };

  return (
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
      onStop={() => void goNext()}
      onEndSession={() => void goNext()}
    />
  );
}
