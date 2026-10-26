import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { RecordingFrame } from '@/shared/ui';

/** Đồng hồ cố định của KHUNG; chưa có bộ đếm thời gian thật vì chưa ghi hình. */
const PLACEHOLDER_CLOCK = '00:00';

/**
 * UI-C03 Quay video đóng gói (đặc tả A05). KHUNG: không camera, không ghi. Route nằm ngoài nhóm
 * tab nên thanh tab ẩn; rời màn đi qua hộp thoại cảnh báo (RecordingFrame). "Kết thúc phiên" và
 * "Dừng quay" đều dẫn tới Xác nhận video (UI-C04): không có đường làm mất phần đã ghi.
 */
export function PackRecordScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const goConfirm = () =>
    navigation.replace(ROUTES.packConfirm, params.code ? { code: params.code } : {});
  return (
    <RecordingFrame
      testID="screen-UI-C03"
      primaryCode={params.code ?? ''}
      secondaryLabel={t('screens:record.package', { index: params.package ?? '1' })}
      clockLabel={PLACEHOLDER_CLOCK}
      guidance={t('screens:record.packGuidance')}
      onStop={goConfirm}
      onEndSession={goConfirm}
    />
  );
}
