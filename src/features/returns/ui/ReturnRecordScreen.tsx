import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { RecordingFrame } from '@/shared/ui';

const PLACEHOLDER_CLOCK = '00:00';

/**
 * UI-D04 Quay video mở kiện (đặc tả B04 + B05). Dùng chung khung với màn quay đóng gói để giảm học,
 * nhưng hướng dẫn khác: quay từ TRƯỚC khi mở niêm phong. Không có thanh tab, rời màn phải qua cảnh
 * báo. KHUNG: chưa có camera; "kiện đã mở trước khi quay" (ngoại lệ B04) thuộc bước trước màn này.
 */
export function ReturnRecordScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const goNext = () => navigation.replace(ROUTES.returnItems);
  return (
    <RecordingFrame
      testID="screen-UI-D04"
      primaryCode=""
      secondaryLabel={t('screens:record.returnCase')}
      clockLabel={PLACEHOLDER_CLOCK}
      guidance={t('screens:record.returnGuidance')}
      onStop={goNext}
      onEndSession={goNext}
    />
  );
}
